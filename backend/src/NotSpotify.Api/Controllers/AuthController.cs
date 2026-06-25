using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("auth")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private const string RefreshCookieName = "rt";
    private const string OAuthStateCookieName = "oauth_state";
    private const string OAuthModeCookieName = "oauth_mode";
    private const string OAuthReturnUrlCookieName = "oauth_return_url";

    private readonly UserManager<ApplicationUser> _users;
    private readonly TokenService _tokens;
    private readonly AppDbContext _db;
    private readonly JwtOptions _jwt;
    private readonly MediaMapper _mapper;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        UserManager<ApplicationUser> users,
        TokenService tokens,
        AppDbContext db,
        JwtOptions jwt,
        MediaMapper mapper,
        IConfiguration config,
        IWebHostEnvironment env,
        IHttpClientFactory httpClientFactory,
        ILogger<AuthController> logger)
    {
        _users = users;
        _tokens = tokens;
        _db = db;
        _jwt = jwt;
        _mapper = mapper;
        _config = config;
        _env = env;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    [HttpPost("signup")]
    public async Task<ActionResult<AuthResponse>> Signup([FromBody] SignupRequest req)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = req.Email,
            Email = req.Email,
            Name = req.Name,
            Country = req.Country ?? "US",
        };

        var result = await _users.CreateAsync(user, req.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        return Ok(await IssueTokensAsync(user));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req)
    {
        var user = await _users.FindByEmailAsync(req.Email);
        if (user is null || !await _users.CheckPasswordAsync(user, req.Password))
            return Unauthorized(new { message = "Invalid email or password." });

        return Ok(await IssueTokensAsync(user));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AccessTokenResponse>> Refresh()
    {
        if (!Request.Cookies.TryGetValue(RefreshCookieName, out var raw) || string.IsNullOrEmpty(raw))
            return Unauthorized();

        var hash = TokenService.HashRefreshToken(raw);
        var existing = await _db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (existing is null || !existing.IsActive)
        {
            Response.Cookies.Delete(RefreshCookieName, new CookieOptions { Path = "/auth" });
            return Unauthorized();
        }

        var (newRaw, newHash, expiresAt) = _tokens.CreateRefreshToken();
        existing.RevokedAt = DateTime.UtcNow;
        existing.ReplacedByTokenHash = newHash;

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = existing.UserId,
            TokenHash = newHash,
            ExpiresAt = expiresAt,
        });
        await _db.SaveChangesAsync();

        SetRefreshCookie(newRaw, expiresAt);
        var roles = await _users.GetRolesAsync(existing.User);
        return Ok(new AccessTokenResponse(_tokens.CreateAccessToken(existing.User, roles)));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

        if (Request.Cookies.TryGetValue(RefreshCookieName, out var raw) && !string.IsNullOrEmpty(raw))
        {
            var hash = TokenService.HashRefreshToken(raw);
            var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
            if (token is not null && token.RevokedAt is null)
                token.RevokedAt = DateTime.UtcNow;
        }

        // Only clear LastSeenAt (go offline) when this is the user's LAST active session.
        // If they're logged in on another device or tab, that device's heartbeat will
        // keep LastSeenAt fresh and they'll stay online.
        if (Guid.TryParse(userId, out var uid))
        {
            var hasOtherActiveSessions = await _db.RefreshTokens
                .AnyAsync(t => t.UserId == uid
                               && t.RevokedAt == null
                               && t.ExpiresAt > DateTime.UtcNow);

            if (!hasOtherActiveSessions)
            {
                var user = await _db.Users.FindAsync(uid);
                if (user is not null)
                    user.LastSeenAt = null;
            }
        }

        await _db.SaveChangesAsync();
        Response.Cookies.Delete(RefreshCookieName);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(id, out var userId)) return Unauthorized();

        var user = await _users.FindByIdAsync(userId.ToString());
        if (user is null) return NotFound();

        var roles = await _users.GetRolesAsync(user);
        return Ok(_mapper.ToUserDto(user, roles));
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(id, out var userId)) return Unauthorized();

        var user = await _users.FindByIdAsync(userId.ToString());
        if (user is null) return Unauthorized();

        var result = await _users.ChangePasswordAsync(user, req.CurrentPassword, req.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        // Security: invalidate every existing session, then hand the current device a
        // fresh session so the user isn't kicked out of the tab they just used.
        await RevokeAllRefreshTokensAsync(user.Id);
        return Ok(await IssueTokensAsync(user));
    }

    [HttpPost("forgot-password")]
    public async Task<ActionResult<ForgotPasswordResponse>> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        // Always return the same generic message regardless of whether the account
        // exists — this prevents account-enumeration via the reset endpoint.
        const string generic = "If an account exists for that email, a password reset link has been created.";

        var user = await _users.FindByEmailAsync(req.Email);
        if (user is null)
            return Ok(new ForgotPasswordResponse(generic, null));

        var token = await _users.GeneratePasswordResetTokenAsync(user);
        var resetUrl = QueryHelpers.AddQueryString($"{FrontendBaseUrl()}/reset-password", new Dictionary<string, string?>
        {
            ["email"] = user.Email,
            ["token"] = token,
        });

        // No mailer is configured. In Development we return the link directly so the
        // flow is testable end-to-end; in Production we never leak it (a real mailer
        // would send it instead — see docs/auth-setup.md).
        if (_env.IsDevelopment())
        {
            _logger.LogInformation("[Auth] Password reset link for {Email}: {Url}", user.Email, resetUrl);
            return Ok(new ForgotPasswordResponse(generic, resetUrl));
        }

        return Ok(new ForgotPasswordResponse(generic, null));
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        var user = await _users.FindByEmailAsync(req.Email);
        // Same generic failure for unknown-user and bad-token so neither is distinguishable.
        if (user is null)
            return BadRequest(new { message = "This reset link is invalid or has expired. Request a new one." });

        var result = await _users.ResetPasswordAsync(user, req.Token, req.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { message = "This reset link is invalid or has expired. Request a new one." });

        // A reset means "I lost access" — kill all sessions so any attacker is logged out.
        await RevokeAllRefreshTokensAsync(user.Id);
        return NoContent();
    }

    // ── External login (Google OAuth, manual code flow — no extra NuGet package) ──

    [HttpGet("external/providers")]
    public async Task<ActionResult<ExternalProvidersResponse>> ExternalProviders()
        => Ok(await GetExternalProvidersAsync());

    [HttpGet("external/google")]
    public async Task<IActionResult> GoogleChallenge([FromQuery] string? mode, [FromQuery] string? returnUrl)
    {
        var frontend = FrontendBaseUrl(returnUrl);
        if (!await GoogleAvailableAsync())
            return Redirect($"{frontend}/login?oauth=unconfigured");

        var state = Guid.NewGuid().ToString("N");
        SetOAuthCookie(OAuthStateCookieName, state);
        SetOAuthCookie(OAuthReturnUrlCookieName, frontend);
        if (string.Equals(mode, "popup", StringComparison.OrdinalIgnoreCase))
            SetOAuthCookie(OAuthModeCookieName, "popup");

        var authorizeUrl = QueryHelpers.AddQueryString("https://accounts.google.com/o/oauth2/v2/auth", new Dictionary<string, string?>
        {
            ["client_id"] = _config["Authentication:Google:ClientId"],
            ["redirect_uri"] = GoogleRedirectUri(),
            ["response_type"] = "code",
            ["scope"] = "openid email profile",
            ["state"] = state,
            ["access_type"] = "online",
            ["prompt"] = "select_account",
        });

        return Redirect(authorizeUrl);
    }

    [HttpGet("external/google/callback")]
    public async Task<IActionResult> GoogleCallback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error)
    {
        var frontend = OAuthReturnFrontendBaseUrl();
        var loginError = $"{frontend}/login?oauth=error";
        Request.Cookies.TryGetValue(OAuthModeCookieName, out var oauthMode);
        var isPopup = string.Equals(oauthMode, "popup", StringComparison.OrdinalIgnoreCase);
        Response.Cookies.Delete(OAuthModeCookieName, new CookieOptions { Path = "/auth" });
        IActionResult Failure() => isPopup ? OAuthPopupResult("google", "error", frontend) : Redirect(loginError);

        if (!await GoogleAvailableAsync() || !string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code))
            return Failure();

        // CSRF: the state we issued must match the cookie we set on the challenge.
        Request.Cookies.TryGetValue(OAuthStateCookieName, out var expectedState);
        Response.Cookies.Delete(OAuthStateCookieName, new CookieOptions { Path = "/auth" });
        if (string.IsNullOrEmpty(expectedState) || expectedState != state)
            return Failure();

        try
        {
            var http = _httpClientFactory.CreateClient();

            using var tokenResp = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["code"] = code,
                ["client_id"] = _config["Authentication:Google:ClientId"]!,
                ["client_secret"] = _config["Authentication:Google:ClientSecret"]!,
                ["redirect_uri"] = GoogleRedirectUri(),
                ["grant_type"] = "authorization_code",
            }));
            if (!tokenResp.IsSuccessStatusCode) return Failure();

            using var tokenDoc = JsonDocument.Parse(await tokenResp.Content.ReadAsStringAsync());
            var accessToken = tokenDoc.RootElement.TryGetProperty("access_token", out var at) ? at.GetString() : null;
            if (string.IsNullOrEmpty(accessToken)) return Failure();

            using var userReq = new HttpRequestMessage(HttpMethod.Get, "https://www.googleapis.com/oauth2/v3/userinfo");
            userReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            using var userResp = await http.SendAsync(userReq);
            if (!userResp.IsSuccessStatusCode) return Failure();

            using var userDoc = JsonDocument.Parse(await userResp.Content.ReadAsStringAsync());
            var root = userDoc.RootElement;
            var email = root.TryGetProperty("email", out var em) ? em.GetString() : null;
            if (string.IsNullOrEmpty(email)) return Failure();
            var name = root.TryGetProperty("name", out var nm) ? nm.GetString() : null;

            var user = await _users.FindByEmailAsync(email);
            if (user is null)
            {
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = email,
                    Email = email,
                    EmailConfirmed = true,
                    Name = string.IsNullOrWhiteSpace(name) ? email.Split('@')[0] : name!,
                    Country = "US",
                };
                var created = await _users.CreateAsync(user); // no password — external-only account
                if (!created.Succeeded) return Failure();
            }

            // Sets the rt refresh cookie; the SPA's hydrate-from-cookie flow logs the user
            // in on landing, so no access-token handoff is needed in the redirect.
            await IssueTokensAsync(user);
            if (isPopup)
                return OAuthPopupResult("google", "success", frontend);

            return Redirect($"{frontend}/?oauth=google");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Auth] Google OAuth callback failed");
            return Failure();
        }
    }

    [HttpGet("external/facebook")]
    public async Task<IActionResult> FacebookChallenge([FromQuery] string? mode, [FromQuery] string? returnUrl)
    {
        var frontend = FrontendBaseUrl(returnUrl);
        if (!await FacebookAvailableAsync())
            return Redirect($"{frontend}/login?oauth=unconfigured");

        var state = Guid.NewGuid().ToString("N");
        SetOAuthCookie(OAuthStateCookieName, state);
        SetOAuthCookie(OAuthReturnUrlCookieName, frontend);
        if (string.Equals(mode, "popup", StringComparison.OrdinalIgnoreCase))
            SetOAuthCookie(OAuthModeCookieName, "popup");

        var authorizeUrl = QueryHelpers.AddQueryString("https://www.facebook.com/v20.0/dialog/oauth", new Dictionary<string, string?>
        {
            ["client_id"] = _config["Authentication:Facebook:AppId"],
            ["redirect_uri"] = FacebookRedirectUri(),
            ["response_type"] = "code",
            ["scope"] = "email,public_profile",
            ["state"] = state,
        });

        return Redirect(authorizeUrl);
    }

    [HttpGet("external/facebook/callback")]
    public async Task<IActionResult> FacebookCallback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error)
    {
        var frontend = OAuthReturnFrontendBaseUrl();
        var loginError = $"{frontend}/login?oauth=error";
        var isPopup = IsPopupOAuth();
        IActionResult Failure() => isPopup ? OAuthPopupResult("facebook", "error", frontend) : Redirect(loginError);

        if (!await FacebookAvailableAsync() || !string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code))
            return Failure();

        Request.Cookies.TryGetValue(OAuthStateCookieName, out var expectedState);
        Response.Cookies.Delete(OAuthStateCookieName, new CookieOptions { Path = "/auth" });
        if (string.IsNullOrEmpty(expectedState) || expectedState != state)
            return Failure();

        try
        {
            var http = _httpClientFactory.CreateClient();

            var tokenUrl = QueryHelpers.AddQueryString("https://graph.facebook.com/v20.0/oauth/access_token", new Dictionary<string, string?>
            {
                ["client_id"] = _config["Authentication:Facebook:AppId"],
                ["client_secret"] = _config["Authentication:Facebook:AppSecret"],
                ["redirect_uri"] = FacebookRedirectUri(),
                ["code"] = code,
            });

            using var tokenResp = await http.GetAsync(tokenUrl);
            if (!tokenResp.IsSuccessStatusCode) return Failure();

            using var tokenDoc = JsonDocument.Parse(await tokenResp.Content.ReadAsStringAsync());
            var accessToken = tokenDoc.RootElement.TryGetProperty("access_token", out var at) ? at.GetString() : null;
            if (string.IsNullOrEmpty(accessToken)) return Failure();

            var meUrl = QueryHelpers.AddQueryString("https://graph.facebook.com/v20.0/me", new Dictionary<string, string?>
            {
                ["fields"] = "id,name,email",
                ["access_token"] = accessToken,
            });

            using var userResp = await http.GetAsync(meUrl);
            if (!userResp.IsSuccessStatusCode) return Failure();

            using var userDoc = JsonDocument.Parse(await userResp.Content.ReadAsStringAsync());
            var root = userDoc.RootElement;
            var email = root.TryGetProperty("email", out var em) ? em.GetString() : null;
            if (string.IsNullOrEmpty(email)) return Failure();

            var name = root.TryGetProperty("name", out var nm) ? nm.GetString() : null;
            var user = await FindOrCreateExternalUserAsync(email, name);
            if (user is null) return Failure();

            await IssueTokensAsync(user);
            if (isPopup)
                return OAuthPopupResult("facebook", "success", frontend);

            return Redirect($"{frontend}/?oauth=facebook");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Auth] Facebook OAuth callback failed");
            return Failure();
        }
    }

    private ContentResult OAuthPopupResult(string provider, string status, string frontend)
    {
        var payload = JsonSerializer.Serialize(new
        {
            type = "notspotify:oauth",
            provider,
            status,
        });
        var targetOrigin = JsonSerializer.Serialize(frontend);
        var fallbackPath = status == "success" ? $"/?oauth={provider}" : "/login?oauth=error";
        var fallbackUrl = JsonSerializer.Serialize($"{frontend}{fallbackPath}");

        var html = $$"""
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <title>Social sign-in</title>
            </head>
            <body>
              <script>
                (function () {
                  var payload = {{payload}};
                  var targetOrigin = {{targetOrigin}};
                  var fallbackUrl = {{fallbackUrl}};
                  if (window.opener && !window.opener.closed) {
                    window.opener.postMessage(payload, targetOrigin);
                    window.close();
                    setTimeout(function () { window.location.replace(fallbackUrl); }, 700);
                  } else {
                    window.location.replace(fallbackUrl);
                  }
                })();
              </script>
            </body>
            </html>
            """;

        return Content(html, "text/html");
    }

    private async Task<ExternalProvidersResponse> GetExternalProvidersAsync()
    {
        var googleEnabled = await ExternalProviderEnabledAsync("google", defaultEnabled: true);
        var facebookEnabled = await ExternalProviderEnabledAsync("facebook", defaultEnabled: false);
        var appleEnabled = await ExternalProviderEnabledAsync("apple", defaultEnabled: false);

        var googleConfigured = GoogleConfigured();
        var facebookConfigured = FacebookConfigured();

        return new ExternalProvidersResponse(
            Google: new ExternalAuthProviderDto(googleEnabled, googleConfigured, googleEnabled && googleConfigured),
            Facebook: new ExternalAuthProviderDto(facebookEnabled, facebookConfigured, facebookEnabled && facebookConfigured),
            Apple: new ExternalAuthProviderDto(appleEnabled, Configured: false, Available: false)
        );
    }

    private async Task<bool> GoogleAvailableAsync()
    {
        var providers = await GetExternalProvidersAsync();
        return providers.Google.Available;
    }

    private async Task<bool> FacebookAvailableAsync()
    {
        var providers = await GetExternalProvidersAsync();
        return providers.Facebook.Available;
    }

    private async Task<bool> ExternalProviderEnabledAsync(string provider, bool defaultEnabled)
    {
        var key = $"auth.external.{provider}.enabled";
        var setting = await _db.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == key);
        return setting is null ? defaultEnabled : string.Equals(setting.Value, "true", StringComparison.OrdinalIgnoreCase);
    }

    private bool GoogleConfigured()
        => !string.IsNullOrEmpty(_config["Authentication:Google:ClientId"])
           && !string.IsNullOrEmpty(_config["Authentication:Google:ClientSecret"]);

    private bool FacebookConfigured()
        => !string.IsNullOrEmpty(_config["Authentication:Facebook:AppId"])
           && !string.IsNullOrEmpty(_config["Authentication:Facebook:AppSecret"]);

    private string GoogleRedirectUri()
        => _config["Authentication:Google:RedirectUri"]
           ?? $"{Request.Scheme}://{Request.Host}/auth/external/google/callback";

    private string FacebookRedirectUri()
        => _config["Authentication:Facebook:RedirectUri"]
           ?? $"{Request.Scheme}://{Request.Host}/auth/external/facebook/callback";

    private void SetOAuthCookie(string name, string value)
    {
        Response.Cookies.Append(name, value, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = DateTime.UtcNow.AddMinutes(10),
            Path = "/auth",
        });
    }

    private bool IsPopupOAuth()
    {
        Request.Cookies.TryGetValue(OAuthModeCookieName, out var oauthMode);
        Response.Cookies.Delete(OAuthModeCookieName, new CookieOptions { Path = "/auth" });
        return string.Equals(oauthMode, "popup", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<ApplicationUser?> FindOrCreateExternalUserAsync(string email, string? name)
    {
        var user = await _users.FindByEmailAsync(email);
        if (user is not null) return user;

        user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            Name = string.IsNullOrWhiteSpace(name) ? email.Split('@')[0] : name!,
            Country = "US",
        };

        var created = await _users.CreateAsync(user);
        return created.Succeeded ? user : null;
    }

    private string OAuthReturnFrontendBaseUrl()
    {
        Request.Cookies.TryGetValue(OAuthReturnUrlCookieName, out var returnUrl);
        Response.Cookies.Delete(OAuthReturnUrlCookieName, new CookieOptions { Path = "/auth" });
        return FrontendBaseUrl(returnUrl);
    }

    private string FrontendBaseUrl(string? requestedUrl = null)
    {
        var allowed = FrontendBaseUrls().ToList();
        if (!string.IsNullOrWhiteSpace(requestedUrl)
            && Uri.TryCreate(requestedUrl, UriKind.Absolute, out var requested)
            && (requested.Scheme == Uri.UriSchemeHttp || requested.Scheme == Uri.UriSchemeHttps)
            && allowed.Any(origin => SameOrigin(origin, requested)))
        {
            return OriginOf(requested).TrimEnd('/');
        }

        return allowed.FirstOrDefault() ?? "http://localhost:5173";
    }

    private IEnumerable<string> FrontendBaseUrls()
    {
        var urls = new List<string>();
        var configuredMany = _config.GetSection("App:FrontendUrls").Get<string[]>();
        if (configuredMany is not null) urls.AddRange(configuredMany);

        var configuredOne = _config["App:FrontendUrl"];
        if (!string.IsNullOrWhiteSpace(configuredOne)) urls.Add(configuredOne);

        var corsOrigins = _config.GetSection("Cors:AllowedOrigins").Get<string[]>();
        if (corsOrigins is not null) urls.AddRange(corsOrigins);

        urls.Add("http://localhost:5173");

        return urls
            .Where(u => Uri.TryCreate(u, UriKind.Absolute, out var uri)
                        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            .Select(u => OriginOf(new Uri(u)).TrimEnd('/'))
            .Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static bool SameOrigin(string allowedOrigin, Uri requested)
        => Uri.TryCreate(allowedOrigin, UriKind.Absolute, out var allowed)
           && string.Equals(allowed.Scheme, requested.Scheme, StringComparison.OrdinalIgnoreCase)
           && string.Equals(allowed.Host, requested.Host, StringComparison.OrdinalIgnoreCase)
           && allowed.Port == requested.Port;

    private static string OriginOf(Uri uri)
    {
        var defaultPort = uri.Scheme == Uri.UriSchemeHttp ? 80 : 443;
        var port = uri.Port == defaultPort ? string.Empty : $":{uri.Port}";
        return $"{uri.Scheme}://{uri.Host}{port}";
    }

    private async Task RevokeAllRefreshTokensAsync(Guid userId)
    {
        var now = DateTime.UtcNow;
        var active = await _db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync();
        foreach (var token in active)
            token.RevokedAt = now;
        await _db.SaveChangesAsync();
    }

    private async Task<AuthResponse> IssueTokensAsync(ApplicationUser user)
    {
        var (raw, hash, expiresAt) = _tokens.CreateRefreshToken();
        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = expiresAt,
        });
        await _db.SaveChangesAsync();

        SetRefreshCookie(raw, expiresAt);
        var roles = await _users.GetRolesAsync(user);
        return new AuthResponse(_tokens.CreateAccessToken(user, roles), _mapper.ToUserDto(user, roles));
    }

    private void SetRefreshCookie(string raw, DateTime expiresAt)
    {
        Response.Cookies.Append(RefreshCookieName, raw, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = expiresAt,
            Path = "/auth",
        });
    }

}
