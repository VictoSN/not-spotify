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
[Route("playlists")]
public class PlaylistsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public PlaylistsController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PlaylistSummaryDto>>> List(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        var playlists = await _db.Playlists
            .Where(p => p.IsPublic)
            .Include(p => p.Owner)
            .Include(p => p.PlaylistTracks)
            .OrderByDescending(p => p.UpdatedAt)
            .ToListAsync(ct);

        var savedIds = me is null
            ? new HashSet<Guid>()
            : (await _db.UserSavedPlaylists
                .Where(s => s.UserId == me)
                .Select(s => s.PlaylistId)
                .ToListAsync(ct)).ToHashSet();

        return Ok(playlists.Select(p => _mapper.ToSummary(
            p,
            isOwner: me != null && p.OwnerId == me,
            isSaved: savedIds.Contains(p.Id))));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PlaylistDto>> Get(Guid id, CancellationToken ct = default)
    {
        var p = await LoadFullPlaylist(id, ct);
        if (p is null) return NotFound();
        var me = CurrentUserId();
        if (!p.IsPublic && p.OwnerId != me) return StatusCode(StatusCodes.Status403Forbidden);

        var isOwner = me != null && p.OwnerId == me;
        var isSaved = me != null && await _db.UserSavedPlaylists.AnyAsync(s => s.UserId == me && s.PlaylistId == id, ct);
        return Ok(await _mapper.ToDtoAsync(p, ct, isOwner, isSaved));
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<PlaylistDto>> Create([FromBody] CreatePlaylistRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var playlist = new Playlist
        {
            Id = Guid.NewGuid(),
            OwnerId = me.Value,
            Name = req.Name,
            Description = req.Description,
            IsPublic = req.IsPublic,
        };
        _db.Playlists.Add(playlist);
        await _db.SaveChangesAsync(ct);

        var loaded = await LoadFullPlaylist(playlist.Id, ct);
        return CreatedAtAction(nameof(Get), new { id = playlist.Id }, await _mapper.ToDtoAsync(loaded!, ct, isOwner: true, isSaved: false));
    }

    [HttpPatch("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<PlaylistDto>> Update(Guid id, [FromBody] UpdatePlaylistRequest req, CancellationToken ct = default)
    {
        var p = await _db.Playlists.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.OwnerId != CurrentUserId()) return StatusCode(StatusCodes.Status403Forbidden);

        var wasPublic = p.IsPublic;
        if (req.Name is not null) p.Name = req.Name;
        if (req.Description is not null) p.Description = req.Description;
        if (req.IsPublic is not null) p.IsPublic = req.IsPublic.Value;
        if (req.CoverUrl is not null) p.CoverUrl = req.CoverUrl;
        p.UpdatedAt = DateTime.UtcNow;

        // When a playlist transitions from public -> private, revoke everyone else's
        // saved reference so it disappears from their libraries on next refresh.
        if (wasPublic && !p.IsPublic)
        {
            var savedRows = await _db.UserSavedPlaylists.Where(s => s.PlaylistId == id).ToListAsync(ct);
            if (savedRows.Count > 0) _db.UserSavedPlaylists.RemoveRange(savedRows);
        }

        await _db.SaveChangesAsync(ct);

        var loaded = await LoadFullPlaylist(id, ct);
        return Ok(await _mapper.ToDtoAsync(loaded!, ct, isOwner: true, isSaved: false));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var p = await _db.Playlists.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.OwnerId != CurrentUserId()) return StatusCode(StatusCodes.Status403Forbidden);

        _db.Playlists.Remove(p);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/tracks")]
    [Authorize]
    public async Task<ActionResult<PlaylistDto>> AddTrack(Guid id, [FromBody] AddPlaylistTrackRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var p = await _db.Playlists.Include(x => x.PlaylistTracks).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.OwnerId != me) return StatusCode(StatusCodes.Status403Forbidden);

        if (p.PlaylistTracks.Any(pt => pt.TrackId == req.TrackId))
            return Conflict(new { message = "Track already in playlist." });

        var nextPos = (p.PlaylistTracks.MaxBy(pt => pt.Position)?.Position ?? 0) + 1;
        p.PlaylistTracks.Add(new PlaylistTrack
        {
            PlaylistId = id,
            TrackId = req.TrackId,
            Position = nextPos,
            AddedByUserId = me.Value,
        });
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var loaded = await LoadFullPlaylist(id, ct);
        return Ok(await _mapper.ToDtoAsync(loaded!, ct, isOwner: true, isSaved: false));
    }

    [HttpDelete("{id:guid}/tracks/{trackId:guid}")]
    [Authorize]
    public async Task<IActionResult> RemoveTrack(Guid id, Guid trackId, CancellationToken ct = default)
    {
        var p = await _db.Playlists.Include(x => x.PlaylistTracks).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.OwnerId != CurrentUserId()) return StatusCode(StatusCodes.Status403Forbidden);

        var pt = p.PlaylistTracks.FirstOrDefault(x => x.TrackId == trackId);
        if (pt is null) return NotFound();
        _db.PlaylistTracks.Remove(pt);
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private Task<Playlist?> LoadFullPlaylist(Guid id, CancellationToken ct) => _db.Playlists
        .Include(p => p.Owner)
        .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Artist)
        .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Album)
        .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
        .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.AddedByUser)
        .FirstOrDefaultAsync(p => p.Id == id, ct);
}
