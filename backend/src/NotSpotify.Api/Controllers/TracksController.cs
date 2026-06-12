using System.Net.Http.Json;
using System.Security.Claims;
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
    private readonly LyricsService _lyrics;

    public TracksController(AppDbContext db, MediaMapper mapper, LyricsService lyrics)
    {
        _db = db;
        _mapper = mapper;
        _lyrics = lyrics;
    }

    private IQueryable<Models.Track> BaseQuery() => _db.Tracks
        .Where(t => t.Status == "approved")
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

    /// <summary>
    /// Charts: pure ranking by plays in the last 7 days (falls back to all-time
    /// play count as a tiebreaker). Returns rank + weekly play count per entry.
    /// </summary>
    [HttpGet("charts")]
    public async Task<ActionResult<IEnumerable<ChartEntryDto>>> Charts([FromQuery] int limit = 50, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var cutoff = DateTime.UtcNow.AddDays(-7);

        var weeklyCounts = await _db.PlayHistories
            .Where(h => h.PlayedAt >= cutoff)
            .GroupBy(h => h.TrackId)
            .Select(g => new { TrackId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(limit)
            .ToListAsync(ct);

        var ids = weeklyCounts.Select(w => w.TrackId).ToList();
        var tracks = await BaseQuery().Where(t => ids.Contains(t.Id)).ToListAsync(ct);
        var trackById = tracks.ToDictionary(t => t.Id);

        var entries = new List<ChartEntryDto>(weeklyCounts.Count);
        var rank = 1;
        foreach (var w in weeklyCounts)
        {
            if (!trackById.TryGetValue(w.TrackId, out var track)) continue; // unapproved/deleted
            entries.Add(new ChartEntryDto(rank++, w.Count, await _mapper.ToDtoAsync(track, ct)));
        }

        // Pad with all-time top tracks if the week is quiet.
        if (entries.Count < limit)
        {
            var have = entries.Select(e => e.Track.Id).ToHashSet();
            var fillers = await BaseQuery()
                .OrderByDescending(t => t.PlayCount)
                .Take(limit * 2)
                .ToListAsync(ct);
            foreach (var t in fillers.Where(t => !have.Contains(t.Id)).Take(limit - entries.Count))
                entries.Add(new ChartEntryDto(rank++, 0, await _mapper.ToDtoAsync(t, ct)));
        }

        return Ok(entries);
    }

    /// <summary>
    /// Trending: score = (plays in last 7 days × 3) + (all-time play count × 0.01).
    /// Recent activity is weighted 300× more than historical play count to surface
    /// currently popular tracks rather than all-time favourites.
    /// </summary>
    [HttpGet("trending")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Trending([FromQuery] int limit = 10, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 50);
        var cutoff = DateTime.UtcNow.AddDays(-7);

        var recentCounts = await _db.PlayHistories
            .Where(h => h.PlayedAt >= cutoff)
            .GroupBy(h => h.TrackId)
            .Select(g => new { TrackId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var recentMap = recentCounts.ToDictionary(r => r.TrackId, r => r.Count);

        // Fetch a wide pool ordered by all-time plays; re-rank in memory by trending score.
        var pool = await BaseQuery()
            .OrderByDescending(t => t.PlayCount)
            .Take(limit * 8)
            .ToListAsync(ct);

        var ranked = pool
            .OrderByDescending(t => recentMap.GetValueOrDefault(t.Id) * 3.0 + t.PlayCount * 0.01)
            .Take(limit)
            .ToList();

        return Ok(await _mapper.ToDtoListAsync(ranked, ct));
    }

    /// <summary>
    /// Most Liked: tracks with ≥ 2 ratings ranked by a confidence-weighted score.
    /// Score = averageRating × log₂(ratingCount + 1).
    /// The logarithm prevents a single 5-star rating from outranking a track with
    /// 100 ratings averaging 4.8.
    /// </summary>
    [HttpGet("most-liked")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> MostLiked([FromQuery] int limit = 10, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 50);

        var tracks = await BaseQuery()
            .Where(t => t.RatingCount >= 2)
            .ToListAsync(ct);

        var ranked = tracks
            .OrderByDescending(t => (t.RatingSum / (double)t.RatingCount) * Math.Log2(t.RatingCount + 1))
            .Take(limit)
            .ToList();

        return Ok(await _mapper.ToDtoListAsync(ranked, ct));
    }

    /// <summary>
    /// New Music: the most recently added tracks, sorted by creation date descending.
    /// Surfaces catalogue additions before they accumulate play counts.
    /// </summary>
    [HttpGet("new-music")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> NewMusic([FromQuery] int limit = 10, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 50);

        var tracks = await BaseQuery()
            .OrderByDescending(t => t.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);

        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }

    /// <summary>
    /// For You Today: personalised for authenticated users.
    /// Algorithm:
    ///   1. Collect genres of tracks the user played in the last 30 days.
    ///   2. Find tracks that share those genres but weren't recently played.
    ///   3. Rank by genre-overlap count, then by all-time play count.
    /// Falls back to trending for anonymous or first-time users with no history.
    /// </summary>
    [HttpGet("for-you")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> ForYou([FromQuery] int limit = 10, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 50);

        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

        if (rawId is null || !Guid.TryParse(rawId, out var me))
            return await TrendingFallback(limit, ct);

        var cutoff = DateTime.UtcNow.AddDays(-30);
        var recentIds = await _db.PlayHistories
            .Where(h => h.UserId == me && h.PlayedAt >= cutoff)
            .Select(h => h.TrackId)
            .Distinct()
            .ToListAsync(ct);

        if (recentIds.Count == 0)
            return await TrendingFallback(limit, ct);

        var genreIds = await _db.TrackGenres
            .Where(tg => recentIds.Contains(tg.TrackId))
            .Select(tg => tg.GenreId)
            .Distinct()
            .ToListAsync(ct);

        var candidates = await BaseQuery()
            .Where(t => !recentIds.Contains(t.Id) && t.TrackGenres.Any(tg => genreIds.Contains(tg.GenreId)))
            .OrderByDescending(t => t.PlayCount)
            .Take(limit * 4)
            .ToListAsync(ct);

        var ranked = candidates
            .OrderByDescending(t => t.TrackGenres.Count(tg => genreIds.Contains(tg.GenreId)))
            .ThenByDescending(t => t.PlayCount)
            .Take(limit)
            .ToList();

        if (ranked.Count == 0)
            return await TrendingFallback(limit, ct);

        return Ok(await _mapper.ToDtoListAsync(ranked, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TrackDto>> Get(Guid id, CancellationToken ct = default)
    {
        var t = await BaseQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        return t is null ? NotFound() : Ok(await _mapper.ToDtoAsync(t, ct));
    }

    /// <summary>
    /// Returns lyrics for a track. New uploads have lyrics pre-fetched at submission,
    /// so this is usually just a DB read. For legacy tracks without stored lyrics we
    /// fall back to LyricsService (LRCLIB → Lyrics.ovh) and cache the result.
    /// </summary>
    [HttpGet("{id:guid}/lyrics")]
    public async Task<ActionResult<LyricsDto>> GetLyrics(Guid id, CancellationToken ct = default)
    {
        var track = await _db.Tracks
            .Include(t => t.Artist)
            .FirstOrDefaultAsync(t => t.Id == id && t.Status == "approved", ct);

        if (track is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(track.Lyrics))
        {
            // Decide whether to (re)probe LRCLIB for synced lyrics:
            //  - null  → never looked up (pre-synced rows)
            //  - ""    → previously looked up and missed. But the old lookup used
            //            /api/get with strict duration matching and frequently
            //            missed candidates that the new search-based scoring would
            //            find. Re-probe once and update the marker, or upgrade to
            //            a one-time "checked by scoring" sentinel.
            //  - CJK title with non-CJK synced text → poisoned by a romanized
            //            LRCLIB duplicate; the new scoring prefers script match.
            const string ScoredMissMarker = "__none__";
            var neverLookedUp = track.SyncedLyrics is null;
            var oldMissNeedsRecheck = track.SyncedLyrics == "";
            var scriptMismatch = !string.IsNullOrWhiteSpace(track.SyncedLyrics)
                && track.SyncedLyrics != ScoredMissMarker
                && LyricsService.ContainsCjk(track.Title)
                && !LyricsService.ContainsCjk(track.SyncedLyrics);

            if (neverLookedUp || oldMissNeedsRecheck || scriptMismatch)
            {
                var refetched = await _lyrics.TryFetchAsync(track.Artist.Name, track.Title, track.DurationMs, ct);
                if (refetched?.SyncedLyrics is not null) track.SyncedLyrics = refetched.SyncedLyrics;
                else if (neverLookedUp || oldMissNeedsRecheck) track.SyncedLyrics = ScoredMissMarker;
                // script mismatch + no better candidate → keep what we have
            }

            // The timed version is canonical: keep cached plain text derived from it so
            // every consumer sees the same transcription (also repairs rows cached from
            // a different provider lookup, e.g. romanized vs original script).
            var hasReal = !string.IsNullOrWhiteSpace(track.SyncedLyrics) && track.SyncedLyrics != ScoredMissMarker;
            var synced = hasReal ? track.SyncedLyrics : null;
            if (synced is not null)
            {
                var derived = LyricsService.StripLrcTimestamps(synced);
                if (!string.IsNullOrWhiteSpace(derived)) track.Lyrics = derived;
            }

            if (_db.ChangeTracker.HasChanges()) await _db.SaveChangesAsync(ct);
            return Ok(new LyricsDto(track.Lyrics, synced, "stored"));
        }

        var fetched = await _lyrics.TryFetchAsync(track.Artist.Name, track.Title, track.DurationMs, ct);
        if (fetched is not null)
        {
            track.Lyrics = fetched.Lyrics;
            track.SyncedLyrics = fetched.SyncedLyrics ?? "";
            await _db.SaveChangesAsync(ct);
            return Ok(new LyricsDto(track.Lyrics, fetched.SyncedLyrics, fetched.Source));
        }

        return Ok(new LyricsDto(null, null, "not_found"));
    }

    private async Task<ActionResult<IEnumerable<TrackDto>>> TrendingFallback(int limit, CancellationToken ct)
    {
        var tracks = await BaseQuery()
            .OrderByDescending(t => t.PlayCount)
            .Take(limit)
            .ToListAsync(ct);
        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }
}
