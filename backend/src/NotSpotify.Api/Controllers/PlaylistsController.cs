using System.IO.Compression;
using System.Security.Claims;
using System.Text.Json;
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
    private static readonly HashSet<string> AllowedImageExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp",
    };

    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly IStorageService _storage;
    private readonly AudioDownloadService _audioDownloads;
    private readonly SmartPlaylistService _smartPlaylists;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<PlaylistsController> _logger;

    public PlaylistsController(
        AppDbContext db,
        MediaMapper mapper,
        IStorageService storage,
        AudioDownloadService audioDownloads,
        SmartPlaylistService smartPlaylists,
        IHttpClientFactory httpFactory,
        ILogger<PlaylistsController> logger)
    {
        _db = db;
        _mapper = mapper;
        _storage = storage;
        _audioDownloads = audioDownloads;
        _smartPlaylists = smartPlaylists;
        _httpFactory = httpFactory;
        _logger = logger;
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

    [HttpGet("featured")]
    public async Task<ActionResult<IEnumerable<PlaylistSummaryDto>>> Featured([FromQuery] int limit = 24, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 50);
        var me = CurrentUserId();
        var adminRoleId = await _db.Roles
            .Where(r => r.NormalizedName == "ADMIN")
            .Select(r => r.Id)
            .FirstOrDefaultAsync(ct);

        var adminIds = adminRoleId == Guid.Empty
            ? new List<Guid>()
            : await _db.UserRoles
                .Where(ur => ur.RoleId == adminRoleId)
                .Select(ur => ur.UserId)
                .ToListAsync(ct);

        var q = _db.Playlists
            .Where(p => p.IsPublic)
            .Include(p => p.Owner)
            .Include(p => p.PlaylistTracks)
            .AsQueryable();

        if (adminIds.Count > 0)
            q = q.Where(p => adminIds.Contains(p.OwnerId));

        var playlists = await q
            .OrderByDescending(p => p.IsFeatured)
            .ThenBy(p => p.SortOrder)
            .ThenByDescending(p => p.FollowerCount)
            .ThenByDescending(p => p.UpdatedAt)
            .Take(limit)
            .ToListAsync(ct);

        if (playlists.Count == 0 && adminIds.Count > 0)
        {
            playlists = await _db.Playlists
                .Where(p => p.IsPublic)
                .Include(p => p.Owner)
                .Include(p => p.PlaylistTracks)
                .OrderByDescending(p => p.FollowerCount)
                .ThenByDescending(p => p.UpdatedAt)
                .Take(limit)
                .ToListAsync(ct);
        }

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

        // Access control:
        //   public   → anyone
        //   friends  → owner or accepted friend
        //   private  → owner only
        if (!p.IsPublic && p.OwnerId != me)
        {
            if (p.Visibility == "friends" && me != null)
            {
                var isFriend = await _db.Friendships.AnyAsync(f =>
                    f.Status == FriendshipStatus.Accepted &&
                    ((f.RequesterId == me && f.AddresseeId == p.OwnerId) ||
                     (f.AddresseeId == me && f.RequesterId == p.OwnerId)), ct);
                if (!isFriend) return StatusCode(StatusCodes.Status403Forbidden);
            }
            else
            {
                return StatusCode(StatusCodes.Status403Forbidden);
            }
        }

        var isOwner = me != null && p.OwnerId == me;
        var isSaved = me != null && await _db.UserSavedPlaylists.AnyAsync(s => s.UserId == me && s.PlaylistId == id, ct);
        await HydrateSmartTracksAsync(p, ct);
        return Ok(await _mapper.ToDtoAsync(p, ct, isOwner, isSaved));
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<PlaylistDto>> Create([FromBody] CreatePlaylistRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        var rulesError = SmartPlaylistService.Validate(req.SmartRules);
        if (rulesError is not null) return BadRequest(new { message = rulesError });

        var playlist = new Playlist
        {
            Id = Guid.NewGuid(),
            OwnerId = me.Value,
            Name = req.Name,
            Description = req.Description,
            IsPublic = req.IsPublic,
            Visibility = req.IsPublic ? "public" : "private",
            Rules = req.SmartRules is null ? null : SmartPlaylistService.Serialize(req.SmartRules),
        };
        _db.Playlists.Add(playlist);

        // When a cover source URL is provided (playlist created from a track's context
        // menu via "Add to playlist → New playlist"), download the image and store it
        // permanently in our storage so it behaves exactly like a user upload.
        // Sidebar-created playlists send no coverUrl → keep the default artwork.
        if (!string.IsNullOrWhiteSpace(req.CoverUrl))
        {
            var ext = InferImageExt(req.CoverUrl);
            var key = $"covers/playlists/{playlist.Id}/{Guid.NewGuid()}{ext}";
            try
            {
                var http = _httpFactory.CreateClient();
                var imageBytes = await http.GetByteArrayAsync(req.CoverUrl, ct);
                await using var stream = new MemoryStream(imageBytes);
                await _storage.UploadAsync(key, stream, "image/" + ext.TrimStart('.'), ct);
                playlist.CoverKey = key;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to persist cover for playlist {PlaylistId} from {Url} — storing URL reference instead",
                    playlist.Id, req.CoverUrl);
                // Fall back: store the URL as-is so the playlist still has artwork in
                // contexts where the URL is reachable (e.g. the detail page).
                playlist.CoverUrl = req.CoverUrl;
            }
        }

        await _db.SaveChangesAsync(ct);

        var loaded = await LoadFullPlaylist(playlist.Id, ct);
        await HydrateSmartTracksAsync(loaded!, ct);
        return CreatedAtAction(nameof(Get), new { id = playlist.Id }, await _mapper.ToDtoAsync(loaded!, ct, isOwner: true, isSaved: false));
    }

    /// <summary>Guess a safe image file extension from a URL path, defaulting to .jpg.</summary>
    private static string InferImageExt(string url)
    {
        // Parse the path part of the URL, stripping query / fragment.
        var path = url;
        var q = url.IndexOf('?');
        if (q >= 0) path = url[..q];
        var h = path.IndexOf('#');
        if (h >= 0) path = path[..h];

        var ext = Path.GetExtension(path)?.ToLowerInvariant();
        return AllowedImageExts.Contains(ext ?? "") ? ext! : ".jpg";
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

        // Accept either the legacy IsPublic flag or the new 3-state Visibility field.
        if (req.Visibility is not null)
        {
            var vis = req.Visibility.ToLowerInvariant();
            if (vis is not ("public" or "friends" or "private"))
                return BadRequest(new { message = "Visibility must be 'public', 'friends', or 'private'." });
            p.Visibility = vis;
            p.IsPublic = vis == "public";
        }
        else if (req.IsPublic is not null)
        {
            p.IsPublic = req.IsPublic.Value;
            p.Visibility = req.IsPublic.Value ? "public" : "private";
        }

        if (req.CoverUrl is not null) p.CoverUrl = req.CoverUrl;
        if (req.SmartRules is not null)
        {
            var rulesError = SmartPlaylistService.Validate(req.SmartRules);
            if (rulesError is not null) return BadRequest(new { message = rulesError });
            p.Rules = SmartPlaylistService.Serialize(req.SmartRules);
        }
        else if (req.ClearSmartRules)
        {
            p.Rules = null;
        }
        p.UpdatedAt = DateTime.UtcNow;

        // When a playlist transitions from public -> private/friends, revoke everyone else's
        // saved reference so it disappears from their libraries on next refresh.
        if (wasPublic && !p.IsPublic)
        {
            var savedRows = await _db.UserSavedPlaylists.Where(s => s.PlaylistId == id).ToListAsync(ct);
            if (savedRows.Count > 0) _db.UserSavedPlaylists.RemoveRange(savedRows);
        }

        await _db.SaveChangesAsync(ct);

        var loaded = await LoadFullPlaylist(id, ct);
        await HydrateSmartTracksAsync(loaded!, ct);
        return Ok(await _mapper.ToDtoAsync(loaded!, ct, isOwner: true, isSaved: false));
    }

    [HttpPost("{id:guid}/cover")]
    [Authorize]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<PlaylistDto>> UploadCover(Guid id, [FromForm] PlaylistCoverUploadRequest req, CancellationToken ct = default)
    {
        var p = await _db.Playlists.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.OwnerId != CurrentUserId()) return StatusCode(StatusCodes.Status403Forbidden);

        var file = req.File;
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageExts.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'." });

        var oldKey = p.CoverKey;
        var key = $"covers/playlists/{p.Id}/{Guid.NewGuid()}{ext}";

        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(key, stream, file.ContentType ?? "application/octet-stream", ct);

        p.CoverKey = key;
        p.CoverUrl = null;
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(oldKey))
            await _storage.DeleteAsync(oldKey, ct);

        var loaded = await LoadFullPlaylist(id, ct);
        await HydrateSmartTracksAsync(loaded!, ct);
        return Ok(await _mapper.ToDtoAsync(loaded!, ct, isOwner: true, isSaved: false));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var p = await _db.Playlists
            .Include(x => x.PlaylistTracks)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.OwnerId != CurrentUserId()) return StatusCode(StatusCodes.Status403Forbidden);

        var snapshotTracks = p.PlaylistTracks
            .OrderBy(pt => pt.Position)
            .Select(pt => new { pt.TrackId, pt.Position })
            .ToList();
        _db.DeletedPlaylists.Add(new DeletedPlaylist
        {
            Id = Guid.NewGuid(),
            OriginalPlaylistId = p.Id,
            UserId = p.OwnerId,
            Name = p.Name,
            Description = p.Description,
            CoverUrl = p.CoverUrl,
            CoverKey = p.CoverKey,
            IsPublic = p.IsPublic,
            Visibility = p.Visibility,
            Rules = p.Rules,
            TracksJson = JsonSerializer.Serialize(snapshotTracks),
            DeletedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
        });

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
        if (p.Rules is not null)
            return BadRequest(new { message = "Smart playlists are filled automatically. Edit or remove the rules first." });

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
        if (p.Rules is not null)
            return BadRequest(new { message = "Smart playlists are filled automatically. Edit or remove the rules first." });

        var pt = p.PlaylistTracks.FirstOrDefault(x => x.TrackId == trackId);
        if (pt is null) return NotFound();
        _db.PlaylistTracks.Remove(pt);
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Suggests tracks the owner might want to add: other tracks sharing at least one
    /// genre with the playlist's existing tracks. Ranked by genre-overlap count, then
    /// by play count. Empty for empty playlists. Anonymous — UX gates this to owners.
    /// </summary>
    [HttpGet("{id:guid}/recommendations")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Recommendations(Guid id, [FromQuery] int limit = 10, CancellationToken ct = default)
    {
        if (await _db.Playlists.AnyAsync(p => p.Id == id && p.Rules != null, ct))
            return Ok(Array.Empty<TrackDto>());

        var existingTrackIds = await _db.PlaylistTracks
            .Where(pt => pt.PlaylistId == id)
            .Select(pt => pt.TrackId)
            .ToListAsync(ct);

        var genreIds = await _db.TrackGenres
            .Where(tg => existingTrackIds.Contains(tg.TrackId))
            .Select(tg => tg.GenreId)
            .Distinct()
            .ToListAsync(ct);

        if (genreIds.Count == 0) return Ok(Array.Empty<TrackDto>());

        var ranked = await _db.TrackGenres
            .Where(tg => genreIds.Contains(tg.GenreId) && !existingTrackIds.Contains(tg.TrackId))
            .GroupBy(tg => tg.TrackId)
            .Select(g => new { TrackId = g.Key, MatchCount = g.Count() })
            .OrderByDescending(x => x.MatchCount)
            .Take(limit * 4)
            .ToListAsync(ct);

        if (ranked.Count == 0) return Ok(Array.Empty<TrackDto>());

        var trackIds = ranked.Select(r => r.TrackId).ToList();
        var tracks = await _db.Tracks
            .Where(t => trackIds.Contains(t.Id))
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);

        var byId = tracks.ToDictionary(t => t.Id);
        var ordered = ranked
            .Where(r => byId.ContainsKey(r.TrackId))
            .OrderByDescending(r => r.MatchCount)
            .ThenByDescending(r => byId[r.TrackId].PlayCount)
            .Take(limit)
            .Select(r => byId[r.TrackId]);

        return Ok(await _mapper.ToDtoListAsync(ordered, ct));
    }

    [HttpGet("{id:guid}/download-zip")]
    [Authorize]
    public async Task<IActionResult> DownloadZip(
        Guid id,
        CancellationToken ct = default)
    {
        // Premium-only feature
        var uid = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(uid, out var userGuid)) return Unauthorized();
        var caller = await _db.Users.FindAsync(new object[] { userGuid }, ct);
        if (caller is null || caller.Plan != "premium")
            return StatusCode(403, new { message = "A Premium subscription is required to download music." });

        var playlist = await _db.Playlists
            .Include(p => p.Owner)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
        if (playlist is null) return NotFound();
        await HydrateSmartTracksAsync(playlist, ct);

        var ms = new MemoryStream();
        var added = 0;

        var ordered = playlist.PlaylistTracks.OrderBy(pt => pt.AddedAt).Select(pt => pt.Track).ToList();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            for (var i = 0; i < ordered.Count; i++)
            {
                var track = ordered[i];
                // Read uploaded audio via the storage service (disk / authed remote) —
                // never by HTTP-fetching our own public URL, which the server may not
                // be able to reach. Absolute legacy/seeded URLs are fetched directly.
                var audio = await _audioDownloads.FetchAsync(track.AudioKey, track.AudioUrl, ct);
                if (audio is null) continue;

                var safeName = string.Concat(
                    track.Title.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
                var entry = zip.CreateEntry(
                    $"{i + 1:D2} - {safeName}{audio.Extension}",
                    CompressionLevel.NoCompression);
                await using var entryStream = entry.Open();
                await entryStream.WriteAsync(audio.Bytes, ct);
                added++;
            }
        }

        // An empty archive means every fetch failed — surface it instead of
        // handing the user a zip with no songs inside.
        if (added == 0 && ordered.Count > 0)
            return StatusCode(502, new { message = "None of the tracks' audio files could be fetched for download." });

        ms.Position = 0;
        var safeName2 = string.Concat(
            playlist.Name.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
        return File(ms.ToArray(), "application/zip", $"{safeName2}.zip");
    }

    private Task<Playlist?> LoadFullPlaylist(Guid id, CancellationToken ct) => _db.Playlists
        .Include(p => p.Owner)
        .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Artist)
        .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Album)
        .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
        .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.AddedByUser)
        .FirstOrDefaultAsync(p => p.Id == id, ct);

    private async Task HydrateSmartTracksAsync(Playlist playlist, CancellationToken ct)
    {
        if (playlist.Rules is null) return;
        var tracks = await _smartPlaylists.ResolveAsync(playlist.Rules, ct);
        playlist.PlaylistTracks = tracks.Select((track, index) => new PlaylistTrack
        {
            PlaylistId = playlist.Id,
            TrackId = track.Id,
            Track = track,
            Position = index + 1,
            AddedAt = track.CreatedAt,
            AddedByUserId = playlist.OwnerId,
            AddedByUser = playlist.Owner,
        }).ToList();
    }
}
