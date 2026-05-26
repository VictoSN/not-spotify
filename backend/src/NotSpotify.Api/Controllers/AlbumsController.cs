using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("albums")]
public class AlbumsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public AlbumsController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AlbumDto>>> List(CancellationToken ct = default)
    {
        var albums = await _db.Albums.Include(a => a.Artist).ToListAsync(ct);
        return Ok(albums.Select(a => _mapper.ToDto(a)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AlbumDto>> Get(Guid id, CancellationToken ct = default)
    {
        var album = await _db.Albums.Include(a => a.Artist).FirstOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return NotFound();

        var genres = await _db.TrackGenres
            .Where(tg => tg.Track.AlbumId == id)
            .Select(tg => tg.Genre.Slug)
            .Distinct()
            .ToListAsync(ct);

        return Ok(_mapper.ToDto(album, genres));
    }

    [HttpGet("{id:guid}/tracks")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Tracks(Guid id, CancellationToken ct = default)
    {
        var tracks = await _db.Tracks
            .Where(t => t.AlbumId == id)
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .OrderBy(t => t.DiscNumber).ThenBy(t => t.TrackNumber)
            .ToListAsync(ct);
        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }
}
