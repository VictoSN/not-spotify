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
[Route("admin/albums")]
[Authorize(Roles = "Admin")]
public class AdminAlbumsController : ControllerBase
{
    private static readonly HashSet<string> AllowedImageExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp",
    };

    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly IStorageService _storage;
    private readonly NotificationService _notifications;

    public AdminAlbumsController(AppDbContext db, MediaMapper mapper, IStorageService storage, NotificationService notifications)
    {
        _db = db;
        _mapper = mapper;
        _storage = storage;
        _notifications = notifications;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AlbumDto>>> List([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var q = _db.Albums.Include(a => a.Artist).Include(a => a.Tracks).AsQueryable();
        if (status == "rejected")
        {
            var resubmittedIds = await _db.ReviewHistories
                .Where(h => h.EntityType == "album" && h.Action == "rejected")
                .Select(h => h.EntityId).Distinct().ToListAsync(ct);
            q = q.Where(a => a.Status == "rejected" || (a.Status == "pending" && resubmittedIds.Contains(a.Id)));
        }
        else if (!string.IsNullOrEmpty(status))
        {
            q = q.Where(a => a.Status == status);
        }
        var albums = await q.OrderByDescending(a => a.ReleaseDate).ToListAsync(ct);
        var saveCounts = await AlbumSaveCountsAsync(albums, ct);
        return Ok(albums.Select(a => _mapper.ToDto(a, totalSaves: saveCounts.GetValueOrDefault(a.Id))));
    }

    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<AlbumDto>>> ListPending(CancellationToken ct = default)
    {
        var albums = await _db.Albums
            .Where(a => a.Status == "pending")
            .Include(a => a.Artist)
            .Include(a => a.Tracks)
            .OrderByDescending(a => a.ReleaseDate)
            .ToListAsync(ct);
        var saveCounts = await AlbumSaveCountsAsync(albums, ct);
        return Ok(albums.Select(a => _mapper.ToDto(a, totalSaves: saveCounts.GetValueOrDefault(a.Id))));
    }

    private async Task<Dictionary<Guid, int>> AlbumSaveCountsAsync(List<Album> albums, CancellationToken ct)
    {
        var albumIds = albums.Select(a => a.Id).ToList();
        if (albumIds.Count == 0) return new Dictionary<Guid, int>();

        return await _db.UserSavedAlbums
            .Where(s => albumIds.Contains(s.AlbumId))
            .GroupBy(s => s.AlbumId)
            .Select(g => new { AlbumId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.AlbumId, x => x.Count, ct);
    }

    [HttpPatch("{id:guid}/approve")]
    public async Task<ActionResult<AlbumDto>> Approve(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var album = await _db.Albums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return NotFound();
        if (album.Status != "pending")
            return Conflict(new { message = $"Album is already {album.Status}." });

        album.Status = "approved";
        album.ReviewNote = req?.Note;

        var reviewerName = User.FindFirstValue("name");

        // Approve all pending tracks in this album
        var pendingTracks = await _db.Tracks
            .Where(t => t.AlbumId == id && t.Status == "pending")
            .ToListAsync(ct);
        foreach (var t in pendingTracks)
        {
            t.Status = "approved";
            _db.ReviewHistories.Add(new ReviewHistory
            {
                EntityType = "track", EntityId = t.Id,
                Action = "approved", Note = req?.Note,
                ReviewedByName = reviewerName, ReviewedAt = DateTime.UtcNow,
            });
        }

        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "album", EntityId = id,
            Action = "approved", Note = req?.Note,
            ReviewedByName = reviewerName, ReviewedAt = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync(ct);

        if (album.SubmittedByUserId is Guid approvedSubmitter)
            await _notifications.NotifyAsync(approvedSubmitter, "approval",
                $"Your release \"{album.Title}\" was approved",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "It's now live." : req!.Note,
                linkUrl: $"/album/{id}", ct: ct);

        await _notifications.NotifyArtistFollowersOfReleaseAsync(
            album.ArtistId,
            album.Artist.Name,
            album.Title,
            album.Type,
            $"/album/{id}",
            imageUrl: album.CoverUrl,
            excludeUserId: album.SubmittedByUserId,
            ct: ct);

        return Ok(_mapper.ToDto(album));
    }

    [HttpPatch("{id:guid}/reject")]
    public async Task<ActionResult<AlbumDto>> Reject(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var album = await _db.Albums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return NotFound();
        if (album.Status != "pending")
            return Conflict(new { message = $"Album is already {album.Status}." });

        album.Status = "rejected";
        album.ReviewNote = req?.Note;

        var reviewerName = User.FindFirstValue("name");

        var pendingTracks = await _db.Tracks
            .Where(t => t.AlbumId == id && t.Status == "pending")
            .ToListAsync(ct);
        foreach (var t in pendingTracks)
        {
            t.Status = "rejected";
            t.ReviewNote = req?.Note;
            _db.ReviewHistories.Add(new ReviewHistory
            {
                EntityType = "track", EntityId = t.Id,
                Action = "rejected", Note = req?.Note,
                ReviewedByName = reviewerName, ReviewedAt = DateTime.UtcNow,
            });
        }

        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "album", EntityId = id,
            Action = "rejected", Note = req?.Note,
            ReviewedByName = reviewerName, ReviewedAt = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync(ct);

        if (album.SubmittedByUserId is Guid rejectedSubmitter)
            await _notifications.NotifyAsync(rejectedSubmitter, "rejection",
                $"Your release \"{album.Title}\" was rejected",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "Open your dashboard to revise and resubmit." : req!.Note,
                linkUrl: "/artist-dashboard", ct: ct);

        return Ok(_mapper.ToDto(album));
    }

    [HttpGet("{id:guid}/review-history")]
    public async Task<ActionResult<IEnumerable<ReviewHistoryDto>>> GetReviewHistory(Guid id, CancellationToken ct = default)
    {
        var history = await _db.ReviewHistories
            .Where(h => h.EntityType == "album" && h.EntityId == id)
            .OrderBy(h => h.ReviewedAt)
            .ToListAsync(ct);
        return Ok(history.Select(h => new ReviewHistoryDto(
            h.Id, h.EntityType, h.EntityId, h.Action, h.Note, h.ReviewedByName, h.ReviewedAt)));
    }

    [HttpPost]
    public async Task<ActionResult<AlbumDto>> Create([FromBody] CreateAlbumRequest req, CancellationToken ct = default)
    {
        var artist = await _db.Artists.FirstOrDefaultAsync(a => a.Id == req.ArtistId, ct);
        if (artist is null) return BadRequest(new { message = "Artist not found." });

        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = req.Title,
            SearchText = SearchTextBuilder.ForAlbum(req.Title, artist.Name),
            ArtistId = req.ArtistId,
            Type = req.Type,
            ReleaseDate = req.ReleaseDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Label = req.Label,
            Copyright = req.Copyright,
        };
        _db.Albums.Add(album);
        await _db.SaveChangesAsync(ct);

        var created = await _db.Albums.Include(a => a.Artist).FirstAsync(a => a.Id == album.Id, ct);
        return CreatedAtAction(nameof(Get), new { id = album.Id }, _mapper.ToDto(created));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AlbumDto>> Get(Guid id, CancellationToken ct = default)
    {
        var a = await _db.Albums.Include(x => x.Artist).FirstOrDefaultAsync(x => x.Id == id, ct);
        return a is null ? NotFound() : Ok(_mapper.ToDto(a));
    }

    /// <summary>Returns all tracks for an album regardless of track status — for admin review.</summary>
    [HttpGet("{id:guid}/tracks")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> GetTracks(Guid id, CancellationToken ct = default)
    {
        var albumExists = await _db.Albums.AnyAsync(a => a.Id == id, ct);
        if (!albumExists) return NotFound();

        var tracks = await _db.Tracks
            .Include(t => t.Artist)
            .Include(t => t.Album).ThenInclude(a => a.Artist)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .Where(t => t.AlbumId == id)
            .OrderBy(t => t.TrackNumber)
            .ToListAsync(ct);

        var dtos = await _mapper.ToDtoListAsync(tracks, ct);

        var trackIds = tracks.Select(t => t.Id).ToList();
        var saveCounts = trackIds.Count > 0
            ? await _db.UserSavedTracks
                .Where(s => trackIds.Contains(s.TrackId))
                .GroupBy(s => s.TrackId)
                .Select(g => new { TrackId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.TrackId, x => x.Count, ct)
            : new Dictionary<Guid, int>();

        return Ok(dtos.Select(d => d with { SavedCount = saveCounts.GetValueOrDefault(d.Id, 0) }));
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<AlbumDto>> Update(Guid id, [FromBody] UpdateAlbumRequest req, CancellationToken ct = default)
    {
        var a = await _db.Albums.Include(x => x.Artist).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        var titleChanged = req.Title is not null && req.Title != a.Title;
        if (req.Title is not null) a.Title = req.Title;
        if (req.Type is not null) a.Type = req.Type;
        if (req.ReleaseDate is not null) a.ReleaseDate = req.ReleaseDate.Value;
        if (req.Label is not null) a.Label = req.Label;
        if (req.Copyright is not null) a.Copyright = req.Copyright;

        var artistName = a.Artist?.Name;
        var artistChanged = false;
        if (req.ArtistId is not null)
        {
            var artist = await _db.Artists.FirstOrDefaultAsync(x => x.Id == req.ArtistId.Value, ct);
            if (artist is null) return BadRequest(new { message = "Artist not found." });
            artistChanged = a.ArtistId != req.ArtistId.Value;
            a.ArtistId = req.ArtistId.Value;
            artistName = artist.Name;
        }

        a.SearchText = SearchTextBuilder.ForAlbum(a.Title, artistName);
        // The album title feeds its tracks' search blobs — recompute them on a retitle
        // (artist changes are reflected via the artist controller's own cascade).
        if (titleChanged || artistChanged)
        {
            var tracks = await _db.Tracks.Where(t => t.AlbumId == id)
                .Include(t => t.Artist).ToListAsync(ct);
            foreach (var t in tracks)
                t.SearchText = SearchTextBuilder.ForTrack(t.Title, t.Artist?.Name, a.Title);
        }

        await _db.SaveChangesAsync(ct);

        // Reload to get updated artist nav prop
        var updated = await _db.Albums.Include(x => x.Artist).FirstAsync(x => x.Id == id, ct);
        return Ok(_mapper.ToDto(updated));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var a = await _db.Albums.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        // Cascade: delete the album's tracks too (the frontend confirm dialog
        // spells this out). PlaylistTracks reference Tracks with ON DELETE
        // RESTRICT, so playlist links must be removed explicitly first —
        // otherwise the delete fails with an FK violation. Everything else
        // hanging off Track (ratings, saves, play history, genres) cascades.
        var trackIds = await _db.Tracks
            .Where(t => t.AlbumId == id)
            .Select(t => t.Id)
            .ToListAsync(ct);

        if (trackIds.Count > 0)
        {
            await _db.PlaylistTracks
                .Where(pt => trackIds.Contains(pt.TrackId))
                .ExecuteDeleteAsync(ct);
            await _db.Tracks
                .Where(t => t.AlbumId == id)
                .ExecuteDeleteAsync(ct);
        }

        _db.Albums.Remove(a);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/cover")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<AlbumDto>> UploadCover(Guid id, [FromForm] AlbumCoverUploadRequest req, CancellationToken ct = default)
    {
        var a = await _db.Albums.Include(x => x.Artist).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        var file = req.File;
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageExts.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'. Allowed: {string.Join(", ", AllowedImageExts)}" });

        var key = $"covers/{Guid.NewGuid()}{ext}";
        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(key, stream, file.ContentType ?? "application/octet-stream", ct);

        a.CoverKey = key;
        a.CoverUrl = string.Empty;
        await _db.SaveChangesAsync(ct);

        return Ok(_mapper.ToDto(a));
    }
}
