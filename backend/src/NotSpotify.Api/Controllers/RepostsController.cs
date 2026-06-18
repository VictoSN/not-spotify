using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("me")]
[Authorize]
public partial class RepostsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly NotificationService _notifications;

    public RepostsController(
        AppDbContext db,
        MediaMapper mapper,
        NotificationService notifications)
    {
        _db = db;
        _mapper = mapper;
        _notifications = notifications;
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    /// <summary>
    /// Create a repost. At least one of TrackId/AlbumId/PlaylistId must be set.
    /// Idempotent — returns the existing repost if already present.
    /// </summary>
    [HttpPost("reposts")]
    public async Task<ActionResult<RepostDto>> Create([FromBody] CreateRepostRequest req, CancellationToken ct = default)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        if (req.TrackId is null && req.AlbumId is null && req.PlaylistId is null)
            return BadRequest(new { message = "At least one of trackId, albumId, or playlistId is required." });

        // Check idempotency: same user + same target = already reposted.
        Models.Repost? existing = null;
        if (req.TrackId is { } tid)
            existing = await _db.Reposts.FirstOrDefaultAsync(r => r.UserId == userId && r.TrackId == tid, ct);
        else if (req.AlbumId is { } aid)
            existing = await _db.Reposts.FirstOrDefaultAsync(r => r.UserId == userId && r.AlbumId == aid, ct);
        else if (req.PlaylistId is { } pid)
            existing = await _db.Reposts.FirstOrDefaultAsync(r => r.UserId == userId && r.PlaylistId == pid, ct);

        if (existing is not null)
        {
            await _db.Entry(existing).Reference(r => r.User).LoadAsync(ct);
            return Ok(await ToDtoAsync(existing, ct));
        }

        var repost = new Models.Repost
        {
            UserId = userId.Value,
            TrackId = req.TrackId,
            AlbumId = req.AlbumId,
            PlaylistId = req.PlaylistId,
        };

        _db.Reposts.Add(repost);
        await _db.SaveChangesAsync(ct);

        await _db.Entry(repost).Reference(r => r.User).LoadAsync(ct);

        // Notify followers.
        var dto = await ToDtoAsync(repost, ct);
        _ = _notifications.NotifyFollowersOfRepostAsync(userId.Value, repost);

        return CreatedAtAction(nameof(GetMyReposts), null, dto);
    }

    /// <summary>
    /// Delete a repost. Only the author may delete.
    /// </summary>
    [HttpDelete("reposts/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var repost = await _db.Reposts.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId, ct);
        if (repost is null) return NotFound();

        _db.Reposts.Remove(repost);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Get the authenticated user's own reposts.
    /// </summary>
    [HttpGet("reposts")]
    public async Task<ActionResult<IEnumerable<RepostDto>>> GetMyReposts([FromQuery] int limit = 30, CancellationToken ct = default)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        limit = Math.Clamp(limit, 1, 100);
        var reposts = await _db.Reposts
            .Where(r => r.UserId == userId)
            .Include(r => r.User)
            .OrderByDescending(r => r.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);

        var dtos = new List<RepostDto>(reposts.Count);
        foreach (var r in reposts)
            dtos.Add(await ToDtoAsync(r, ct));
        return Ok(dtos);
    }

    /// <summary>
    /// Feed: reposts from users the current user follows, newest first.
    /// </summary>
    [HttpGet("feed")]
    public async Task<ActionResult<IEnumerable<RepostDto>>> GetFeed([FromQuery] int limit = 30, CancellationToken ct = default)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        limit = Math.Clamp(limit, 1, 100);

        var followedIds = await _db.UserFollows
            .Where(f => f.FollowerId == userId)
            .Select(f => f.FolloweeId)
            .ToListAsync(ct);

        if (followedIds.Count == 0)
            return Ok(Array.Empty<RepostDto>());

        var reposts = await _db.Reposts
            .Where(r => followedIds.Contains(r.UserId))
            .Include(r => r.User)
            .OrderByDescending(r => r.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);

        var dtos = new List<RepostDto>(reposts.Count);
        foreach (var r in reposts)
            dtos.Add(await ToDtoAsync(r, ct));
        return Ok(dtos);
    }

    private async Task<RepostDto> ToDtoAsync(Models.Repost r, CancellationToken ct)
    {
        TrackDto? track = null;
        AlbumDto? album = null;
        PlaylistSummaryDto? playlist = null;

        if (r.TrackId is { } tid)
        {
            var t = await _db.Tracks
                .Include(x => x.Artist).Include(x => x.Album).Include(x => x.TrackGenres).ThenInclude(tg => tg.Genre)
                .FirstOrDefaultAsync(x => x.Id == tid, ct);
            if (t is not null) track = await _mapper.ToDtoAsync(t, ct);
        }

        if (r.AlbumId is { } aid)
        {
            var a = await _db.Albums.Include(x => x.Artist).Include(x => x.Tracks).FirstOrDefaultAsync(x => x.Id == aid, ct);
            if (a is not null) album = _mapper.ToDto(a);
        }

        if (r.PlaylistId is { } pid)
        {
            var p = await _db.Playlists.Include(x => x.Owner).Include(x => x.PlaylistTracks).FirstOrDefaultAsync(x => x.Id == pid, ct);
            if (p is not null) playlist = _mapper.ToSummary(p);
        }

        return new RepostDto(r.Id, _mapper.ToRef(r.User), r.TrackId, r.AlbumId, r.PlaylistId, track, album, playlist, r.CreatedAt);
    }
}
