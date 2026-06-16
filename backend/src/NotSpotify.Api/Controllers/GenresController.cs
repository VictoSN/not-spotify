using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("genres")]
public class GenresController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public GenresController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<GenreDto>>> List(CancellationToken ct = default)
    {
        var genres = await _db.Genres.OrderBy(g => g.Name).ToListAsync(ct);
        return Ok(genres.Select(g => _mapper.ToDto(g)));
    }

    [HttpGet("{slug}")]
    public async Task<ActionResult<GenreDto>> Get(string slug, CancellationToken ct = default)
    {
        var g = await _db.Genres.FirstOrDefaultAsync(x => x.Slug == slug, ct);
        return g is null ? NotFound() : Ok(_mapper.ToDto(g));
    }

    [HttpGet("{slug}/tracks")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Tracks(string slug, CancellationToken ct = default)
    {
        var genre = await _db.Genres.FirstOrDefaultAsync(g => g.Slug == slug, ct);
        if (genre is null) return NotFound();

        var tracks = await _db.Tracks
            .Where(t => t.TrackGenres.Any(tg => tg.GenreId == genre.Id))
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .OrderByDescending(t => t.PlayCount)
            .Take(50)
            .ToListAsync(ct);
        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }

    [HttpGet("{slug}/playlists")]
    public async Task<ActionResult<IEnumerable<PlaylistDto>>> Playlists(string slug, CancellationToken ct = default)
    {
        var genre = await _db.Genres.FirstOrDefaultAsync(g => g.Slug == slug, ct);
        if (genre is null) return NotFound();

        var playlistIds = await _db.PlaylistTracks
            .Where(pt => pt.Playlist.IsPublic && pt.Track.TrackGenres.Any(tg => tg.GenreId == genre.Id))
            .GroupBy(pt => pt.PlaylistId)
            .OrderByDescending(g => g.Count())
            .ThenByDescending(g => g.Max(pt => pt.Playlist.UpdatedAt))
            .Take(24)
            .Select(g => g.Key)
            .ToListAsync(ct);

        if (playlistIds.Count == 0) return Ok(Array.Empty<PlaylistDto>());

        var playlists = await _db.Playlists
            .Where(p => playlistIds.Contains(p.Id))
            .Include(p => p.Owner)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Artist)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Album)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.AddedByUser)
            .ToListAsync(ct);

        var byId = playlists.ToDictionary(p => p.Id);
        var ordered = playlistIds
            .Where(byId.ContainsKey)
            .Select(id => byId[id])
            .ToList();

        var dtos = new List<PlaylistDto>(ordered.Count);
        foreach (var playlist in ordered)
            dtos.Add(await _mapper.ToDtoAsync(playlist, ct));

        return Ok(dtos);
    }
}
