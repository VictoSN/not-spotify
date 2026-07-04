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

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    /// <summary>
    /// User → Artist follow. Stored as a UserFollows edge from the caller to each
    /// user account that owns the artist (Users.ArtistId == artistId), so the
    /// existing NotifyArtistFollowersOfReleaseAsync pipeline notifies us when
    /// the artist publishes anything.
    /// </summary>
    [HttpPost("{id:guid}/follow")]
    [Authorize]
    public async Task<IActionResult> Follow(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        if (!await _db.Artists.AnyAsync(a => a.Id == id, ct)) return NotFound();

        var ownerIds = await _db.Users
            .Where(u => u.ArtistId == id && u.Id != me.Value)
            .Select(u => u.Id)
            .ToListAsync(ct);

        // No-op when the artist isn't tied to a user account — frontend treats
        // the follow as cached locally in that case.
        if (ownerIds.Count == 0) return NoContent();

        var existing = await _db.UserFollows
            .Where(f => f.FollowerId == me.Value && ownerIds.Contains(f.FolloweeId))
            .Select(f => f.FolloweeId)
            .ToListAsync(ct);

        var missing = ownerIds.Except(existing).ToList();
        if (missing.Count > 0)
        {
            _db.UserFollows.AddRange(missing.Select(ownerId => new UserFollow
            {
                FollowerId = me.Value,
                FolloweeId = ownerId,
            }));
            // Bump cached follower count on the artist row to match the existing
            // NotifyArtistFollowersOfReleaseAsync feed model.
            // Tracked-entity update so EF InMemory (used in tests) is happy;
            // the production Postgres provider translates it to a row-level
            // increment under the unit-of-work transaction.
            var artistRow = await _db.Artists.FindAsync(new object[] { id }, ct);
            if (artistRow is not null)
                artistRow.FollowerCount++;
            await _db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpDelete("{id:guid}/follow")]
    [Authorize]
    public async Task<IActionResult> Unfollow(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var ownerIds = await _db.Users
            .Where(u => u.ArtistId == id)
            .Select(u => u.Id)
            .ToListAsync(ct);
        if (ownerIds.Count == 0) return NoContent();

        var rows = await _db.UserFollows
            .Where(f => f.FollowerId == me.Value && ownerIds.Contains(f.FolloweeId))
            .ToListAsync(ct);
        if (rows.Count > 0)
        {
            _db.UserFollows.RemoveRange(rows);
            // Decrement cached follower count — tracked-entity update so EF
            // InMemory (used in tests) is compatible.
            var artistRow = await _db.Artists.FindAsync(new object[] { id }, ct);
            if (artistRow is not null && artistRow.FollowerCount > 0)
                artistRow.FollowerCount--;
            await _db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    /// <summary>Returns the artists the caller follows (derived from UserFollows).</summary>
    [HttpGet("following")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<ArtistDto>>> Following(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var artistIds = await _db.UserFollows
            .Where(f => f.FollowerId == me.Value)
            .Join(_db.Users, f => f.FolloweeId, u => u.Id, (f, u) => u.ArtistId)
            .Where(aid => aid != null)
            .Select(aid => aid!.Value)
            .Distinct()
            .ToListAsync(ct);

        if (artistIds.Count == 0) return Ok(Array.Empty<ArtistDto>());

        var artists = await _db.Artists
            .Where(a => artistIds.Contains(a.Id))
            .ToListAsync(ct);
        return Ok(artists.Select(a => _mapper.ToDto(a)));
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

    /// <summary>
    /// Aggregate upcoming events for the Live Events discovery page. The feed is
    /// backed by the same artist-authored + Ticketmaster-cached rows as artist
    /// profiles, and defaults to the United States market.
    /// </summary>
    [HttpGet("events")]
    public async Task<ActionResult<IEnumerable<LiveEventDto>>> Events(
        [FromQuery] string country = "US",
        [FromQuery] int limit = 80,
        CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 200);
        var normalizedCountry = string.IsNullOrWhiteSpace(country) ? "US" : country.Trim().ToUpperInvariant();

        var query = _db.TourDates.Where(t => t.EventDate >= DateTime.UtcNow);
        // "all" opens the feed to every market — the discovery page filters by
        // city client-side, and the catalogue's tours span many countries.
        if (normalizedCountry != "ALL")
        {
            var acceptedCountries = normalizedCountry switch
            {
                "US" or "USA" or "UNITED STATES" => new[] { "US", "USA", "UNITED STATES" },
                _ => new[] { normalizedCountry },
            };
            query = query.Where(t => acceptedCountries.Contains(t.Country.ToUpper()));
        }

        var dates = await query
            .Include(t => t.Artist)
            .Include(t => t.Setlist).ThenInclude(s => s.Track).ThenInclude(tr => tr.Artist)
            .OrderBy(t => t.EventDate)
            .Take(limit * 2)
            .ToListAsync(ct);

        var artistIds = dates.Select(t => t.ArtistId).Distinct().ToList();
        var genreRows = await _db.TrackGenres
            .Where(tg => artistIds.Contains(tg.Track.ArtistId))
            .Select(tg => new { tg.Track.ArtistId, tg.Genre.Slug })
            .Distinct()
            .ToListAsync(ct);
        var genresByArtist = genreRows
            .GroupBy(row => row.ArtistId)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(row => row.Slug).OrderBy(slug => slug).ToList());

        var seen = new HashSet<(Guid ArtistId, DateTime Day, string Venue)>();
        var result = new List<LiveEventDto>();
        foreach (var date in dates.OrderByDescending(t => t.Source == "artist").ThenBy(t => t.EventDate))
        {
            var key = (date.ArtistId, date.EventDate.Date, date.Venue.Trim().ToLowerInvariant());
            if (!seen.Add(key)) continue;

            var tour = ToDto(date);
            var artistGenres = genresByArtist.GetValueOrDefault(date.ArtistId, Array.Empty<string>());
            var artist = _mapper.ToDto(date.Artist, artistGenres);
            result.Add(new LiveEventDto(
                tour.Id,
                tour.EventDate,
                tour.City,
                tour.Venue,
                tour.Country,
                tour.TicketUrl,
                tour.Songs,
                new LiveEventArtistDto(
                    artist.Id.ToString(),
                    artist.Name,
                    artist.ImageUrl,
                    artist.HeaderImageUrl,
                    artist.MonthlyListeners,
                    artist.Genres.ToList())));
        }

        return Ok(result.OrderBy(item => item.EventDate).Take(limit));
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

    /// <summary>
    /// GET /artists/{id}/tour — upcoming concert/tour dates with setlists.
    /// Served entirely from the database: artist-authored dates plus cached
    /// Ticketmaster events (refreshed in the background by TourSyncService). On a
    /// same-day/venue collision the artist-authored row wins, since it carries the
    /// setlist and the artist's own ticket link.
    /// </summary>
    [HttpGet("{id:guid}/tour")]
    public async Task<ActionResult<IEnumerable<TourDateDto>>> Tour(Guid id, CancellationToken ct = default)
    {
        if (!await _db.Artists.AnyAsync(a => a.Id == id, ct)) return NotFound();

        var dates = await _db.TourDates
            .Where(t => t.ArtistId == id && t.EventDate >= DateTime.UtcNow)
            .OrderBy(t => t.EventDate)
            .Include(t => t.Setlist).ThenInclude(s => s.Track).ThenInclude(tr => tr.Artist)
            .ToListAsync(ct);

        // Artist-authored rows take precedence over a colliding cached TM row.
        var seen = new HashSet<(DateTime, string)>();
        var result = new List<TourDateDto>();
        foreach (var t in dates.OrderByDescending(t => t.Source == "artist").ThenBy(t => t.EventDate))
        {
            if (!seen.Add((t.EventDate.Date, t.Venue.Trim().ToLowerInvariant()))) continue;
            result.Add(ToDto(t));
        }

        return Ok(result.OrderBy(d => d.EventDate).Take(20));
    }

    internal static TourDateDto ToDto(TourDate t) => new(
        t.Id.ToString(), t.EventDate, t.City, t.Venue, t.Country, t.TicketUrl,
        t.Setlist
            .OrderBy(s => s.Position)
            .Select(s => new TourSongDto(s.TrackId.ToString(), s.Track.Title, s.Track.Artist.Name, s.Track.DurationMs))
            .ToList());
}
