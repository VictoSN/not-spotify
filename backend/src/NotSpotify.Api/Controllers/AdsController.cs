using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("ads")]
public class AdsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public AdsController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    /// <summary>The free-tier cadence so the client knows how often to insert ads.</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<AdSettingsDto>> Settings(CancellationToken ct = default)
    {
        var s = await _db.AdSettings.OrderBy(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        return Ok(new AdSettingsDto(s?.AdsPerNTracks ?? 3, s?.IsEnabled ?? false));
    }

    /// <summary>
    /// Weighted-random pick of one active ad that is in its flight window and
    /// targets the caller's market (or is untargeted). 204 when ads are disabled
    /// or nothing matches — the client then just continues to the next track.
    /// </summary>
    [HttpGet("next")]
    public async Task<ActionResult<AdDto>> Next([FromQuery] string? country = null, CancellationToken ct = default)
    {
        var settings = await _db.AdSettings.OrderBy(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        if (settings is not null && !settings.IsEnabled) return NoContent();

        var userIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var personalize = true;
        if (Guid.TryParse(userIdRaw, out var userId))
        {
            var pref = await _db.UserAccountPreferences.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
            personalize = pref?.AllowPersonalizedAds ?? true;
        }

        var market = (country ?? User.FindFirstValue("country"))?.Trim().ToUpperInvariant();
        var now = DateTime.UtcNow;

        var candidates = await _db.Advertisements
            .Where(a => a.IsActive
                && (a.StartsAt == null || a.StartsAt <= now)
                && (a.EndsAt == null || a.EndsAt >= now)
                && (personalize
                    ? (a.Country == null || market == null || a.Country == market)
                    : a.Country == null))
            .ToListAsync(ct);

        if (candidates.Count == 0) return NoContent();

        var picked = WeightedPick(candidates);
        return Ok(await _mapper.ToDtoAsync(picked, ct));
    }

    /// <summary>Record that an ad was played (counts toward its impression total).</summary>
    [HttpPost("{id:guid}/impression")]
    public async Task<IActionResult> Impression(Guid id, CancellationToken ct = default)
    {
        var rows = await _db.Advertisements
            .Where(a => a.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ImpressionCount, a => a.ImpressionCount + 1), ct);
        return rows == 0 ? NotFound() : NoContent();
    }

    private static Advertisement WeightedPick(IReadOnlyList<Advertisement> ads)
    {
        var total = ads.Sum(a => Math.Max(1, a.Weight));
        var roll = Random.Shared.Next(total);
        foreach (var ad in ads)
        {
            roll -= Math.Max(1, ad.Weight);
            if (roll < 0) return ad;
        }
        return ads[^1];
    }
}
