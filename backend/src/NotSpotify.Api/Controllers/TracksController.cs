using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("tracks")]
public class TracksController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public TracksController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    private IQueryable<Models.Track> BaseQuery() => _db.Tracks
        .Include(t => t.Artist)
        .Include(t => t.Album)
        .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TrackDto>>> List([FromQuery] int limit = 50, [FromQuery] int offset = 0, CancellationToken ct = default)
    {
        var tracks = await BaseQuery()
            .OrderByDescending(t => t.PlayCount)
            .Skip(offset).Take(Math.Clamp(limit, 1, 200))
            .ToListAsync(ct);
        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }

    [HttpGet("featured")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Featured(CancellationToken ct = default)
    {
        var tracks = await BaseQuery()
            .OrderByDescending(t => t.PlayCount)
            .Take(12)
            .ToListAsync(ct);
        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TrackDto>> Get(Guid id, CancellationToken ct = default)
    {
        var t = await BaseQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        return t is null ? NotFound() : Ok(await _mapper.ToDtoAsync(t, ct));
    }
}
