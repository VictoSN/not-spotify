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
    private readonly LyricsService _lyrics;
    private readonly ILogger<MeController> _logger;
    private readonly AudioWaveformService _waveforms;

    public MeController(
        AppDbContext db,
        MediaMapper mapper,
        UserManager<ApplicationUser> users,
        IStorageService storage,
        LyricsService lyrics,
        ILogger<MeController> logger,
        AudioWaveformService waveforms)
    {
        _db = db;
        _mapper = mapper;
        _users = users;
        _storage = storage;
        _lyrics = lyrics;
        _logger = logger;
        _waveforms = waveforms;
    }

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    /// <summary>Trim to an upper-case ISO alpha-2 code; empty/blank → null.</summary>
    private static string? NormalizeCountry(string? raw)
    {
        var c = raw?.Trim();
        return string.IsNullOrEmpty(c) ? null : c.ToUpperInvariant();
    }

    private static object UserRefExport(ApplicationUser? user) => user is null
        ? new { id = (Guid?)null, name = (string?)null }
        : new { id = (Guid?)user.Id, name = (string?)user.Name };

    private static object TrackExport(Track track) => new
    {
        track.Id,
        track.Title,
        track.DurationMs,
        track.TrackNumber,
        track.DiscNumber,
        track.Explicit,
        track.PlayCount,
        track.RatingCount,
        AverageRating = track.RatingCount == 0 ? 0 : Math.Round(track.RatingSum / (double)track.RatingCount, 2),
        track.Status,
        Artist = new { track.ArtistId, track.Artist.Name },
        Album = new { track.AlbumId, track.Album.Title },
        Genres = track.TrackGenres
            .OrderBy(tg => tg.Genre.Name)
            .Select(tg => new { tg.GenreId, tg.Genre.Name, tg.Genre.Slug }),
    };

    [HttpGet("export")]
    public async Task<IActionResult> Export(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == me.Value, ct);
        if (user is null) return NotFound();

        var ownedPlaylists = await _db.Playlists
            .AsNoTracking()
            .Where(p => p.OwnerId == me.Value)
            .OrderByDescending(p => p.UpdatedAt)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Artist)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Album)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);

        var savedPlaylists = await _db.UserSavedPlaylists
            .AsNoTracking()
            .Where(s => s.UserId == me.Value)
            .OrderByDescending(s => s.SavedAt)
            .Include(s => s.Playlist).ThenInclude(p => p.Owner)
            .ToListAsync(ct);

        var savedTracks = await _db.UserSavedTracks
            .AsNoTracking()
            .Where(s => s.UserId == me.Value)
            .OrderByDescending(s => s.SavedAt)
            .Include(s => s.Track).ThenInclude(t => t.Artist)
            .Include(s => s.Track).ThenInclude(t => t.Album)
            .Include(s => s.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);

        var savedAlbums = await _db.UserSavedAlbums
            .AsNoTracking()
            .Where(s => s.UserId == me.Value)
            .OrderByDescending(s => s.SavedAt)
            .Include(s => s.Album).ThenInclude(a => a.Artist)
            .ToListAsync(ct);

        var ratings = await _db.TrackRatings
            .AsNoTracking()
            .Where(r => r.UserId == me.Value)
            .OrderByDescending(r => r.RatedAt)
            .Include(r => r.Track).ThenInclude(t => t.Artist)
            .Include(r => r.Track).ThenInclude(t => t.Album)
            .Include(r => r.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);

        var uploads = await _db.UserUploads
            .AsNoTracking()
            .Where(u => u.UserId == me.Value)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync(ct);

        var history = await _db.PlayHistories
            .AsNoTracking()
            .Where(h => h.UserId == me.Value)
            .OrderByDescending(h => h.PlayedAt)
            .Include(h => h.Track).ThenInclude(t => t.Artist)
            .Include(h => h.Track).ThenInclude(t => t.Album)
            .Include(h => h.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);

        var recentSearches = await _db.RecentSearches
            .AsNoTracking()
            .Where(s => s.UserId == me.Value)
            .OrderByDescending(s => s.SearchedAt)
            .ToListAsync(ct);

        var notifications = await _db.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == me.Value)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync(ct);

        var friendships = await _db.Friendships
            .AsNoTracking()
            .Where(f => f.RequesterId == me.Value || f.AddresseeId == me.Value)
            .OrderByDescending(f => f.UpdatedAt)
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .ToListAsync(ct);

        var follows = await _db.UserFollows
            .AsNoTracking()
            .Where(f => f.FollowerId == me.Value || f.FolloweeId == me.Value)
            .OrderByDescending(f => f.CreatedAt)
            .Include(f => f.Follower)
            .Include(f => f.Followee)
            .ToListAsync(ct);

        var userEmail = user.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var planMemberships = await _db.PlanMemberships
            .AsNoTracking()
            .Where(m => m.OwnerId == me.Value || m.MemberId == me.Value || m.InvitedEmail == userEmail)
            .OrderByDescending(m => m.CreatedAt)
            .Include(m => m.Owner)
            .Include(m => m.Member)
            .ToListAsync(ct);

        var windowStart = DateTime.UtcNow.Date.AddDays(-29);
        var plays30 = history.Where(h => h.PlayedAt >= windowStart).ToList();

        var export = new
        {
            GeneratedAt = DateTime.UtcNow,
            Account = new
            {
                user.Id,
                user.Name,
                user.Email,
                user.Country,
                user.Plan,
                user.PlanTier,
                user.PlanOwnerId,
                user.CreatedAt,
                user.LastSeenAt,
                user.StripeSubscriptionStatus,
                user.StripeBillingInterval,
                user.StripeCurrentPeriodEnd,
                user.StripeCancelAtPeriodEnd,
                Roles = await _users.GetRolesAsync(user),
            },
            ListeningStats = new
            {
                Days = 30,
                TotalPlays = plays30.Count,
                TotalMinutes = (int)Math.Round(plays30.Sum(p => p.Track.DurationMs) / 60000.0),
                UniqueTracks = plays30.Select(p => p.TrackId).Distinct().Count(),
                UniqueArtists = plays30.Select(p => p.Track.ArtistId).Distinct().Count(),
            },
            Library = new
            {
                OwnedPlaylists = ownedPlaylists.Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Description,
                    p.Visibility,
                    p.IsPublic,
                    p.IsFeatured,
                    p.SortOrder,
                    p.Rules,
                    p.FollowerCount,
                    p.CreatedAt,
                    p.UpdatedAt,
                    Tracks = p.PlaylistTracks
                        .OrderBy(pt => pt.Position)
                        .Select(pt => new { pt.Position, pt.AddedAt, pt.AddedByUserId, Track = TrackExport(pt.Track) }),
                }),
                SavedPlaylists = savedPlaylists.Select(s => new
                {
                    s.SavedAt,
                    Playlist = new
                    {
                        s.Playlist.Id,
                        s.Playlist.Name,
                        s.Playlist.Description,
                        s.Playlist.Visibility,
                        s.Playlist.IsPublic,
                        Owner = UserRefExport(s.Playlist.Owner),
                    },
                }),
                SavedTracks = savedTracks.Select(s => new { s.SavedAt, Track = TrackExport(s.Track) }),
                SavedAlbums = savedAlbums.Select(s => new
                {
                    s.SavedAt,
                    Album = new
                    {
                        s.Album.Id,
                        s.Album.Title,
                        s.Album.Type,
                        s.Album.ReleaseDate,
                        s.Album.TotalTracks,
                        s.Album.DurationMs,
                        s.Album.Country,
                        Artist = new { s.Album.ArtistId, s.Album.Artist.Name },
                    },
                }),
                Ratings = ratings.Select(r => new { r.TrackId, r.Rating, r.RatedAt, Track = TrackExport(r.Track) }),
                Uploads = uploads.Select(u => new
                {
                    u.Id,
                    u.Title,
                    u.Artist,
                    u.DurationMs,
                    u.AudioKey,
                    HasExternalAudioUrl = !string.IsNullOrWhiteSpace(u.AudioUrl),
                    u.CreatedAt,
                }),
            },
            ListeningHistory = history.Select(h => new { h.PlayedAt, Track = TrackExport(h.Track) }),
            RecentSearches = recentSearches.Select(s => new { s.Id, s.Term, s.SearchedAt }),
            Notifications = notifications.Select(n => new
            {
                n.Id,
                n.Type,
                n.Title,
                n.Body,
                n.LinkUrl,
                n.ImageUrl,
                n.IsRead,
                n.CreatedAt,
            }),
            Social = new
            {
                Friendships = friendships.Select(f => new
                {
                    f.Id,
                    Status = f.Status.ToString().ToLowerInvariant(),
                    f.CreatedAt,
                    f.UpdatedAt,
                    Requester = UserRefExport(f.Requester),
                    Addressee = UserRefExport(f.Addressee),
                }),
                Follows = follows.Select(f => new
                {
                    f.Id,
                    f.CreatedAt,
                    Follower = UserRefExport(f.Follower),
                    Followee = UserRefExport(f.Followee),
                }),
            },
            SharedPlans = planMemberships.Select(m => new
            {
                m.Id,
                m.Status,
                m.InvitedEmail,
                m.CreatedAt,
                m.AcceptedAt,
                Owner = UserRefExport(m.Owner),
                Member = UserRefExport(m.Member),
            }),
        };

        return Ok(export);
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

        try
        {
            await using var stream = file.OpenReadStream();
            await _storage.UploadAsync(key, stream, file.ContentType ?? "application/octet-stream", ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Avatar upload failed for user {UserId}", user.Id);
            return StatusCode(500, new { message = $"Upload failed: {ex.Message}" });
        }

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

        // Verify track exists
        if (!await _db.Tracks.AnyAsync(t => t.Id == req.TrackId, ct)) return NotFound();

        // Atomic increment via raw SQL — avoids EF change-tracking races.
        await _db.Database.ExecuteSqlRawAsync(
            @"UPDATE ""Tracks"" SET ""PlayCount"" = ""PlayCount"" + 1 WHERE ""Id"" = {0}", req.TrackId);

        _db.PlayHistories.Add(new PlayHistory
        {
            Id = Guid.NewGuid(),
            UserId = me.Value,
            TrackId = req.TrackId,
            PlayedAt = DateTime.UtcNow,
        });

        // Update LastSeenAt so friends can see this user is online.
        var player = await _db.Users.FindAsync(new object[] { me.Value }, ct);
        if (player is not null)
            player.LastSeenAt = DateTime.UtcNow;

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

    /// <summary>
    /// Personal listening stats ("mini-Wrapped") over a rolling window.
    /// Aggregates the caller's PlayHistories into totals, top tracks/artists/genres,
    /// and a per-day play count for the trend chart. Minutes are estimated by summing
    /// each played track's duration (assumes plays are roughly complete).
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<ListeningStatsDto>> Stats([FromQuery] int days = 30, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        days = Math.Clamp(days, 1, 365);
        var since = DateTime.UtcNow.Date.AddDays(-(days - 1));

        // Pull the window's plays with just the fields we aggregate on.
        var plays = await _db.PlayHistories
            .Where(h => h.UserId == me && h.PlayedAt >= since)
            .Select(h => new
            {
                h.TrackId,
                h.PlayedAt,
                h.Track.DurationMs,
                ArtistId = h.Track.ArtistId,
                ArtistName = h.Track.Artist.Name,
                Genres = h.Track.TrackGenres.Select(tg => tg.Genre.Name),
            })
            .ToListAsync(ct);

        if (plays.Count == 0)
            return Ok(new ListeningStatsDto(
                days, 0, 0, 0, 0,
                Array.Empty<StatTrackDto>(),
                Array.Empty<StatArtistDto>(),
                Array.Empty<StatGenreDto>(),
                Array.Empty<StatDayDto>()));

        var totalPlays = plays.Count;
        var totalMinutes = (int)Math.Round(plays.Sum(p => p.DurationMs) / 60000.0);
        var uniqueTracks = plays.Select(p => p.TrackId).Distinct().Count();
        var uniqueArtists = plays.Select(p => p.ArtistId).Distinct().Count();

        // Top tracks by play count.
        var topTrackIds = plays
            .GroupBy(p => p.TrackId)
            .Select(g => new { TrackId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(10)
            .ToList();
        var trackEntities = await _db.Tracks
            .Where(t => topTrackIds.Select(x => x.TrackId).Contains(t.Id))
            .Include(t => t.Artist).Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);
        var trackById = trackEntities.ToDictionary(t => t.Id);
        var topTracks = new List<StatTrackDto>();
        foreach (var x in topTrackIds)
            if (trackById.TryGetValue(x.TrackId, out var t))
                topTracks.Add(new StatTrackDto(await _mapper.ToDtoAsync(t, ct), x.Count));

        // Top artists by play count.
        var topArtists = plays
            .GroupBy(p => new { p.ArtistId, p.ArtistName })
            .Select(g => new StatArtistDto(g.Key.ArtistId.ToString(), g.Key.ArtistName, g.Count()))
            .OrderByDescending(a => a.PlayCount)
            .Take(10)
            .ToList();

        // Top genres by play count (a play counts once per genre it carries).
        var topGenres = plays
            .SelectMany(p => p.Genres)
            .GroupBy(name => name)
            .Select(g => new StatGenreDto(g.Key, g.Count()))
            .OrderByDescending(g => g.PlayCount)
            .Take(6)
            .ToList();

        // Per-day play counts, dense across the whole window (zero-filled).
        var playsByDay = plays
            .GroupBy(p => p.PlayedAt.Date)
            .ToDictionary(g => g.Key, g => g.Count());
        var byDay = Enumerable.Range(0, days)
            .Select(i => since.AddDays(i))
            .Select(d => new StatDayDto(d.ToString("yyyy-MM-dd"), playsByDay.GetValueOrDefault(d)))
            .ToList();

        return Ok(new ListeningStatsDto(
            days, totalPlays, totalMinutes, uniqueTracks, uniqueArtists,
            topTracks, topArtists, topGenres, byDay));
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
    // Artist applications
    // ──────────────────────────────────────────────

    [HttpGet("artist-application")]
    public async Task<ActionResult<ArtistApplicationDto>> GetArtistApplication(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var app = await _db.ArtistApplications
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.UserId == me, ct);
        if (app is null) return NotFound();

        return Ok(ToApplicationDto(app));
    }

    [HttpPost("artist-application")]
    public async Task<ActionResult<ArtistApplicationDto>> SubmitArtistApplication(
        [FromBody] SubmitArtistApplicationRequest req,
        CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var existing = await _db.ArtistApplications
            .AnyAsync(a => a.UserId == me && a.Status != "rejected", ct);
        if (existing)
            return Conflict(new { message = "You already have an active or approved application." });

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user is null) return Unauthorized();

        var app = new ArtistApplication
        {
            Id = Guid.NewGuid(),
            UserId = me.Value,
            DisplayName = req.DisplayName,
            Bio = req.Bio,
            SampleWorkUrl = req.SampleWorkUrl,
            SubmittedAt = DateTime.UtcNow,
        };
        _db.ArtistApplications.Add(app);
        await _db.SaveChangesAsync(ct);

        app.User = user;
        return Ok(ToApplicationDto(app));
    }

    private static ArtistApplicationDto ToApplicationDto(ArtistApplication a) => new(
        a.Id, a.UserId, a.User.Name, a.User.Email ?? string.Empty,
        a.DisplayName, a.Bio, a.SampleWorkUrl,
        a.Status, a.SubmittedAt, a.ReviewedAt, a.ReviewNote
    );

    // ──────────────────────────────────────────────
    // Artist — album management (Artist role required)
    // ──────────────────────────────────────────────

    [HttpPost("artist-albums")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<AlbumDto>> SubmitArtistAlbum(
        [FromBody] ArtistSubmitAlbumRequest req,
        CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var artist = await _db.Artists.FindAsync([user.ArtistId.Value], ct);
        if (artist is { IsRevoked: true })
            return Forbid();

        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = req.Title,
            Type = req.Type,
            ArtistId = user.ArtistId.Value,
            ReleaseDate = req.ReleaseDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Label = req.Label,
            Copyright = req.Copyright,
            Country = NormalizeCountry(req.Country),
            Status = "pending",
            SubmittedByUserId = me.Value,
            CoverUrl = string.Empty,
        };
        _db.Albums.Add(album);
        await _db.SaveChangesAsync(ct);

        var created = await _db.Albums.Include(a => a.Artist).FirstAsync(a => a.Id == album.Id, ct);
        return Ok(_mapper.ToDto(created));
    }

    [HttpPost("artist-albums/{id:guid}/cover")]
    [Authorize(Roles = "Artist")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<AlbumDto>> UploadArtistAlbumCover(Guid id, [FromForm] AlbumCoverUploadRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var album = await _db.Albums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a => a.Id == id && a.ArtistId == user.ArtistId, ct);
        if (album is null) return NotFound();

        var file = req.File;
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageExts.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'. Allowed: jpg, jpeg, png, webp" });

        var key = $"covers/{Guid.NewGuid()}{ext}";
        try
        {
            await using var stream = file.OpenReadStream();
            await _storage.UploadAsync(key, stream, file.ContentType ?? "application/octet-stream", ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Album cover upload failed for album {AlbumId}", album.Id);
            return StatusCode(500, new { message = $"Upload failed: {ex.Message}" });
        }

        album.CoverKey = key;
        album.CoverUrl = string.Empty;
        await _db.SaveChangesAsync(ct);

        return Ok(_mapper.ToDto(album));
    }

    // ──────────────────────────────────────────────
    // Artist — track management (Artist role required)
    // ──────────────────────────────────────────────

    /// <summary>
    /// Time-series + headline stats for the signed-in artist's dashboard chart:
    /// plays per day over a window, plus totals and the artist's top tracks.
    /// </summary>
    [HttpGet("artist-stats")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<ArtistStatsDto>> ArtistStats([FromQuery] int days = 14, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();
        var artistId = user.ArtistId.Value;

        days = Math.Clamp(days, 7, 90);
        var since = DateTime.UtcNow.Date.AddDays(-(days - 1));

        var trackIds = await _db.Tracks.Where(t => t.ArtistId == artistId).Select(t => t.Id).ToListAsync(ct);

        // Plays per day across all the artist's tracks (zero-filled).
        var playRows = await _db.PlayHistories
            .Where(h => trackIds.Contains(h.TrackId) && h.PlayedAt >= since)
            .Select(h => h.PlayedAt)
            .ToListAsync(ct);
        var byDayMap = playRows.GroupBy(p => p.Date).ToDictionary(g => g.Key, g => g.Count());
        var byDay = Enumerable.Range(0, days)
            .Select(i => since.AddDays(i))
            .Select(d => new StatDayDto(d.ToString("yyyy-MM-dd"), byDayMap.GetValueOrDefault(d)))
            .ToList();

        // Top tracks by all-time play count.
        var topTrackEntities = await _db.Tracks
            .Where(t => t.ArtistId == artistId)
            .Include(t => t.Artist).Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .OrderByDescending(t => t.PlayCount)
            .Take(5)
            .ToListAsync(ct);
        var topTracks = new List<StatTrackDto>();
        foreach (var t in topTrackEntities)
            topTracks.Add(new StatTrackDto(await _mapper.ToDtoAsync(t, ct), (int)t.PlayCount));

        var totalPlays = await _db.Tracks.Where(t => t.ArtistId == artistId).SumAsync(t => (long)t.PlayCount, ct);
        var playsInWindow = byDay.Sum(d => d.Count);
        var followers = await _db.Artists.Where(a => a.Id == artistId).Select(a => a.FollowerCount).FirstOrDefaultAsync(ct);

        return Ok(new ArtistStatsDto(days, totalPlays, playsInWindow, followers, byDay, topTracks));
    }

    [HttpGet("artist-tracks")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> GetArtistTracks(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var tracks = await _db.Tracks
            .Where(t => t.ArtistId == user.ArtistId)
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var dtos = await _mapper.ToDtoListAsync(tracks, ct);
        var ids = tracks.Select(t => t.Id).ToList();
        var saveCounts = await _db.UserSavedTracks
            .Where(s => ids.Contains(s.TrackId))
            .GroupBy(s => s.TrackId)
            .Select(g => new { TrackId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TrackId, x => x.Count, ct);

        return Ok(dtos.Select(d => d with { SavedCount = saveCounts.GetValueOrDefault(d.Id, 0) }));
    }

    [HttpPost("artist-tracks")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<TrackDto>> SubmitArtistTrack(
        [FromBody] ArtistSubmitTrackRequest req,
        CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var artist = await _db.Artists.FindAsync([user.ArtistId.Value], ct);
        if (artist is { IsRevoked: true })
            return Forbid();

        var album = await _db.Albums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a => a.Id == req.AlbumId && a.ArtistId == user.ArtistId, ct);
        if (album is null) return BadRequest(new { message = "Album not found or does not belong to your artist profile." });

        // Genre is required so the track is discoverable (browse / mixes / recommendations).
        var genreIds = (req.GenreIds ?? Array.Empty<Guid>()).Distinct().ToList();
        var validGenreIds = genreIds.Count == 0
            ? new List<Guid>()
            : await _db.Genres.Where(g => genreIds.Contains(g.Id)).Select(g => g.Id).ToListAsync(ct);
        if (validGenreIds.Count == 0)
            return BadRequest(new { message = "Select at least one genre for the track." });

        var track = new Track
        {
            Id = Guid.NewGuid(),
            Title = req.Title,
            SearchText = SearchTextBuilder.ForTrack(req.Title, artist?.Name ?? album.Artist?.Name, album.Title),
            AlbumId = req.AlbumId,
            ArtistId = user.ArtistId.Value,
            DurationMs = req.DurationMs,
            TrackNumber = req.TrackNumber,
            DiscNumber = req.DiscNumber,
            Explicit = req.Explicit,
            Lyrics = string.IsNullOrWhiteSpace(req.Lyrics) ? null : req.Lyrics.Trim(),
            Status = "pending",
            SubmittedByUserId = me.Value,
            AudioUrl = string.Empty,
            CreatedAt = DateTime.UtcNow,
        };
        foreach (var gid in validGenreIds)
            track.TrackGenres.Add(new TrackGenre { TrackId = track.Id, GenreId = gid });
        _db.Tracks.Add(track);
        await _db.SaveChangesAsync(ct);

        // Pre-fetch lyrics so they're ready by the time a listener opens the page.
        // Only when the artist didn't paste their own; failures are silently ignored.
        if (track.Lyrics is null && artist is not null)
        {
            var fetched = await _lyrics.TryFetchAsync(artist.Name, track.Title, track.DurationMs, ct);
            if (fetched is not null)
            {
                track.Lyrics = fetched.Lyrics;
                track.SyncedLyrics = fetched.SyncedLyrics ?? "";
                await _db.SaveChangesAsync(ct);
            }
        }

        var created = await _db.Tracks
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .FirstAsync(t => t.Id == track.Id, ct);
        return Ok(await _mapper.ToDtoAsync(created, ct));
    }

    [HttpPost("artist-tracks/{id:guid}/audio")]
    [Authorize(Roles = "Artist")]
    [RequestSizeLimit(50_000_000)]
    public async Task<ActionResult<TrackDto>> UploadArtistTrackAudio(Guid id, [FromForm] TrackAudioUploadRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var track = await _db.Tracks
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .FirstOrDefaultAsync(t => t.Id == id && t.SubmittedByUserId == me, ct);
        if (track is null) return NotFound();

        var file = req.File;
        if (file is null || file.Length == 0) return BadRequest(new { message = "No file provided." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowedAudio = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { ".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".opus", ".weba" };
        if (!allowedAudio.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'." });

        var key = $"audio/{Guid.NewGuid()}{ext}";
        try
        {
            track.Waveform = await _waveforms.UploadAndExtractAsync(
                file, key, file.ContentType ?? "audio/mpeg", ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Track audio upload failed for track {TrackId}", track.Id);
            return StatusCode(500, new { message = $"Upload failed: {ex.Message}" });
        }

        track.AudioKey = key;
        track.AudioUrl = string.Empty;
        await _db.SaveChangesAsync(ct);

        return Ok(await _mapper.ToDtoAsync(track, ct));
    }

    [HttpGet("artist-profile")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<ArtistDto>> GetArtistProfile(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var artist = await _db.Artists.FirstOrDefaultAsync(a => a.Id == user.ArtistId, ct);
        if (artist is null) return NotFound();

        return Ok(_mapper.ToDto(artist));
    }

    [HttpPatch("artist-profile")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<ArtistDto>> UpdateArtistProfile([FromBody] ArtistUpdateProfileRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();
        var artist = await _db.Artists.FirstOrDefaultAsync(a => a.Id == user.ArtistId, ct);
        if (artist is null) return NotFound();

        if (req.Name is not null) artist.Name = req.Name.Trim();
        if (req.Bio is not null) artist.Bio = req.Bio == "" ? null : req.Bio;
        if (req.Instagram is not null) artist.Instagram = req.Instagram == "" ? null : req.Instagram;
        if (req.Twitter is not null) artist.Twitter = req.Twitter == "" ? null : req.Twitter;
        if (req.Website is not null) artist.Website = req.Website == "" ? null : req.Website;
        if (req.Country is not null) artist.Country = NormalizeCountry(req.Country);

        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(artist));
    }

    [HttpPost("artist-profile/image")]
    [Authorize(Roles = "Artist")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<ArtistDto>> UploadArtistProfileImage(
        [FromForm] ArtistImageUploadRequest req,
        [FromQuery] string type = "profile",
        CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();
        var artist = await _db.Artists.FirstOrDefaultAsync(a => a.Id == user.ArtistId, ct);
        if (artist is null) return NotFound();

        var file = req.File;
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        string[] allowed = [".jpg", ".jpeg", ".png", ".webp"];
        if (!allowed.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'." });

        var folder = type == "header" ? "headers" : "images/artists";
        var key = $"{folder}/{Guid.NewGuid()}{ext}";
        try
        {
            await using var stream = file.OpenReadStream();
            await _storage.UploadAsync(key, stream, file.ContentType ?? "application/octet-stream", ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Artist image upload failed for artist {ArtistId}", artist.Id);
            return StatusCode(500, new { message = $"Upload failed: {ex.Message}" });
        }

        if (type == "header")
        {
            artist.HeaderImageKey = key;
            artist.HeaderImageUrl = null;
        }
        else
        {
            artist.ImageKey = key;
            artist.ImageUrl = null;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(artist));
    }

    // ──────────────────────────────────────────────
    // Artist — tour / concert management (Artist role required)
    // ──────────────────────────────────────────────

    /// <summary>GET /me/artist-tour — the signed-in artist's own dates (incl. past) with setlists, for management.</summary>
    [HttpGet("artist-tour")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<IEnumerable<TourDateDto>>> GetArtistTour(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var dates = await _db.TourDates
            .Where(t => t.ArtistId == user.ArtistId)
            .OrderBy(t => t.EventDate)
            .Include(t => t.Setlist).ThenInclude(s => s.Track).ThenInclude(tr => tr.Artist)
            .ToListAsync(ct);

        return Ok(dates.Select(ArtistsController.ToDto));
    }

    /// <summary>POST /me/artist-tour — announce a new show.</summary>
    [HttpPost("artist-tour")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<TourDateDto>> CreateArtistTourDate([FromBody] TourDateUpsertRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();
        var artist = await _db.Artists.FindAsync([user.ArtistId.Value], ct);
        if (artist is { IsRevoked: true }) return Forbid();

        if (string.IsNullOrWhiteSpace(req.City) || string.IsNullOrWhiteSpace(req.Venue))
            return BadRequest(new { message = "City and venue are required." });

        var date = new TourDate
        {
            Id = Guid.NewGuid(),
            ArtistId = user.ArtistId.Value,
            EventDate = req.EventDate.ToUniversalTime(),
            City = req.City.Trim(),
            Venue = req.Venue.Trim(),
            Country = NormalizeCountry(req.Country) ?? string.Empty,
            TicketUrl = NormalizeUrl(req.TicketUrl),
        };
        _db.TourDates.Add(date);
        await _db.SaveChangesAsync(ct);

        return Ok(ArtistsController.ToDto(date));
    }

    /// <summary>PUT /me/artist-tour/{id} — edit / reschedule a show.</summary>
    [HttpPut("artist-tour/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<TourDateDto>> UpdateArtistTourDate(Guid id, [FromBody] TourDateUpsertRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var date = await _db.TourDates
            .Include(t => t.Setlist).ThenInclude(s => s.Track).ThenInclude(tr => tr.Artist)
            .FirstOrDefaultAsync(t => t.Id == id && t.ArtistId == user.ArtistId, ct);
        if (date is null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.City) || string.IsNullOrWhiteSpace(req.Venue))
            return BadRequest(new { message = "City and venue are required." });

        date.EventDate = req.EventDate.ToUniversalTime();
        date.City = req.City.Trim();
        date.Venue = req.Venue.Trim();
        date.Country = NormalizeCountry(req.Country) ?? string.Empty;
        date.TicketUrl = NormalizeUrl(req.TicketUrl);
        await _db.SaveChangesAsync(ct);

        return Ok(ArtistsController.ToDto(date));
    }

    /// <summary>DELETE /me/artist-tour/{id} — cancel a show (cascades the setlist).</summary>
    [HttpDelete("artist-tour/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<IActionResult> DeleteArtistTourDate(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var date = await _db.TourDates.FirstOrDefaultAsync(t => t.Id == id && t.ArtistId == user.ArtistId, ct);
        if (date is null) return NotFound();

        _db.TourDates.Remove(date);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>PUT /me/artist-tour/{id}/setlist — replace the show's setlist with these of the artist's own tracks, in order.</summary>
    [HttpPut("artist-tour/{id:guid}/setlist")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<TourDateDto>> SetArtistTourSetlist(Guid id, [FromBody] TourSetlistRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var date = await _db.TourDates
            .Include(t => t.Setlist)
            .FirstOrDefaultAsync(t => t.Id == id && t.ArtistId == user.ArtistId, ct);
        if (date is null) return NotFound();

        // Parse + de-dup requested ids, preserving order.
        var requested = new List<Guid>();
        foreach (var raw in req.TrackIds ?? [])
            if (Guid.TryParse(raw, out var g) && !requested.Contains(g)) requested.Add(g);

        // Keep only the artist's own existing tracks (a setlist is your own songs).
        var validSet = (await _db.Tracks
            .Where(t => requested.Contains(t.Id) && t.ArtistId == user.ArtistId)
            .Select(t => t.Id)
            .ToListAsync(ct)).ToHashSet();

        _db.TourDateTracks.RemoveRange(date.Setlist);
        var pos = 0;
        foreach (var tid in requested)
            if (validSet.Contains(tid))
                _db.TourDateTracks.Add(new TourDateTrack { TourDateId = date.Id, TrackId = tid, Position = pos++ });

        await _db.SaveChangesAsync(ct);

        var fresh = await _db.TourDates
            .Include(t => t.Setlist).ThenInclude(s => s.Track).ThenInclude(tr => tr.Artist)
            .FirstAsync(t => t.Id == id, ct);
        return Ok(ArtistsController.ToDto(fresh));
    }

    /// <summary>Trim a user-supplied URL and ensure it has an http(s) scheme, or null when empty.</summary>
    private static string? NormalizeUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        var u = url.Trim();
        if (!u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !u.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            u = "https://" + u;
        return u;
    }

    [HttpGet("artist-albums/{id:guid}/review-history")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<IEnumerable<ReviewHistoryDto>>> GetArtistAlbumHistory(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        // Verify ownership
        var owns = await _db.Albums.AnyAsync(a => a.Id == id && a.ArtistId == user.ArtistId, ct);
        if (!owns) return NotFound();

        var history = await _db.ReviewHistories
            .Where(h => h.EntityType == "album" && h.EntityId == id)
            .OrderBy(h => h.ReviewedAt)
            .ToListAsync(ct);
        return Ok(history.Select(h => new ReviewHistoryDto(
            h.Id, h.EntityType, h.EntityId, h.Action, h.Note, h.ReviewedByName, h.ReviewedAt)));
    }

    [HttpGet("artist-tracks/{id:guid}/review-history")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<IEnumerable<ReviewHistoryDto>>> GetArtistTrackHistory(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var owns = await _db.Tracks.AnyAsync(t => t.Id == id && t.ArtistId == user.ArtistId, ct);
        if (!owns) return NotFound();

        var history = await _db.ReviewHistories
            .Where(h => h.EntityType == "track" && h.EntityId == id)
            .OrderBy(h => h.ReviewedAt)
            .ToListAsync(ct);
        return Ok(history.Select(h => new ReviewHistoryDto(
            h.Id, h.EntityType, h.EntityId, h.Action, h.Note, h.ReviewedByName, h.ReviewedAt)));
    }

    [HttpGet("artist-albums")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<IEnumerable<AlbumDto>>> GetArtistAlbums(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var albums = await _db.Albums
            .Where(a => a.ArtistId == user.ArtistId)
            .Include(a => a.Artist)
            .Include(a => a.Tracks)
            .OrderByDescending(a => a.ReleaseDate)
            .ToListAsync(ct);

        var albumIds = albums.Select(a => a.Id).ToList();
        var albumSaves = albumIds.Count > 0
            ? await _db.UserSavedAlbums
                .Where(s => albumIds.Contains(s.AlbumId))
                .GroupBy(s => s.AlbumId)
                .Select(g => new { AlbumId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.AlbumId, x => x.Count, ct)
            : new Dictionary<Guid, int>();

        return Ok(albums.Select(a => _mapper.ToDto(a, totalSaves: albumSaves.GetValueOrDefault(a.Id))));
    }

    [HttpPatch("artist-albums/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<AlbumDto>> UpdateArtistAlbum(Guid id, [FromBody] ArtistUpdateAlbumRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var album = await _db.Albums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a => a.Id == id && a.ArtistId == user.ArtistId, ct);
        if (album is null) return NotFound();
        if (album.Status == "approved")
            return Conflict(new { message = "Cannot edit an approved release." });

        if (req.Title is not null) album.Title = req.Title;
        if (req.Type is not null) album.Type = req.Type;
        if (req.ReleaseDate.HasValue) album.ReleaseDate = req.ReleaseDate.Value;
        if (req.Label is not null) album.Label = req.Label;
        if (req.Copyright is not null) album.Copyright = req.Copyright;
        if (req.Country is not null) album.Country = NormalizeCountry(req.Country);

        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(album));
    }

    [HttpDelete("artist-albums/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<IActionResult> DeleteArtistAlbum(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var album = await _db.Albums
            .Include(a => a.Tracks)
            .FirstOrDefaultAsync(a => a.Id == id && a.ArtistId == user.ArtistId, ct);
        if (album is null) return NotFound();
        if (album.Status == "approved")
            return Conflict(new { message = "Cannot delete an approved release." });

        _db.Tracks.RemoveRange(album.Tracks);
        _db.Albums.Remove(album);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("artist-tracks/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<TrackDto>> UpdateArtistTrack(Guid id, [FromBody] ArtistUpdateTrackRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var track = await _db.Tracks
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .FirstOrDefaultAsync(t => t.Id == id && t.ArtistId == user.ArtistId, ct);
        if (track is null) return NotFound();

        var titleChanged = req.Title is not null && req.Title != track.Title;

        if (req.TrackNumber.HasValue) track.TrackNumber = req.TrackNumber.Value;
        if (req.Title is not null) track.Title = req.Title;
        if (req.Explicit.HasValue) track.Explicit = req.Explicit.Value;
        if (titleChanged) track.SearchText = SearchTextBuilder.ForTrack(track.Title, track.Artist?.Name, track.Album?.Title);
        // Lyrics can be set or cleared (empty string → null)
        if (req.Lyrics is not null)
            track.Lyrics = string.IsNullOrWhiteSpace(req.Lyrics) ? null : req.Lyrics.Trim();

        // Replace genres only when the client sends a set (omitting GenreIds leaves them untouched).
        if (req.GenreIds is not null)
        {
            var genreIds = req.GenreIds.Distinct().ToList();
            var validGenreIds = genreIds.Count == 0
                ? new List<Guid>()
                : await _db.Genres.Where(g => genreIds.Contains(g.Id)).Select(g => g.Id).ToListAsync(ct);
            if (validGenreIds.Count == 0)
                return BadRequest(new { message = "Select at least one genre for the track." });
            _db.TrackGenres.RemoveRange(track.TrackGenres);
            foreach (var gid in validGenreIds)
                _db.TrackGenres.Add(new TrackGenre { TrackId = track.Id, GenreId = gid });
        }

        await _db.SaveChangesAsync(ct);

        // If title changed and lyrics ended up empty, try to fetch fresh lyrics
        // for the new title (common case: artist corrects a romanized title to the
        // original script so LRCLIB can find the song).
        if (titleChanged && string.IsNullOrWhiteSpace(track.Lyrics))
        {
            var fetched = await _lyrics.TryFetchAsync(track.Artist.Name, track.Title, track.DurationMs, ct);
            if (fetched is not null)
            {
                track.Lyrics = fetched.Lyrics;
                track.SyncedLyrics = fetched.SyncedLyrics ?? "";
                await _db.SaveChangesAsync(ct);
            }
        }

        // Re-load so the response reflects the (possibly replaced) genres with their slugs.
        var updated = await _db.Tracks
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .FirstAsync(t => t.Id == track.Id, ct);
        return Ok(await _mapper.ToDtoAsync(updated, ct));
    }

    [HttpDelete("artist-tracks/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<IActionResult> DeleteArtistTrack(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var track = await _db.Tracks
            .FirstOrDefaultAsync(t => t.Id == id && t.ArtistId == user.ArtistId, ct);
        if (track is null) return NotFound();
        if (track.Status == "approved")
            return Conflict(new { message = "Cannot delete a live track." });

        _db.Tracks.Remove(track);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("artist-albums/{id:guid}/resubmit")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<AlbumDto>> ResubmitArtistAlbum(Guid id, [FromBody] ResubmitRequest? req = null, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var artist = await _db.Artists.FindAsync([user.ArtistId.Value], ct);
        if (artist is { IsRevoked: true })
            return Forbid();

        var album = await _db.Albums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a => a.Id == id && a.ArtistId == user.ArtistId, ct);
        if (album is null) return NotFound();
        if (album.Status != "rejected")
            return Conflict(new { message = "Only rejected releases can be resubmitted." });

        album.Status = "pending";
        // ReviewNote intentionally preserved so artist retains rejection history

        var artistName = User.FindFirstValue("name");
        var resubmitNote = string.IsNullOrWhiteSpace(req?.Note) ? null : req.Note.Trim();

        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "album", EntityId = id,
            Action = "resubmitted", Note = resubmitNote,
            ReviewedByName = artistName, ReviewedAt = DateTime.UtcNow,
        });

        // Also resubmit rejected tracks in this album
        var rejectedTracks = await _db.Tracks
            .Where(t => t.AlbumId == id && t.Status == "rejected")
            .ToListAsync(ct);
        foreach (var t in rejectedTracks)
        {
            t.Status = "pending";
            // ReviewNote intentionally preserved
            _db.ReviewHistories.Add(new ReviewHistory
            {
                EntityType = "track", EntityId = t.Id,
                Action = "resubmitted", Note = resubmitNote,
                ReviewedByName = artistName, ReviewedAt = DateTime.UtcNow,
            });
        }

        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(album));
    }

    [HttpPost("artist-tracks/{id:guid}/resubmit")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<TrackDto>> ResubmitArtistTrack(Guid id, [FromBody] ResubmitRequest? req = null, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return Forbid();

        var artistForTrack = await _db.Artists.FindAsync([user.ArtistId.Value], ct);
        if (artistForTrack is { IsRevoked: true })
            return Forbid();

        var track = await _db.Tracks
            .Include(t => t.Artist)
            .Include(t => t.Album).ThenInclude(a => a.Artist)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .FirstOrDefaultAsync(t => t.Id == id && t.ArtistId == user.ArtistId, ct);
        if (track is null) return NotFound();
        if (track.Status != "rejected")
            return Conflict(new { message = "Only rejected tracks can be resubmitted." });

        track.Status = "pending";
        // ReviewNote intentionally preserved so artist retains rejection history

        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "track", EntityId = id,
            Action = "resubmitted",
            Note = string.IsNullOrWhiteSpace(req?.Note) ? null : req.Note.Trim(),
            ReviewedByName = User.FindFirstValue("name"), ReviewedAt = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync(ct);
        return Ok(await _mapper.ToDtoAsync(track, ct));
    }

    // ──────────────────────────────────────────────
    // Saved tracks (liked songs)
    // ──────────────────────────────────────────────

    [HttpGet("saved-tracks")]
    public async Task<ActionResult<IEnumerable<SavedTrackDto>>> GetSavedTracks(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var rows = await _db.UserSavedTracks
            .Where(s => s.UserId == me)
            .OrderByDescending(s => s.SavedAt)
            .Include(s => s.Track).ThenInclude(t => t.Artist)
            .Include(s => s.Track).ThenInclude(t => t.Album)
            .Include(s => s.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);

        var dtos = new List<SavedTrackDto>(rows.Count);
        foreach (var row in rows)
            dtos.Add(new SavedTrackDto(await _mapper.ToDtoAsync(row.Track, ct), row.SavedAt));

        return Ok(dtos);
    }

    [HttpPost("saved-tracks/{trackId:guid}")]
    public async Task<IActionResult> SaveTrack(Guid trackId, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var trackExists = await _db.Tracks.AnyAsync(t => t.Id == trackId, ct);
        if (!trackExists) return NotFound();

        var existing = await _db.UserSavedTracks
            .FirstOrDefaultAsync(s => s.UserId == me && s.TrackId == trackId, ct);
        if (existing is not null) return NoContent();

        _db.UserSavedTracks.Add(new UserSavedTrack
        {
            UserId = me.Value,
            TrackId = trackId,
            SavedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("saved-tracks/{trackId:guid}")]
    public async Task<IActionResult> UnsaveTrack(Guid trackId, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var row = await _db.UserSavedTracks
            .FirstOrDefaultAsync(s => s.UserId == me && s.TrackId == trackId, ct);
        if (row is null) return NotFound();

        _db.UserSavedTracks.Remove(row);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ──────────────────────────────────────────────
    // Track ratings
    // ──────────────────────────────────────────────
    // Saved albums
    // ──────────────────────────────────────────────

    [HttpGet("saved-albums")]
    public async Task<ActionResult<IEnumerable<AlbumDto>>> GetSavedAlbums(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var rows = await _db.UserSavedAlbums
            .Where(s => s.UserId == me)
            .OrderByDescending(s => s.SavedAt)
            .Include(s => s.Album).ThenInclude(a => a.Artist)
            .Include(s => s.Album).ThenInclude(a => a.Tracks)
            .ToListAsync(ct);

        var albumIds = rows.Select(r => r.AlbumId).ToList();
        var saveCounts = albumIds.Count > 0
            ? await _db.UserSavedAlbums
                .Where(s => albumIds.Contains(s.AlbumId))
                .GroupBy(s => s.AlbumId)
                .Select(g => new { AlbumId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.AlbumId, x => x.Count, ct)
            : new Dictionary<Guid, int>();

        return Ok(rows.Select(r => _mapper.ToDto(r.Album, totalSaves: saveCounts.GetValueOrDefault(r.AlbumId))));
    }

    [HttpPost("saved-albums/{albumId:guid}")]
    public async Task<IActionResult> SaveAlbum(Guid albumId, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var exists = await _db.Albums.AnyAsync(a => a.Id == albumId && a.Status == "approved", ct);
        if (!exists) return NotFound();

        if (await _db.UserSavedAlbums.AnyAsync(s => s.UserId == me && s.AlbumId == albumId, ct))
            return NoContent();

        _db.UserSavedAlbums.Add(new Models.UserSavedAlbum { UserId = me.Value, AlbumId = albumId });
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("saved-albums/{albumId:guid}")]
    public async Task<IActionResult> UnsaveAlbum(Guid albumId, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var row = await _db.UserSavedAlbums.FirstOrDefaultAsync(s => s.UserId == me && s.AlbumId == albumId, ct);
        if (row is null) return NoContent();
        _db.UserSavedAlbums.Remove(row);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

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
