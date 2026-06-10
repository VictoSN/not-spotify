using System.IO.Compression;
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
[Route("albums")]
public class AlbumsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly IStorageService _storage;

    public AlbumsController(AppDbContext db, MediaMapper mapper, IStorageService storage)
    {
        _db = db;
        _mapper = mapper;
        _storage = storage;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AlbumDto>>> List(CancellationToken ct = default)
    {
        var albums = await _db.Albums
            .Where(a => a.Status == "approved")
            .Include(a => a.Artist)
            .ToListAsync(ct);
        return Ok(albums.Select(a => _mapper.ToDto(a)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AlbumDto>> Get(Guid id, CancellationToken ct = default)
    {
        var album = await _db.Albums
            .Where(a => a.Status == "approved")
            .Include(a => a.Artist)
            .Include(a => a.Tracks)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return NotFound();

        var genres = await _db.TrackGenres
            .Where(tg => tg.Track.AlbumId == id)
            .Select(tg => tg.Genre.Slug)
            .Distinct()
            .ToListAsync(ct);

        var saveCount = await _db.UserSavedAlbums.CountAsync(s => s.AlbumId == id, ct);
        return Ok(_mapper.ToDto(album, genres, totalSaves: saveCount));
    }

    [HttpGet("{id:guid}/tracks")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Tracks(Guid id, CancellationToken ct = default)
    {
        var tracks = await _db.Tracks
            .Where(t => t.AlbumId == id && t.Status == "approved")
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .OrderBy(t => t.DiscNumber).ThenBy(t => t.TrackNumber)
            .ToListAsync(ct);
        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }

    [HttpGet("{id:guid}/download-zip")]
    [Authorize]
    public async Task<IActionResult> DownloadZip(
        Guid id,
        [FromServices] IHttpClientFactory httpFactory,
        CancellationToken ct = default)
    {
        // Premium-only feature
        var uid = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(uid, out var userGuid)) return Unauthorized();
        var caller = await _db.Users.FindAsync(new object[] { userGuid }, ct);
        if (caller is null || caller.Plan != "premium")
            return StatusCode(403, new { message = "A Premium subscription is required to download music." });

        var album = await _db.Albums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return NotFound();

        var tracks = await _db.Tracks
            .Where(t => t.AlbumId == id)
            .OrderBy(t => t.DiscNumber).ThenBy(t => t.TrackNumber)
            .ToListAsync(ct);

        var http = httpFactory.CreateClient();
        var ms = new MemoryStream();

        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var track in tracks)
            {
                var url = !string.IsNullOrEmpty(track.AudioKey)
                    ? _storage.GetPublicUrl(track.AudioKey)
                    : track.AudioUrl;

                if (string.IsNullOrEmpty(url)) continue;

                // Infer extension from the key/url path (strip query string first)
                var urlPath = url.Split('?')[0];
                var ext = Path.GetExtension(urlPath);
                if (string.IsNullOrEmpty(ext)) ext = ".mp3";

                var safeName = string.Concat(
                    track.Title.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
                var entryName = $"{track.TrackNumber:D2} - {safeName}{ext}";

                try
                {
                    var bytes = await http.GetByteArrayAsync(url, ct);
                    var entry = zip.CreateEntry(entryName, CompressionLevel.NoCompression);
                    await using var entryStream = entry.Open();
                    await entryStream.WriteAsync(bytes, ct);
                }
                catch
                {
                    // Skip tracks whose audio can't be fetched
                }
            }
        }

        ms.Position = 0;
        var safeAlbum = string.Concat(
            album.Title.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
        return File(ms.ToArray(), "application/zip", $"{safeAlbum}.zip");
    }
}
