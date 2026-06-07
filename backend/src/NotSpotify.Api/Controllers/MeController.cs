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
[Route("me")]
[Authorize]
public class MeController : ControllerBase
{
    private const int MaxRecentSearches = 8;

    private static readonly HashSet<string> AllowedImageExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp",
    };

    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly UserManager<ApplicationUser> _users;
    private readonly IStorageService _storage;

    public MeController(AppDbContext db, MediaMapper mapper, UserManager<ApplicationUser> users, IStorageService storage)
    {
        _db = db;
        _mapper = mapper;
        _users = users;
        _storage = storage;
    }

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    [HttpPatch("profile")]
    public async Task<ActionResult<UserDto>> UpdateProfile([FromBody] UpdateProfileRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user is null) return NotFound();

        if (req.Name is not null)
        {
            var name = req.Name.Trim();
            if (name.Length == 0) return BadRequest(new { message = "Name cannot be empty." });
            user.Name = name;
        }

        if (req.Country is not null)
        {
            var country = req.Country.Trim().ToUpperInvariant();
            if (country.Length != 2) return BadRequest(new { message = "Country must be a two-letter code." });
            user.Country = country;
        }

        if (req.Email is not null)
        {
            var email = req.Email.Trim();
            var existing = await _users.FindByEmailAsync(email);
            if (existing is not null && existing.Id != user.Id)
                return Conflict(new { message = "Email is already in use." });

            if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                var emailResult = await _users.SetEmailAsync(user, email);
                if (!emailResult.Succeeded)
                    return BadRequest(new { errors = emailResult.Errors.Select(e => e.Description) });

                var usernameResult = await _users.SetUserNameAsync(user, email);
                if (!usernameResult.Succeeded)
                    return BadRequest(new { errors = usernameResult.Errors.Select(e => e.Description) });

                user.EmailConfirmed = true;
            }
        }

        var result = await _users.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        var roles = await _users.GetRolesAsync(user);
        return Ok(_mapper.ToUserDto(user, roles));
    }

    [HttpPost("avatar")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<UserDto>> UploadAvatar([FromForm] AvatarUploadRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user is null) return NotFound();

        var file = req.File;
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageExts.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'." });

        var oldKey = user.AvatarKey;
        var key = $"avatars/{user.Id}/{Guid.NewGuid()}{ext}";

        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(key, stream, file.ContentType ?? "application/octet-stream", ct);

        user.AvatarKey = key;
        user.AvatarUrl = null;
        await _users.UpdateAsync(user);

        if (!string.IsNullOrWhiteSpace(oldKey))
            await _storage.DeleteAsync(oldKey, ct);

        var roles = await _users.GetRolesAsync(user);
        return Ok(_mapper.ToUserDto(user, roles));
    }

    [HttpDelete("avatar")]
    public async Task<ActionResult<UserDto>> DeleteAvatar(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user is null) return NotFound();

        var oldKey = user.AvatarKey;
        user.AvatarKey = null;
        user.AvatarUrl = null;
        await _users.UpdateAsync(user);

        if (!string.IsNullOrWhiteSpace(oldKey))
            await _storage.DeleteAsync(oldKey, ct);

        var roles = await _users.GetRolesAsync(user);
        return Ok(_mapper.ToUserDto(user, roles));
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

    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<PlayHistoryDto>>> History([FromQuery] int limit = 50, [FromQuery] int offset = 0, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        limit = Math.Clamp(limit, 1, 100);
        offset = Math.Max(0, offset);

        var rows = await _db.PlayHistories
            .Where(h => h.UserId == me)
            .OrderByDescending(h => h.PlayedAt)
            .Skip(offset)
            .Take(limit)
            .Include(h => h.Track).ThenInclude(t => t.Artist)
            .Include(h => h.Track).ThenInclude(t => t.Album)
            .Include(h => h.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);

        var result = new List<PlayHistoryDto>(rows.Count);
        foreach (var row in rows)
            result.Add(new PlayHistoryDto(await _mapper.ToDtoAsync(row.Track, ct), row.PlayedAt));

        return Ok(result);
    }

    [HttpGet("recent-searches")]
    public async Task<ActionResult<IEnumerable<RecentSearchDto>>> RecentSearches(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var rows = await _db.RecentSearches
            .Where(s => s.UserId == me)
            .OrderByDescending(s => s.SearchedAt)
            .Take(MaxRecentSearches)
            .Select(s => new RecentSearchDto(s.Id, s.Term, s.SearchedAt))
            .ToListAsync(ct);

        return Ok(rows);
    }

    [HttpPost("recent-searches")]
    public async Task<ActionResult<IEnumerable<RecentSearchDto>>> AddRecentSearch([FromBody] RecentSearchRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var term = req.Term.Trim();
        if (term.Length == 0) return BadRequest(new { message = "Search term cannot be empty." });

        var lower = term.ToLower();
        var existing = await _db.RecentSearches
            .FirstOrDefaultAsync(s => s.UserId == me && s.Term.ToLower() == lower, ct);

        if (existing is null)
        {
            _db.RecentSearches.Add(new RecentSearch
            {
                Id = Guid.NewGuid(),
                UserId = me.Value,
                Term = term,
                SearchedAt = DateTime.UtcNow,
            });
        }
        else
        {
            existing.Term = term;
            existing.SearchedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        await PruneRecentSearchesAsync(me.Value, ct);

        return await RecentSearches(ct);
    }

    [HttpDelete("recent-searches/{id:guid}")]
    public async Task<IActionResult> DeleteRecentSearch(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var row = await _db.RecentSearches.FirstOrDefaultAsync(s => s.Id == id && s.UserId == me, ct);
        if (row is null) return NotFound();

        _db.RecentSearches.Remove(row);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("recent-searches")]
    public async Task<IActionResult> ClearRecentSearches(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var rows = await _db.RecentSearches.Where(s => s.UserId == me).ToListAsync(ct);
        _db.RecentSearches.RemoveRange(rows);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ──────────────────────────────────────────────
    // Track ratings
    // ──────────────────────────────────────────────

    /// <summary>Returns all ratings the current user has submitted, as a map of trackId → rating.</summary>
    [HttpGet("ratings")]
    public async Task<ActionResult<Dictionary<Guid, int>>> GetMyRatings(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var rows = await _db.TrackRatings
            .Where(r => r.UserId == me)
            .Select(r => new { r.TrackId, r.Rating })
            .ToListAsync(ct);

        return Ok(rows.ToDictionary(r => r.TrackId, r => r.Rating));
    }

    /// <summary>Upserts the current user's rating for a track (1–5) and updates the track's aggregate.</summary>
    [HttpPut("track-ratings/{trackId:guid}")]
    public async Task<ActionResult<TrackRatingResultDto>> RateTrack(Guid trackId, [FromBody] RateTrackRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        if (req.Rating < 1 || req.Rating > 5)
            return BadRequest(new { message = "Rating must be between 1 and 5." });

        var track = await _db.Tracks.FirstOrDefaultAsync(t => t.Id == trackId, ct);
        if (track is null) return NotFound();

        var existing = await _db.TrackRatings
            .FirstOrDefaultAsync(r => r.UserId == me && r.TrackId == trackId, ct);

        if (existing is null)
        {
            _db.TrackRatings.Add(new TrackRating
            {
                UserId = me.Value,
                TrackId = trackId,
                Rating = req.Rating,
                RatedAt = DateTime.UtcNow,
            });
            track.RatingCount++;
            track.RatingSum += req.Rating;
        }
        else
        {
            track.RatingSum += req.Rating - existing.Rating;
            existing.Rating = req.Rating;
            existing.RatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        var avg = track.RatingCount > 0 ? Math.Round((double)track.RatingSum / track.RatingCount, 1) : 0.0;
        return Ok(new TrackRatingResultDto(track.RatingCount, avg, req.Rating));
    }

    /// <summary>Removes the current user's rating for a track and updates the track's aggregate.</summary>
    [HttpDelete("track-ratings/{trackId:guid}")]
    public async Task<ActionResult<TrackRatingResultDto>> UnrateTrack(Guid trackId, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var existing = await _db.TrackRatings
            .FirstOrDefaultAsync(r => r.UserId == me && r.TrackId == trackId, ct);
        if (existing is null) return NotFound();

        var track = await _db.Tracks.FirstOrDefaultAsync(t => t.Id == trackId, ct);
        if (track is null) return NotFound();

        _db.TrackRatings.Remove(existing);
        track.RatingSum -= existing.Rating;
        track.RatingCount = Math.Max(0, track.RatingCount - 1);
        await _db.SaveChangesAsync(ct);

        var avg = track.RatingCount > 0 ? Math.Round((double)track.RatingSum / track.RatingCount, 1) : 0.0;
        return Ok(new TrackRatingResultDto(track.RatingCount, avg, 0));
    }

    private async Task PruneRecentSearchesAsync(Guid userId, CancellationToken ct)
    {
        var stale = await _db.RecentSearches
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.SearchedAt)
            .Skip(MaxRecentSearches)
            .ToListAsync(ct);

        if (stale.Count == 0) return;

        _db.RecentSearches.RemoveRange(stale);
        await _db.SaveChangesAsync(ct);
    }
}

public record RecordPlayRequest(Guid TrackId);
