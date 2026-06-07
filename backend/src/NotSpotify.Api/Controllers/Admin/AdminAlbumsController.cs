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

    public AdminAlbumsController(AppDbContext db, MediaMapper mapper, IStorageService storage)
    {
        _db = db;
        _mapper = mapper;
        _storage = storage;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AlbumDto>>> List(CancellationToken ct = default)
    {
        var albums = await _db.Albums
            .Include(a => a.Artist)
            .OrderByDescending(a => a.ReleaseDate)
            .ToListAsync(ct);
        return Ok(albums.Select(a => _mapper.ToDto(a)));
    }

    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<AlbumDto>>> ListPending(CancellationToken ct = default)
    {
        var albums = await _db.Albums
            .Where(a => a.Status == "pending")
            .Include(a => a.Artist)
            .OrderByDescending(a => a.ReleaseDate)
            .ToListAsync(ct);
        return Ok(albums.Select(a => _mapper.ToDto(a)));
    }

    [HttpPatch("{id:guid}/approve")]
    public async Task<ActionResult<AlbumDto>> Approve(Guid id, CancellationToken ct = default)
    {
        var album = await _db.Albums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return NotFound();
        if (album.Status != "pending")
            return Conflict(new { message = $"Album is already {album.Status}." });

        album.Status = "approved";

        // Approve all pending tracks in this album
        var pendingTracks = await _db.Tracks
            .Where(t => t.AlbumId == id && t.Status == "pending")
            .ToListAsync(ct);
        foreach (var t in pendingTracks)
            t.Status = "approved";

        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(album));
    }

    [HttpPatch("{id:guid}/reject")]
    public async Task<ActionResult<AlbumDto>> Reject(Guid id, CancellationToken ct = default)
    {
        var album = await _db.Albums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return NotFound();
        if (album.Status != "pending")
            return Conflict(new { message = $"Album is already {album.Status}." });

        album.Status = "rejected";

        var pendingTracks = await _db.Tracks
            .Where(t => t.AlbumId == id && t.Status == "pending")
            .ToListAsync(ct);
        foreach (var t in pendingTracks)
            t.Status = "rejected";

        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(album));
    }

    [HttpPost]
    public async Task<ActionResult<AlbumDto>> Create([FromBody] CreateAlbumRequest req, CancellationToken ct = default)
    {
        var artistExists = await _db.Artists.AnyAsync(a => a.Id == req.ArtistId, ct);
        if (!artistExists) return BadRequest(new { message = "Artist not found." });

        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = req.Title,
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

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<AlbumDto>> Update(Guid id, [FromBody] UpdateAlbumRequest req, CancellationToken ct = default)
    {
        var a = await _db.Albums.Include(x => x.Artist).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        if (req.Title is not null) a.Title = req.Title;
        if (req.Type is not null) a.Type = req.Type;
        if (req.ReleaseDate is not null) a.ReleaseDate = req.ReleaseDate.Value;
        if (req.Label is not null) a.Label = req.Label;
        if (req.Copyright is not null) a.Copyright = req.Copyright;
        if (req.ArtistId is not null)
        {
            var artistExists = await _db.Artists.AnyAsync(x => x.Id == req.ArtistId.Value, ct);
            if (!artistExists) return BadRequest(new { message = "Artist not found." });
            a.ArtistId = req.ArtistId.Value;
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

        var hasTracks = await _db.Tracks.AnyAsync(t => t.AlbumId == id, ct);
        if (hasTracks)
            return Conflict(new { message = "Album has tracks. Delete the tracks first." });

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
