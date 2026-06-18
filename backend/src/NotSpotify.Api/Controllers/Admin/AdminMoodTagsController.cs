using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/mood-tags")]
[Authorize(Roles = "Admin")]
public class AdminMoodTagsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public AdminMoodTagsController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<MoodTagDto>>> List(CancellationToken ct = default)
    {
        var tags = await _db.MoodTags
            .OrderBy(m => m.Kind)
            .ThenBy(m => m.SortOrder)
            .ThenBy(m => m.Name)
            .ToListAsync(ct);
        return Ok(tags.Select(m => _mapper.ToDto(m)));
    }

    [HttpPost]
    public async Task<ActionResult<MoodTagDto>> Create([FromBody] UpsertMoodTagRequest req, CancellationToken ct = default)
    {
        var (error, normalized) = Normalize(req);
        if (error is not null) return BadRequest(new { message = error });

        if (await _db.MoodTags.AnyAsync(m => m.Slug == normalized.Slug, ct))
            return Conflict(new { message = $"A mood tag with slug '{normalized.Slug}' already exists." });

        var tag = new MoodTag
        {
            Id = Guid.NewGuid(),
            Name = normalized.Name,
            Slug = normalized.Slug,
            Kind = normalized.Kind,
            Color = normalized.Color,
            Icon = normalized.Icon,
            SearchQuery = normalized.SearchQuery,
            SortOrder = req.SortOrder,
        };
        _db.MoodTags.Add(tag);
        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(tag));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MoodTagDto>> Update(Guid id, [FromBody] UpsertMoodTagRequest req, CancellationToken ct = default)
    {
        var tag = await _db.MoodTags.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (tag is null) return NotFound();

        var (error, normalized) = Normalize(req);
        if (error is not null) return BadRequest(new { message = error });

        if (await _db.MoodTags.AnyAsync(m => m.Slug == normalized.Slug && m.Id != id, ct))
            return Conflict(new { message = $"A mood tag with slug '{normalized.Slug}' already exists." });

        tag.Name = normalized.Name;
        tag.Slug = normalized.Slug;
        tag.Kind = normalized.Kind;
        tag.Color = normalized.Color;
        tag.Icon = normalized.Icon;
        tag.SearchQuery = normalized.SearchQuery;
        tag.SortOrder = req.SortOrder;
        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(tag));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var tag = await _db.MoodTags.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (tag is null) return NotFound();
        // Join rows cascade via the FK delete behaviour.
        _db.MoodTags.Remove(tag);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---- Track assignments -------------------------------------------------

    [HttpGet("/admin/tracks/{trackId:guid}/mood-tags")]
    public async Task<ActionResult<IEnumerable<MoodTagDto>>> GetTrackTags(Guid trackId, CancellationToken ct = default)
    {
        if (!await _db.Tracks.AnyAsync(t => t.Id == trackId, ct)) return NotFound();

        var tags = await _db.TrackMoodTags
            .Where(tm => tm.TrackId == trackId)
            .Select(tm => tm.MoodTag)
            .OrderBy(m => m.SortOrder)
            .ToListAsync(ct);
        return Ok(tags.Select(m => _mapper.ToDto(m)));
    }

    [HttpPut("/admin/tracks/{trackId:guid}/mood-tags")]
    public async Task<ActionResult<IEnumerable<MoodTagDto>>> SetTrackTags(Guid trackId, [FromBody] SetMoodTagsRequest req, CancellationToken ct = default)
    {
        if (!await _db.Tracks.AnyAsync(t => t.Id == trackId, ct)) return NotFound();

        var requestedIds = (req.MoodTagIds ?? Enumerable.Empty<Guid>()).Distinct().ToHashSet();
        var validIds = await _db.MoodTags.Where(m => requestedIds.Contains(m.Id)).Select(m => m.Id).ToListAsync(ct);

        var existing = await _db.TrackMoodTags.Where(tm => tm.TrackId == trackId).ToListAsync(ct);
        _db.TrackMoodTags.RemoveRange(existing.Where(e => !validIds.Contains(e.MoodTagId)));

        var current = existing.Select(e => e.MoodTagId).ToHashSet();
        foreach (var moodTagId in validIds.Where(vid => !current.Contains(vid)))
            _db.TrackMoodTags.Add(new TrackMoodTag { TrackId = trackId, MoodTagId = moodTagId });

        await _db.SaveChangesAsync(ct);
        return await GetTrackTags(trackId, ct);
    }

    // ---- Playlist assignments ---------------------------------------------

    [HttpGet("/admin/playlists/{playlistId:guid}/mood-tags")]
    public async Task<ActionResult<IEnumerable<MoodTagDto>>> GetPlaylistTags(Guid playlistId, CancellationToken ct = default)
    {
        if (!await _db.Playlists.AnyAsync(p => p.Id == playlistId, ct)) return NotFound();

        var tags = await _db.PlaylistMoodTags
            .Where(pm => pm.PlaylistId == playlistId)
            .Select(pm => pm.MoodTag)
            .OrderBy(m => m.SortOrder)
            .ToListAsync(ct);
        return Ok(tags.Select(m => _mapper.ToDto(m)));
    }

    [HttpPut("/admin/playlists/{playlistId:guid}/mood-tags")]
    public async Task<ActionResult<IEnumerable<MoodTagDto>>> SetPlaylistTags(Guid playlistId, [FromBody] SetMoodTagsRequest req, CancellationToken ct = default)
    {
        if (!await _db.Playlists.AnyAsync(p => p.Id == playlistId, ct)) return NotFound();

        var requestedIds = (req.MoodTagIds ?? Enumerable.Empty<Guid>()).Distinct().ToHashSet();
        var validIds = await _db.MoodTags.Where(m => requestedIds.Contains(m.Id)).Select(m => m.Id).ToListAsync(ct);

        var existing = await _db.PlaylistMoodTags.Where(pm => pm.PlaylistId == playlistId).ToListAsync(ct);
        _db.PlaylistMoodTags.RemoveRange(existing.Where(e => !validIds.Contains(e.MoodTagId)));

        var current = existing.Select(e => e.MoodTagId).ToHashSet();
        foreach (var moodTagId in validIds.Where(vid => !current.Contains(vid)))
            _db.PlaylistMoodTags.Add(new PlaylistMoodTag { PlaylistId = playlistId, MoodTagId = moodTagId });

        await _db.SaveChangesAsync(ct);
        return await GetPlaylistTags(playlistId, ct);
    }

    // ---- helpers -----------------------------------------------------------

    private static (string? error, (string Name, string Slug, string Kind, string Color, string? Icon, string? SearchQuery) value) Normalize(UpsertMoodTagRequest req)
    {
        var name = req.Name?.Trim() ?? string.Empty;
        if (name.Length == 0) return ("Name is required.", default);

        var slug = (req.Slug ?? string.Empty).Trim().ToLowerInvariant();
        if (slug.Length == 0) return ("Slug is required.", default);

        var kind = (req.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (kind != "mood" && kind != "activity") return ("Kind must be 'mood' or 'activity'.", default);

        var color = string.IsNullOrWhiteSpace(req.Color) ? "#888888" : req.Color.Trim();
        var icon = string.IsNullOrWhiteSpace(req.Icon) ? null : req.Icon.Trim();
        var searchQuery = string.IsNullOrWhiteSpace(req.SearchQuery) ? null : req.SearchQuery.Trim();

        return (null, (name, slug, kind, color, icon, searchQuery));
    }
}
