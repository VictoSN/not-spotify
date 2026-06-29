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
    private readonly AudioDownloadService _audioDownloads;

    public AlbumsController(AppDbContext db, MediaMapper mapper, AudioDownloadService audioDownloads)
    {
        _db = db;
        _mapper = mapper;
        _audioDownloads = audioDownloads;
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

        var ms = new MemoryStream();
        var added = 0;

        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var track in tracks)
            {
                // Read uploaded audio via the storage service (disk / authed remote) —
                // never by HTTP-fetching our own public URL, which the server may not
                // be able to reach. Absolute legacy/seeded URLs are fetched directly.
                var audio = await _audioDownloads.FetchAsync(track.AudioKey, track.AudioUrl, ct);
                if (audio is null) continue;

                var safeName = string.Concat(
                    track.Title.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
                var entry = zip.CreateEntry(
                    $"{track.TrackNumber:D2} - {safeName}{audio.Extension}",
                    CompressionLevel.NoCompression);
                await using var entryStream = entry.Open();
                await entryStream.WriteAsync(audio.Bytes, ct);
                added++;
            }
        }

        // An empty archive means every fetch failed — surface it instead of
        // handing the user a zip with no songs inside.
        if (added == 0 && tracks.Count > 0)
            return StatusCode(502, new { message = "None of the tracks' audio files could be fetched for download." });

        ms.Position = 0;
        var safeAlbum = string.Concat(
            album.Title.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
        return File(ms.ToArray(), "application/zip", $"{safeAlbum}.zip");
    }
}
