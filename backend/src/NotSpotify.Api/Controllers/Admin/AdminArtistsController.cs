using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/artists")]
[Authorize(Roles = "Admin")]
public class AdminArtistsController : ControllerBase
{
    private static readonly HashSet<string> AllowedImageExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp",
    };

    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly IStorageService _storage;
    private readonly TourSyncService _tourSync;
    private readonly SearchIndexSyncService _searchSync;

    public AdminArtistsController(AppDbContext db, MediaMapper mapper, IStorageService storage, TourSyncService tourSync, SearchIndexSyncService searchSync)
    {
        _db = db;
        _mapper = mapper;
        _storage = storage;
        _tourSync = tourSync;
        _searchSync = searchSync;
    }

    /// <summary>Force-refresh cached Ticketmaster tour dates for every artist now (ignores the TTL).</summary>
    [HttpPost("sync-tour")]
    public async Task<ActionResult<object>> SyncAllTour(CancellationToken ct = default)
    {
        var count = await _tourSync.SyncAllAsync(force: true, ct);
        return Ok(new { synced = count });
    }

    /// <summary>Force-refresh cached Ticketmaster tour dates for one artist now (ignores the TTL).</summary>
    [HttpPost("{id:guid}/sync-tour")]
    public async Task<ActionResult<object>> SyncArtistTour(Guid id, CancellationToken ct = default)
    {
        if (!await _db.Artists.AnyAsync(a => a.Id == id, ct)) return NotFound();
        var ran = await _tourSync.SyncArtistAsync(id, force: true, ct);
        return Ok(new { synced = ran });
    }

    [HttpPost]
    public async Task<ActionResult<ArtistDto>> Create([FromBody] CreateArtistRequest req, CancellationToken ct = default)
    {
        var artist = new Artist
        {
            Id = Guid.NewGuid(),
            Name = req.Name,
            SearchText = SearchTextBuilder.ForArtist(req.Name),
            Bio = req.Bio,
            Instagram = req.Instagram,
            Twitter = req.Twitter,
            Website = req.Website,
            Verified = req.Verified,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Artists.Add(artist);
        await _db.SaveChangesAsync(ct);
        await _searchSync.SyncArtistAsync(artist.Id, cascade: false, ct);
        return CreatedAtAction(nameof(Get), new { id = artist.Id }, _mapper.ToDto(artist));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ArtistDto>> Get(Guid id, CancellationToken ct = default)
    {
        var a = await _db.Artists.FirstOrDefaultAsync(x => x.Id == id, ct);
        return a is null ? NotFound() : Ok(_mapper.ToDto(a));
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<ArtistDto>> Update(Guid id, [FromBody] UpdateArtistRequest req, CancellationToken ct = default)
    {
        var a = await _db.Artists.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        var nameChanged = req.Name is not null && req.Name != a.Name;
        if (req.Name is not null) a.Name = req.Name;
        if (req.Bio is not null) a.Bio = req.Bio;
        if (req.Instagram is not null) a.Instagram = req.Instagram;
        if (req.Twitter is not null) a.Twitter = req.Twitter;
        if (req.Website is not null) a.Website = req.Website;
        if (req.Verified is not null) a.Verified = req.Verified.Value;

        a.SearchText = SearchTextBuilder.ForArtist(a.Name);
        // A rename ripples into the albums/tracks that embed this artist's name in
        // their own search blobs — recompute those too so search stays consistent.
        if (nameChanged)
        {
            var albums = await _db.Albums.Where(al => al.ArtistId == id).ToListAsync(ct);
            foreach (var al in albums) al.SearchText = SearchTextBuilder.ForAlbum(al.Title, a.Name);

            var tracks = await _db.Tracks.Where(t => t.ArtistId == id)
                .Include(t => t.Album).ToListAsync(ct);
            foreach (var t in tracks) t.SearchText = SearchTextBuilder.ForTrack(t.Title, a.Name, t.Album?.Title);
        }

        await _db.SaveChangesAsync(ct);
        // A rename also ripples into the ArtistName field on their track/album docs.
        await _searchSync.SyncArtistAsync(id, cascade: nameChanged, ct);
        return Ok(_mapper.ToDto(a));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var a = await _db.Artists.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        var hasAlbums = await _db.Albums.AnyAsync(al => al.ArtistId == id, ct);
        var hasTracks = await _db.Tracks.AnyAsync(t => t.ArtistId == id, ct);
        if (hasAlbums || hasTracks)
            return Conflict(new { message = "Artist has albums or tracks. Delete them first." });

        _db.Artists.Remove(a);
        await _db.SaveChangesAsync(ct);
        await _searchSync.RemoveArtistAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/revoke")]
    public async Task<ActionResult<ArtistDto>> Revoke(Guid id, [FromBody] RevokeArtistRequest req, CancellationToken ct = default)
    {
        var a = await _db.Artists.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        a.IsRevoked = true;
        a.RevocationNote = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim();
        a.RevokedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(a));
    }

    [HttpPost("{id:guid}/reinstate")]
    public async Task<ActionResult<ArtistDto>> Reinstate(Guid id, CancellationToken ct = default)
    {
        var a = await _db.Artists.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        a.IsRevoked = false;
        a.RevocationNote = null;
        a.RevokedAt = null;

        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(a));
    }

    [HttpPost("{id:guid}/image")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<ArtistDto>> UploadImage(Guid id, [FromForm] ArtistImageUploadRequest req, [FromQuery] string type = "profile", CancellationToken ct = default)
    {
        var a = await _db.Artists.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        var file = req.File;
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageExts.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'. Allowed: {string.Join(", ", AllowedImageExts)}" });

        var folder = type == "header" ? "headers" : "images/artists";
        var key = $"{folder}/{Guid.NewGuid()}{ext}";

        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(key, stream, file.ContentType ?? "application/octet-stream", ct);

        if (type == "header")
        {
            a.HeaderImageKey = key;
            a.HeaderImageUrl = null;
        }
        else
        {
            a.ImageKey = key;
            a.ImageUrl = null;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(_mapper.ToDto(a));
    }
}
