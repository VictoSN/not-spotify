using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private const string RefreshCookieName = "rt";

    private readonly UserManager<ApplicationUser> _users;
    private readonly TokenService _tokens;
    private readonly AppDbContext _db;
    private readonly JwtOptions _jwt;
    private readonly MediaMapper _mapper;

    public AuthController(UserManager<ApplicationUser> users, TokenService tokens, AppDbContext db, JwtOptions jwt, MediaMapper mapper)
    {
        _users = users;
        _tokens = tokens;
        _db = db;
        _jwt = jwt;
        _mapper = mapper;
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
        if (user is null) return Unauthorized();

        if (!await _users.CheckPasswordAsync(user, req.Password))
            return Unauthorized();

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
        if (Request.Cookies.TryGetValue(RefreshCookieName, out var raw) && !string.IsNullOrEmpty(raw))
        {
            var hash = TokenService.HashRefreshToken(raw);
            var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
            if (token is not null && token.RevokedAt is null)
            {
                token.RevokedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
        }

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
