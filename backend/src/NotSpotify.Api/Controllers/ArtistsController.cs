using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("artists")]
public class ArtistsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public ArtistsController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ArtistDto>>> List(CancellationToken ct = default)
    {
        var artists = await _db.Artists.ToListAsync(ct);
        return Ok(artists.Select(a => _mapper.ToDto(a)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ArtistDto>> Get(Guid id, CancellationToken ct = default)
    {
        var a = await _db.Artists.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        var genres = await _db.TrackGenres
            .Where(tg => tg.Track.ArtistId == id)
            .Select(tg => tg.Genre.Slug)
            .Distinct()
            .ToListAsync(ct);

        return Ok(_mapper.ToDto(a, genres));
    }

    [HttpGet("{id:guid}/top-tracks")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> TopTracks(Guid id, CancellationToken ct = default)
    {
        var tracks = await _db.Tracks
            .Where(t => t.ArtistId == id)
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .OrderByDescending(t => t.PlayCount)
            .Take(10)
            .ToListAsync(ct);
        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }

    [HttpGet("{id:guid}/albums")]
    public async Task<ActionResult<IEnumerable<AlbumDto>>> Albums(Guid id, CancellationToken ct = default)
    {
        var albums = await _db.Albums
            .Where(a => a.ArtistId == id)
            .Include(a => a.Artist)
            .OrderByDescending(a => a.ReleaseDate)
            .ToListAsync(ct);
        return Ok(albums.Select(a => _mapper.ToDto(a)));
    }
}
