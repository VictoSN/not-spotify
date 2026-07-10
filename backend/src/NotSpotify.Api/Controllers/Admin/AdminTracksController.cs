using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/tracks")]
[Authorize(Roles = "Admin")]
public class AdminTracksController : ControllerBase
{
    private static readonly HashSet<string> AllowedAudioExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".opus", ".weba",
    };

    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly NotificationService _notifications;
    private readonly AudioWaveformService _waveforms;
    private readonly SearchIndexSyncService _searchSync;

    public AdminTracksController(
        AppDbContext db,
        MediaMapper mapper,
        NotificationService notifications,
        AudioWaveformService waveforms,
        SearchIndexSyncService searchSync)
    {
        _db = db;
        _mapper = mapper;
        _notifications = notifications;
        _waveforms = waveforms;
        _searchSync = searchSync;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TrackDto>>> List([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var q = BaseQuery().AsQueryable();
        if (status == "rejected")
        {
            var resubmittedIds = await _db.ReviewHistories
                .Where(h => h.EntityType == "track" && h.Action == "rejected")
                .Select(h => h.EntityId)
                .Distinct()
                .ToListAsync(ct);
            q = q.Where(t => t.Status == "rejected" || (t.Status == "pending" && resubmittedIds.Contains(t.Id)));
        }
        else if (!string.IsNullOrEmpty(status))
        {
            q = q.Where(t => t.Status == status);
        }
        var tracks = await q.OrderBy(t => t.Album.Title).ThenBy(t => t.TrackNumber).ToListAsync(ct);
        var dtos = await _mapper.ToDtoListAsync(tracks, ct);
        var ids = tracks.Select(t => t.Id).ToList();
        var saveCounts = await _db.UserSavedTracks
            .Where(s => ids.Contains(s.TrackId))
            .GroupBy(s => s.TrackId)
            .Select(g => new { TrackId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TrackId, x => x.Count, ct);
        return Ok(dtos.Select(d => d with { SavedCount = saveCounts.GetValueOrDefault(d.Id, 0) }));
    }

    private IQueryable<Track> BaseQuery() => _db.Tracks
        .Include(t => t.Artist)
        .Include(t => t.Album).ThenInclude(a => a.Artist)
        .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre);

    [HttpPost]
    public async Task<ActionResult<TrackDto>> Create([FromBody] CreateTrackRequest req, CancellationToken ct = default)
    {
        var album = await _db.Albums.FirstOrDefaultAsync(a => a.Id == req.AlbumId, ct);
        if (album is null) return BadRequest(new { message = "Album not found." });

        var artist = await _db.Artists.FirstOrDefaultAsync(a => a.Id == req.ArtistId, ct);
        if (artist is null) return BadRequest(new { message = "Artist not found." });

        var track = new Track
        {
            Id = Guid.NewGuid(),
            Title = req.Title,
            SearchText = SearchTextBuilder.ForTrack(req.Title, artist.Name, album.Title),
            AlbumId = req.AlbumId,
            ArtistId = req.ArtistId,
            DurationMs = req.DurationMs,
            TrackNumber = req.TrackNumber,
            DiscNumber = req.DiscNumber,
            Explicit = req.Explicit,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Tracks.Add(track);
        await _db.SaveChangesAsync(ct);
        await SyncAlbumStatsAsync(req.AlbumId, ct);
        await _db.SaveChangesAsync(ct);
        await _searchSync.SyncTrackAsync(track.Id, ct);

        var created = await BaseQuery().FirstAsync(t => t.Id == track.Id, ct);
        return CreatedAtAction(nameof(Get), new { id = track.Id }, await _mapper.ToDtoAsync(created, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TrackDto>> Get(Guid id, CancellationToken ct = default)
    {
        var t = await BaseQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        return t is null ? NotFound() : Ok(await _mapper.ToDtoAsync(t, ct));
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<TrackDto>> Update(Guid id, [FromBody] UpdateTrackRequest req, CancellationToken ct = default)
    {
        var t = await BaseQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();

        var oldAlbumId = t.AlbumId;

        if (req.Title is not null) t.Title = req.Title;
        if (req.DurationMs is not null) t.DurationMs = req.DurationMs.Value;
        if (req.TrackNumber is not null) t.TrackNumber = req.TrackNumber.Value;
        if (req.DiscNumber is not null) t.DiscNumber = req.DiscNumber.Value;
        if (req.Explicit is not null) t.Explicit = req.Explicit.Value;

        var artistName = t.Artist.Name;
        var albumTitle = t.Album.Title;
        if (req.ArtistId is not null)
        {
            var artist = await _db.Artists.FirstOrDefaultAsync(a => a.Id == req.ArtistId.Value, ct);
            if (artist is null) return BadRequest(new { message = "Artist not found." });
            t.ArtistId = req.ArtistId.Value;
            artistName = artist.Name;
        }
        if (req.AlbumId is not null)
        {
            var album = await _db.Albums.FirstOrDefaultAsync(a => a.Id == req.AlbumId.Value, ct);
            if (album is null) return BadRequest(new { message = "Album not found." });
            t.AlbumId = req.AlbumId.Value;
            albumTitle = album.Title;
        }

        // Title / artist / album all feed the romanization-aware search blob.
        t.SearchText = SearchTextBuilder.ForTrack(t.Title, artistName, albumTitle);

        await _db.SaveChangesAsync(ct);

        // Sync both old and new album if album changed
        await SyncAlbumStatsAsync(oldAlbumId, ct);
        if (req.AlbumId is not null && req.AlbumId.Value != oldAlbumId)
            await SyncAlbumStatsAsync(req.AlbumId.Value, ct);
        await _db.SaveChangesAsync(ct);
        await _searchSync.SyncTrackAsync(id, ct);

        var updated = await BaseQuery().FirstAsync(x => x.Id == id, ct);
        return Ok(await _mapper.ToDtoAsync(updated, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var t = await _db.Tracks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();

        var albumId = t.AlbumId;
        // PlaylistTracks → Tracks is ON DELETE RESTRICT: remove playlist links
        // first or the delete fails whenever the track sits in any playlist.
        await _db.PlaylistTracks.Where(pt => pt.TrackId == id).ExecuteDeleteAsync(ct);
        _db.Tracks.Remove(t);
        await _db.SaveChangesAsync(ct);
        await SyncAlbumStatsAsync(albumId, ct);
        await _db.SaveChangesAsync(ct);
        await _searchSync.RemoveTrackAsync(id, ct);

        return NoContent();
    }

    [HttpPost("{id:guid}/audio")]
    [RequestSizeLimit(50_000_000)]
    public async Task<ActionResult<TrackDto>> UploadAudio(Guid id, [FromForm] TrackAudioUploadRequest req, CancellationToken ct = default)
    {
        var t = await BaseQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();

        var file = req.File;
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedAudioExts.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'." });

        var key = $"audio/{Guid.NewGuid()}{ext}";
        t.Waveform = await _waveforms.UploadAndExtractAsync(
            file, key, file.ContentType ?? "audio/mpeg", ct);

        t.AudioKey = key;
        t.AudioUrl = string.Empty;
        await _db.SaveChangesAsync(ct);

        return Ok(await _mapper.ToDtoAsync(t, ct));
    }

    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Pending(CancellationToken ct = default)
    {
        var tracks = await BaseQuery()
            .Where(t => t.Status == "pending")
            .OrderBy(t => t.CreatedAt)
            .ToListAsync(ct);
        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }

    [HttpPatch("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var t = await _db.Tracks
            .Include(x => x.Artist)
            .Include(x => x.Album)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();
        if (t.Status != "pending")
            return Conflict(new { message = $"Track is already {t.Status}." });

        t.Status = "approved";
        t.ReviewNote = req?.Note;
        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "track", EntityId = id,
            Action = "approved", Note = req?.Note,
            ReviewedByName = User.FindFirstValue("name"), ReviewedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);
        await _searchSync.SyncTrackAsync(id, ct);

        if (t.SubmittedByUserId is Guid approvedBy)
            await _notifications.NotifyAsync(approvedBy, "approval",
                $"Your track \"{t.Title}\" was approved",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "It's now live." : req!.Note,
                linkUrl: $"/track/{id}", ct: ct);

        await _notifications.NotifyArtistFollowersOfReleaseAsync(
            t.ArtistId,
            t.Artist.Name,
            t.Title,
            "track",
            $"/track/{id}",
            imageUrl: t.Album.CoverUrl,
            excludeUserId: t.SubmittedByUserId,
            ct: ct);

        return NoContent();
    }

    [HttpPatch("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var t = await _db.Tracks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();
        if (t.Status != "pending")
            return Conflict(new { message = $"Track is already {t.Status}." });

        t.Status = "rejected";
        t.ReviewNote = req?.Note;
        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "track", EntityId = id,
            Action = "rejected", Note = req?.Note,
            ReviewedByName = User.FindFirstValue("name"), ReviewedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);
        await _searchSync.SyncTrackAsync(id, ct); // status is no longer approved → drops it from the index

        if (t.SubmittedByUserId is Guid rejectedBy)
            await _notifications.NotifyAsync(rejectedBy, "rejection",
                $"Your track \"{t.Title}\" was rejected",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "Open your dashboard to revise and resubmit." : req!.Note,
                linkUrl: "/artist-dashboard", ct: ct);

        return NoContent();
    }

    [HttpGet("{id:guid}/review-history")]
    public async Task<ActionResult<IEnumerable<ReviewHistoryDto>>> GetReviewHistory(Guid id, CancellationToken ct = default)
    {
        var history = await _db.ReviewHistories
            .Where(h => h.EntityType == "track" && h.EntityId == id)
            .OrderBy(h => h.ReviewedAt)
            .ToListAsync(ct);
        return Ok(history.Select(h => new ReviewHistoryDto(
            h.Id, h.EntityType, h.EntityId, h.Action, h.Note, h.ReviewedByName, h.ReviewedAt)));
    }

    private async Task SyncAlbumStatsAsync(Guid albumId, CancellationToken ct)
    {
        var album = await _db.Albums.FindAsync([albumId], ct);
        if (album is null) return;
        var tracks = await _db.Tracks.Where(t => t.AlbumId == albumId).ToListAsync(ct);
        album.TotalTracks = tracks.Count;
        album.DurationMs = tracks.Sum(t => t.DurationMs);
    }
}
