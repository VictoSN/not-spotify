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
        ".mp3",
    };

    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly IStorageService _storage;

    public AdminTracksController(AppDbContext db, MediaMapper mapper, IStorageService storage)
    {
        _db = db;
        _mapper = mapper;
        _storage = storage;
    }

    private IQueryable<Track> BaseQuery() => _db.Tracks
        .Include(t => t.Artist)
        .Include(t => t.Album).ThenInclude(a => a.Artist)
        .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre);

    [HttpPost]
    public async Task<ActionResult<TrackDto>> Create([FromBody] CreateTrackRequest req, CancellationToken ct = default)
    {
        var albumExists = await _db.Albums.AnyAsync(a => a.Id == req.AlbumId, ct);
        if (!albumExists) return BadRequest(new { message = "Album not found." });

        var artistExists = await _db.Artists.AnyAsync(a => a.Id == req.ArtistId, ct);
        if (!artistExists) return BadRequest(new { message = "Artist not found." });

        var track = new Track
        {
            Id = Guid.NewGuid(),
            Title = req.Title,
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
        if (req.ArtistId is not null)
        {
            var exists = await _db.Artists.AnyAsync(a => a.Id == req.ArtistId.Value, ct);
            if (!exists) return BadRequest(new { message = "Artist not found." });
            t.ArtistId = req.ArtistId.Value;
        }
        if (req.AlbumId is not null)
        {
            var exists = await _db.Albums.AnyAsync(a => a.Id == req.AlbumId.Value, ct);
            if (!exists) return BadRequest(new { message = "Album not found." });
            t.AlbumId = req.AlbumId.Value;
        }

        await _db.SaveChangesAsync(ct);

        // Sync both old and new album if album changed
        await SyncAlbumStatsAsync(oldAlbumId, ct);
        if (req.AlbumId is not null && req.AlbumId.Value != oldAlbumId)
            await SyncAlbumStatsAsync(req.AlbumId.Value, ct);
        await _db.SaveChangesAsync(ct);

        var updated = await BaseQuery().FirstAsync(x => x.Id == id, ct);
        return Ok(await _mapper.ToDtoAsync(updated, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var t = await _db.Tracks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();

        var albumId = t.AlbumId;
        _db.Tracks.Remove(t);
        await _db.SaveChangesAsync(ct);
        await SyncAlbumStatsAsync(albumId, ct);
        await _db.SaveChangesAsync(ct);

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
            return BadRequest(new { message = $"Unsupported file type '{ext}'. Only .mp3 is allowed." });

        var key = $"audio/{Guid.NewGuid()}{ext}";
        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(key, stream, file.ContentType ?? "audio/mpeg", ct);

        t.AudioKey = key;
        t.AudioUrl = string.Empty;
        await _db.SaveChangesAsync(ct);

        return Ok(await _mapper.ToDtoAsync(t, ct));
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
