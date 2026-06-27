using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/ads")]
[Authorize(Roles = "Admin")]
public class AdminAdsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public AdminAdsController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdAdminDto>>> List(CancellationToken ct = default)
    {
        var ads = await _db.Advertisements.OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        var dtos = new List<AdAdminDto>(ads.Count);
        foreach (var ad in ads) dtos.Add(await _mapper.ToAdminDtoAsync(ad, ct));
        return Ok(dtos);
    }

    [HttpPost]
    public async Task<ActionResult<AdAdminDto>> Create([FromBody] UpsertAdRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("Title is required.");
        if (string.IsNullOrWhiteSpace(req.AudioUrl) && string.IsNullOrWhiteSpace(req.AudioKey))
            return BadRequest("An ad needs audio (AudioUrl or AudioKey).");

        var ad = new Advertisement();
        Apply(ad, req);
        _db.Advertisements.Add(ad);
        await _db.SaveChangesAsync(ct);
        return Ok(await _mapper.ToAdminDtoAsync(ad, ct));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AdAdminDto>> Update(Guid id, [FromBody] UpsertAdRequest req, CancellationToken ct = default)
    {
        var ad = await _db.Advertisements.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (ad is null) return NotFound();
        Apply(ad, req);
        await _db.SaveChangesAsync(ct);
        return Ok(await _mapper.ToAdminDtoAsync(ad, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var rows = await _db.Advertisements.Where(a => a.Id == id).ExecuteDeleteAsync(ct);
        return rows == 0 ? NotFound() : NoContent();
    }

    [HttpGet("settings")]
    public async Task<ActionResult<AdSettingsDto>> GetSettings(CancellationToken ct = default)
    {
        var s = await _db.AdSettings.OrderBy(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        // Match the public /ads/settings default: ads remain off until an admin
        // explicitly enables and saves serving settings.
        return Ok(new AdSettingsDto(s?.AdsPerNTracks ?? 3, s?.IsEnabled ?? false));
    }

    [HttpPut("settings")]
    public async Task<ActionResult<AdSettingsDto>> UpdateSettings([FromBody] AdSettingsDto req, CancellationToken ct = default)
    {
        var s = await _db.AdSettings.OrderBy(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        if (s is null)
        {
            s = new AdSettings();
            _db.AdSettings.Add(s);
        }
        s.AdsPerNTracks = Math.Max(1, req.AdsPerNTracks);
        s.IsEnabled = req.IsEnabled;
        s.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new AdSettingsDto(s.AdsPerNTracks, s.IsEnabled));
    }

    private static void Apply(Advertisement ad, UpsertAdRequest req)
    {
        ad.Title = req.Title.Trim();
        ad.Advertiser = req.Advertiser?.Trim() ?? string.Empty;
        ad.AudioUrl = req.AudioUrl ?? string.Empty;
        ad.AudioKey = req.AudioKey;
        ad.ImageUrl = req.ImageUrl;
        ad.ClickUrl = req.ClickUrl;
        ad.DurationMs = req.DurationMs;
        ad.Country = string.IsNullOrWhiteSpace(req.Country) ? null : req.Country.Trim().ToUpperInvariant();
        ad.Weight = Math.Max(1, req.Weight);
        ad.IsActive = req.IsActive;
        ad.StartsAt = req.StartsAt;
        ad.EndsAt = req.EndsAt;
    }
}
