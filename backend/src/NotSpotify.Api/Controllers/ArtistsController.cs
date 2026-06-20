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

    [HttpGet("popular")]
    public async Task<ActionResult<IEnumerable<ArtistDto>>> Popular([FromQuery] int limit = 10, CancellationToken ct = default)
    {
        var artists = await _db.Artists
            .OrderByDescending(a => a.MonthlyListeners)
            .Take(limit)
            .ToListAsync(ct);
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

    /// <summary>
    /// "Fans also like" — artists whose tracks are played by the same listeners
    /// who play this artist, ranked by co-listen frequency, with shared-genre
    /// artists as a fallback so the section is never empty.
    /// </summary>
    [HttpGet("{id:guid}/related")]
    public async Task<ActionResult<IEnumerable<ArtistDto>>> Related(Guid id, [FromQuery] int limit = 8, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 20);

        if (!await _db.Artists.AnyAsync(a => a.Id == id, ct)) return NotFound();

        // Listeners of this artist's tracks.
        var listeners = await _db.PlayHistories
            .Where(h => h.Track.ArtistId == id)
            .Select(h => h.UserId)
            .Distinct()
            .ToListAsync(ct);

        var scored = new List<Guid>();
        if (listeners.Count > 0)
        {
            scored = await _db.PlayHistories
                .Where(h => listeners.Contains(h.UserId) && h.Track.ArtistId != id)
                .GroupBy(h => h.Track.ArtistId)
                .OrderByDescending(g => g.Select(h => h.UserId).Distinct().Count())
                .ThenByDescending(g => g.Count())
                .Select(g => g.Key)
                .Take(limit)
                .ToListAsync(ct);
        }

        // Fallback / top-up with artists sharing this artist's genres.
        if (scored.Count < limit)
        {
            var genreIds = await _db.TrackGenres
                .Where(tg => tg.Track.ArtistId == id)
                .Select(tg => tg.GenreId)
                .Distinct()
                .ToListAsync(ct);

            var exclude = scored.Append(id).ToHashSet();
            var byGenre = await _db.TrackGenres
                .Where(tg => genreIds.Contains(tg.GenreId) && tg.Track.ArtistId != id)
                .Select(tg => tg.Track.ArtistId)
                .Where(aid => !exclude.Contains(aid))
                .ToListAsync(ct);

            // Most frequently genre-overlapping artists first.
            var ranked = byGenre
                .GroupBy(aid => aid)
                .OrderByDescending(g => g.Count())
                .Select(g => g.Key)
                .Take(limit - scored.Count);
            scored.AddRange(ranked);
        }

        if (scored.Count == 0) return Ok(Array.Empty<ArtistDto>());

        var artists = await _db.Artists.Where(a => scored.Contains(a.Id)).ToListAsync(ct);
        // Preserve the score order (the WHERE above loses it).
        var byId = artists.ToDictionary(a => a.Id);
        var ordered = scored.Where(byId.ContainsKey).Select(aid => byId[aid]);
        return Ok(ordered.Select(a => _mapper.ToDto(a)));
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

    /// <summary>GET /artists/{id}/tour — upcoming concert/tour dates (seeded).</summary>
    [HttpGet("{id:guid}/tour")]
    public async Task<ActionResult<IEnumerable<TourDateDto>>> Tour(Guid id, CancellationToken ct = default)
    {
        var dates = await _db.TourDates
            .Where(t => t.ArtistId == id && t.EventDate >= DateTime.UtcNow)
            .OrderBy(t => t.EventDate)
            .Take(12)
            .ToListAsync(ct);

        return Ok(dates.Select(t => new TourDateDto(
            t.Id.ToString(), t.EventDate, t.City, t.Venue, t.Country, t.TicketUrl)));
    }
}
