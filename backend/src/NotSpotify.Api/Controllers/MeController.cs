using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("me")]
[Authorize]
public class MeController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public MeController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    /// <summary>
    /// Returns the current user's playlists (owned) combined with the public playlists
    /// they've saved/followed via <c>/me/saved-playlists</c>. Each entry's <c>isOwner</c>
    /// flag tells the client whether to render owner-only actions (edit/delete) or follower
    /// actions (remove from library).
    /// </summary>
    [HttpGet("playlists")]
    public async Task<ActionResult<IEnumerable<PlaylistSummaryDto>>> MyPlaylists(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var owned = await _db.Playlists
            .Where(p => p.OwnerId == me)
            .Include(p => p.Owner)
            .Include(p => p.PlaylistTracks)
            .ToListAsync(ct);

        var saved = await _db.UserSavedPlaylists
            .Where(s => s.UserId == me && s.Playlist.IsPublic)
            .OrderByDescending(s => s.SavedAt)
            .Include(s => s.Playlist).ThenInclude(p => p.Owner)
            .Include(s => s.Playlist).ThenInclude(p => p.PlaylistTracks)
            .Select(s => s.Playlist)
            .ToListAsync(ct);

        // Owned first (sorted by most-recently updated), then saved (sorted by save time).
        var results = owned
            .OrderByDescending(p => p.UpdatedAt)
            .Select(p => _mapper.ToSummary(p, isOwner: true, isSaved: false))
            .Concat(saved.Select(p => _mapper.ToSummary(p, isOwner: false, isSaved: true)));

        return Ok(results);
    }

    [HttpPost("saved-playlists/{id:guid}")]
    public async Task<IActionResult> SavePlaylist(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var playlist = await _db.Playlists.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (playlist is null) return NotFound();
        if (playlist.OwnerId == me) return Conflict(new { message = "You already own this playlist." });
        if (!playlist.IsPublic) return StatusCode(StatusCodes.Status403Forbidden, new { message = "Cannot save a private playlist." });

        var existing = await _db.UserSavedPlaylists
            .FirstOrDefaultAsync(s => s.UserId == me && s.PlaylistId == id, ct);
        if (existing is not null) return Conflict(new { message = "Playlist already saved." });

        _db.UserSavedPlaylists.Add(new UserSavedPlaylist
        {
            UserId = me.Value,
            PlaylistId = id,
            SavedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("saved-playlists/{id:guid}")]
    public async Task<IActionResult> UnsavePlaylist(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var row = await _db.UserSavedPlaylists
            .FirstOrDefaultAsync(s => s.UserId == me && s.PlaylistId == id, ct);
        if (row is null) return NotFound();

        _db.UserSavedPlaylists.Remove(row);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Records that the current user started playing a track. Fire-and-forget from the client —
    /// the player calls this on each play() and we dedupe at the source within ~5s.
    /// </summary>
    [HttpPost("plays")]
    public async Task<IActionResult> RecordPlay([FromBody] RecordPlayRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var trackExists = await _db.Tracks.AnyAsync(t => t.Id == req.TrackId, ct);
        if (!trackExists) return NotFound();

        _db.PlayHistories.Add(new PlayHistory
        {
            Id = Guid.NewGuid(),
            UserId = me.Value,
            TrackId = req.TrackId,
            PlayedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Returns the current user's most recently played distinct tracks, newest first.
    /// </summary>
    [HttpGet("recents")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Recents([FromQuery] int limit = 10, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        // Take limit*5 raw rows, group client-side so we collapse multiple plays of the same track
        // without doing a complex SQL DISTINCT ON. limit*5 gives plenty of headroom.
        var raw = await _db.PlayHistories
            .Where(h => h.UserId == me)
            .OrderByDescending(h => h.PlayedAt)
            .Take(limit * 5)
            .Select(h => new { h.TrackId, h.PlayedAt })
            .ToListAsync(ct);

        var orderedTrackIds = raw
            .GroupBy(r => r.TrackId)
            .Select(g => new { TrackId = g.Key, LastPlayedAt = g.Max(r => r.PlayedAt) })
            .OrderByDescending(g => g.LastPlayedAt)
            .Take(limit)
            .Select(g => g.TrackId)
            .ToList();

        if (orderedTrackIds.Count == 0) return Ok(Array.Empty<TrackDto>());

        var tracks = await _db.Tracks
            .Where(t => orderedTrackIds.Contains(t.Id))
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);

        // Reapply the recency order (Contains() above loses it).
        var byId = tracks.ToDictionary(t => t.Id);
        var ordered = orderedTrackIds.Select(id => byId[id]).ToList();
        return Ok(await _mapper.ToDtoListAsync(ordered, ct));
    }
}

public record RecordPlayRequest(Guid TrackId);
