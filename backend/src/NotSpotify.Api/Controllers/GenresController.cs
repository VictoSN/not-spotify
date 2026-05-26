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
}
