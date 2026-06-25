using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Controllers.Admin;

/// <summary>Development-only helpers. All endpoints require Admin role.</summary>
[ApiController]
[Route("admin/dev")]
[Authorize(Roles = "Admin")]
public class AdminDevController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AdminDevController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    /// <summary>
    /// Resets all track play counts and play history rows back to zero / empty.
    /// Ratings, saves, and other user data are left untouched.
    /// FOR DEVELOPMENT USE ONLY.
    /// </summary>
    [HttpPost("reset-plays")]
    public async Task<IActionResult> ResetPlays(CancellationToken ct = default)
    {
        await _db.Database.ExecuteSqlRawAsync(@"DELETE FROM ""PlayHistories"";", ct);
        await _db.Database.ExecuteSqlRawAsync(@"UPDATE ""Tracks"" SET ""PlayCount"" = 0;", ct);
        return Ok(new { message = "Play counts reset to zero." });
    }

    [HttpGet("auth-providers")]
    public async Task<ActionResult<AdminAuthProvidersResponse>> GetAuthProviders(CancellationToken ct = default)
        => Ok(await BuildAuthProvidersResponseAsync(ct));

    [HttpPut("auth-providers")]
    public async Task<ActionResult<AdminAuthProvidersResponse>> UpdateAuthProviders(
        [FromBody] UpdateAuthProvidersRequest req,
        CancellationToken ct = default)
    {
        await SetProviderEnabledAsync("google", req.Google, ct);
        await SetProviderEnabledAsync("facebook", req.Facebook, ct);
        await SetProviderEnabledAsync("apple", req.Apple, ct);
        await _db.SaveChangesAsync(ct);

        return Ok(await BuildAuthProvidersResponseAsync(ct));
    }

    private async Task<AdminAuthProvidersResponse> BuildAuthProvidersResponseAsync(CancellationToken ct)
    {
        var googleEnabled = await ProviderEnabledAsync("google", defaultEnabled: true, ct);
        var facebookEnabled = await ProviderEnabledAsync("facebook", defaultEnabled: false, ct);
        var appleEnabled = await ProviderEnabledAsync("apple", defaultEnabled: false, ct);
        var googleConfigured = !string.IsNullOrEmpty(_config["Authentication:Google:ClientId"])
                               && !string.IsNullOrEmpty(_config["Authentication:Google:ClientSecret"]);
        var facebookConfigured = !string.IsNullOrEmpty(_config["Authentication:Facebook:AppId"])
                                 && !string.IsNullOrEmpty(_config["Authentication:Facebook:AppSecret"]);

        return new AdminAuthProvidersResponse(
            Google: new AdminAuthProviderState(googleEnabled, googleConfigured, googleEnabled && googleConfigured, "Implemented"),
            Facebook: new AdminAuthProviderState(facebookEnabled, facebookConfigured, facebookEnabled && facebookConfigured, "Implemented"),
            Apple: new AdminAuthProviderState(appleEnabled, Configured: false, Available: false, "Hidden for now")
        );
    }

    private async Task<bool> ProviderEnabledAsync(string provider, bool defaultEnabled, CancellationToken ct)
    {
        var key = ProviderKey(provider);
        var setting = await _db.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == key, ct);
        return setting is null ? defaultEnabled : string.Equals(setting.Value, "true", StringComparison.OrdinalIgnoreCase);
    }

    private async Task SetProviderEnabledAsync(string provider, bool enabled, CancellationToken ct)
    {
        var key = ProviderKey(provider);
        var setting = await _db.AppSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (setting is null)
        {
            _db.AppSettings.Add(new AppSetting
            {
                Key = key,
                Value = enabled ? "true" : "false",
                UpdatedAt = DateTime.UtcNow,
            });
            return;
        }

        setting.Value = enabled ? "true" : "false";
        setting.UpdatedAt = DateTime.UtcNow;
    }

    private static string ProviderKey(string provider) => $"auth.external.{provider}.enabled";
}

public record UpdateAuthProvidersRequest(bool Google, bool Facebook, bool Apple);

public record AdminAuthProviderState(bool Enabled, bool Configured, bool Available, string Status);

public record AdminAuthProvidersResponse(
    AdminAuthProviderState Google,
    AdminAuthProviderState Facebook,
    AdminAuthProviderState Apple
);
