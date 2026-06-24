using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
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
    private readonly AudioDownloadService _audioDownloads;

    public TracksController(
        AppDbContext db,
        MediaMapper mapper,
        LyricsService lyrics,
        AudioDownloadService audioDownloads)
    {
        _db = db;
        _mapper = mapper;
        _lyrics = lyrics;
        _audioDownloads = audioDownloads;
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

    [HttpGet("{id:guid}/download")]
    [Authorize]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct = default)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdValue, out var userId)) return Unauthorized();

        var caller = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (caller is null) return Unauthorized();

        var track = await _db.Tracks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, ct);
        if (track is null) return NotFound();

        var canManage = User.IsInRole("Admin") || caller.ArtistId == track.ArtistId;
        if (!canManage && track.Status != "approved") return NotFound();
        if (!canManage && caller.Plan != "premium")
            return StatusCode(403, new { message = "A Premium subscription is required to download music." });

        var audio = await _audioDownloads.FetchAsync(track.AudioKey, track.AudioUrl, ct);
        if (audio is null)
            return StatusCode(502, new { message = "The track's audio file could not be fetched for download." });

        var safeTitle = string.Concat(
            track.Title.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
        if (string.IsNullOrWhiteSpace(safeTitle)) safeTitle = "track";
        return File(audio.Bytes, audio.ContentType, $"{safeTitle}{audio.Extension}");
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
    /// Popular in a country: ranks approved tracks by plays from users located in
    /// that country over the last 30 days (join PlayHistories → user.Country),
    /// with a small boost for tracks whose artist/album is from that market.
    /// `country` is an ISO alpha-2 code; when omitted it falls back to the caller's
    /// country (or "US"). Pads with market content, then global top tracks.
    /// </summary>
    [HttpGet("popular")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Popular(
        [FromQuery] string? country = null,
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 50);

        if (string.IsNullOrWhiteSpace(country))
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (Guid.TryParse(uid, out var userId))
                country = await _db.Users.Where(u => u.Id == userId).Select(u => u.Country).FirstOrDefaultAsync(ct);
        }
        country = string.IsNullOrWhiteSpace(country) ? "US" : country.Trim().ToUpperInvariant();

        var cutoff = DateTime.UtcNow.AddDays(-30);

        // Plays by users located in this country.
        var countryCounts = await _db.PlayHistories
            .Where(h => h.PlayedAt >= cutoff && h.User.Country == country)
            .GroupBy(h => h.TrackId)
            .Select(g => new { TrackId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(limit * 4)
            .ToListAsync(ct);

        var countMap = countryCounts.ToDictionary(c => c.TrackId, c => c.Count);
        var ids = countryCounts.Select(c => c.TrackId).ToList();

        var ranked = new List<Models.Track>();
        if (ids.Count > 0)
        {
            var tracks = await BaseQuery().Where(t => ids.Contains(t.Id)).ToListAsync(ct);
            ranked = tracks
                // +0.5 boost when the artist or album is tagged to this market.
                .OrderByDescending(t => countMap.GetValueOrDefault(t.Id)
                    + (t.Artist.Country == country || t.Album.Country == country ? 0.5 : 0))
                .ThenByDescending(t => t.PlayCount)
                .Take(limit)
                .ToList();
        }

        // Pad: first with content tagged to this market, then global top tracks.
        if (ranked.Count < limit)
        {
            var have = ranked.Select(t => t.Id).ToHashSet();
            var fromMarket = await BaseQuery()
                .Where(t => (t.Artist.Country == country || t.Album.Country == country) && !have.Contains(t.Id))
                .OrderByDescending(t => t.PlayCount)
                .Take(limit - ranked.Count)
                .ToListAsync(ct);
            ranked.AddRange(fromMarket);

            if (ranked.Count < limit)
            {
                have = ranked.Select(t => t.Id).ToHashSet();
                var fillers = await BaseQuery()
                    .Where(t => !have.Contains(t.Id))
                    .OrderByDescending(t => t.PlayCount)
                    .Take(limit - ranked.Count)
                    .ToListAsync(ct);
                ranked.AddRange(fillers);
            }
        }

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

    /// <summary>
    /// Builds an endless "station" seeded from a track. The seed's genres are the
    /// "bubble": every candidate must share a genre with the seed (or be by the same
    /// artist, which is the same bubble), so the station never jumps from, say, J-pop
    /// to country. Within that bubble, co-listen similarity ("listeners who played the
    /// seed also played this") and play count decide the order. A thin pool is padded
    /// with the most-played tracks *in the same genres* — only a seed with no genres at
    /// all widens to overall trending. The seed track is returned first.
    /// </summary>
    [HttpGet("{id:guid}/radio")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Radio(Guid id, [FromQuery] int limit = 30, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 5, 60);

        var seed = await BaseQuery().FirstOrDefaultAsync(t => t.Id == id, ct);
        if (seed is null) return NotFound();

        var seedGenreIds = await _db.TrackGenres
            .Where(tg => tg.TrackId == id)
            .Select(tg => tg.GenreId)
            .ToListAsync(ct);

        // Co-listen: users who played the seed → the other tracks they played, by frequency.
        var seedListeners = await _db.PlayHistories
            .Where(h => h.TrackId == id)
            .Select(h => h.UserId)
            .Distinct()
            .ToListAsync(ct);

        var coListenScore = new Dictionary<Guid, int>();
        if (seedListeners.Count > 0)
        {
            var coPlays = await _db.PlayHistories
                .Where(h => seedListeners.Contains(h.UserId) && h.TrackId != id)
                .GroupBy(h => h.TrackId)
                .Select(g => new { TrackId = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .Take(limit * 3)
                .ToListAsync(ct);
            foreach (var c in coPlays) coListenScore[c.TrackId] = c.Count;
        }

        // Candidate pool: stay in the seed's genre bubble. Genre overlap (or same artist)
        // is a hard gate, not just a ranking nudge — co-listen sorts *within* the bubble
        // rather than dragging in an unrelated genre. A genre-less seed has no bubble, so
        // it falls back to co-listen + same artist.
        var hasGenres = seedGenreIds.Count > 0;
        var coIds = coListenScore.Keys.ToList();
        var candidates = await BaseQuery()
            .Where(t => t.Id != id && (
                t.ArtistId == seed.ArtistId ||
                (hasGenres
                    ? t.TrackGenres.Any(tg => seedGenreIds.Contains(tg.GenreId))
                    : coIds.Contains(t.Id))))
            .Take(limit * 8)
            .ToListAsync(ct);

        var maxCo = coListenScore.Count > 0 ? coListenScore.Values.Max() : 1;
        double Score(Models.Track t)
        {
            var co = coListenScore.GetValueOrDefault(t.Id) / (double)maxCo;       // 0..1
            var genre = t.TrackGenres.Count(tg => seedGenreIds.Contains(tg.GenreId));
            var sameArtist = t.ArtistId == seed.ArtistId ? 1 : 0;
            // Genre overlap dominates so the bubble holds; co-listen orders within it;
            // same artist is only a light nudge (we want variety, not the same album).
            return genre * 2.0 + co * 1.5 + sameArtist * 0.25;
        }

        var ranked = candidates
            .OrderByDescending(Score)
            .ThenByDescending(t => t.PlayCount)
            .Take(limit - 1)
            .ToList();

        // Pad a thin pool with the most-played tracks in the SAME genres — never a random
        // cross-genre filler. Only a genre-less seed widens to overall trending.
        if (ranked.Count < limit - 1)
        {
            var have = ranked.Select(t => t.Id).Append(id).ToHashSet();
            var fillerQuery = BaseQuery();
            if (hasGenres)
                fillerQuery = fillerQuery.Where(t => t.TrackGenres.Any(tg => seedGenreIds.Contains(tg.GenreId)));
            var fillers = await fillerQuery
                .OrderByDescending(t => t.PlayCount)
                .Take(limit * 2)
                .ToListAsync(ct);
            ranked.AddRange(fillers.Where(t => !have.Contains(t.Id)).Take(limit - 1 - ranked.Count));
        }

        var station = new List<Models.Track> { seed };
        station.AddRange(ranked);
        return Ok(await _mapper.ToDtoListAsync(station, ct));
    }

    /// <summary>
    /// Spotify-style "Daily Mixes" — one mix per the listener's top genres
    /// (from their 90-day play history), each filled with popular tracks in that
    /// genre, lightly shuffled. Falls back to the catalogue's biggest genres for
    /// guests / users with no history so the row is never empty.
    /// </summary>
    [HttpGet("daily-mixes")]
    public async Task<ActionResult<IEnumerable<DailyMixDto>>> DailyMixes([FromQuery] int count = 4, [FromQuery] int size = 25, CancellationToken ct = default)
    {
        count = Math.Clamp(count, 1, 6);
        size = Math.Clamp(size, 10, 40);

        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        Guid? me = Guid.TryParse(rawId, out var g) ? g : null;

        // The user's top genres, by how many of their recent plays carry them.
        List<(Guid Id, string Name, string Slug, string? Color)> topGenres = new();
        if (me is not null)
        {
            var since = DateTime.UtcNow.AddDays(-90);
            var recentIds = await _db.PlayHistories
                .Where(h => h.UserId == me && h.PlayedAt >= since)
                .Select(h => h.TrackId)
                .ToListAsync(ct);

            if (recentIds.Count > 0)
            {
                var genreRows = await _db.TrackGenres
                    .Where(tg => recentIds.Contains(tg.TrackId))
                    .Select(tg => new { tg.GenreId, tg.Genre.Name, tg.Genre.Slug, tg.Genre.Color })
                    .ToListAsync(ct);

                topGenres = genreRows
                    .GroupBy(r => new { r.GenreId, r.Name, r.Slug, r.Color })
                    .OrderByDescending(grp => grp.Count())
                    .Take(count)
                    .Select(grp => (grp.Key.GenreId, grp.Key.Name, grp.Key.Slug, (string?)grp.Key.Color))
                    .ToList();
            }
        }

        // Fallback: catalogue's biggest genres by approved-track count.
        if (topGenres.Count == 0)
        {
            var byTrackCount = await _db.TrackGenres
                .Where(tg => tg.Track.Status == "approved")
                .GroupBy(tg => tg.GenreId)
                .OrderByDescending(grp => grp.Count())
                .Take(count)
                .Select(grp => grp.Key)
                .ToListAsync(ct);

            var genres = await _db.Genres.Where(g => byTrackCount.Contains(g.Id)).ToListAsync(ct);
            topGenres = genres.Select(g => (g.Id, g.Name, g.Slug, (string?)g.Color)).ToList();
        }

        var mixes = new List<DailyMixDto>(topGenres.Count);
        var mixNum = 1;
        foreach (var genre in topGenres)
        {
            var pool = await BaseQuery()
                .Where(t => t.TrackGenres.Any(tg => tg.GenreId == genre.Id))
                .OrderByDescending(t => t.PlayCount)
                .Take(size * 2)
                .ToListAsync(ct);

            if (pool.Count == 0) continue;

            // Light shuffle so the mix feels fresh between loads.
            var tracks = pool.OrderBy(_ => Random.Shared.Next()).Take(size).ToList();
            mixes.Add(new DailyMixDto(
                genre.Slug,
                $"{genre.Name} Mix",
                $"Daily Mix {mixNum++}",
                genre.Color,
                await _mapper.ToDtoListAsync(tracks, ct)));
        }

        return Ok(mixes);
    }

    /// <summary>
    /// Discover Weekly: collaborative filtering over PlayHistories.
    /// Finds listeners who overlap with the signed-in user's recent plays, then
    /// recommends tracks those listeners played that the user has not heard yet.
    /// Falls back to trending for guests and fresh accounts.
    /// </summary>
    [HttpGet("discover-weekly")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> DiscoverWeekly([FromQuery] int limit = 30, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 10, 60);

        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (rawId is null || !Guid.TryParse(rawId, out var me))
            return await TrendingFallback(limit, ct);

        var since = DateTime.UtcNow.AddDays(-120);
        var myTrackIds = await _db.PlayHistories
            .Where(h => h.UserId == me && h.PlayedAt >= since)
            .Select(h => h.TrackId)
            .Distinct()
            .ToListAsync(ct);

        if (myTrackIds.Count == 0)
            return await TrendingFallback(limit, ct);

        var peerIds = await _db.PlayHistories
            .Where(h => h.UserId != me && myTrackIds.Contains(h.TrackId))
            .GroupBy(h => h.UserId)
            .OrderByDescending(g => g.Count())
            .Take(200)
            .Select(g => g.Key)
            .ToListAsync(ct);

        if (peerIds.Count == 0)
            return await ForYou(limit, ct);

        var candidateScores = await _db.PlayHistories
            .Where(h => peerIds.Contains(h.UserId) && !myTrackIds.Contains(h.TrackId))
            .GroupBy(h => h.TrackId)
            .Select(g => new { TrackId = g.Key, Score = g.Count() })
            .OrderByDescending(x => x.Score)
            .Take(limit * 5)
            .ToListAsync(ct);

        if (candidateScores.Count == 0)
            return await ForYou(limit, ct);

        var scoreByTrackId = candidateScores.ToDictionary(x => x.TrackId, x => x.Score);
        var candidateIds = candidateScores.Select(x => x.TrackId).ToList();
        var candidates = await BaseQuery()
            .Where(t => candidateIds.Contains(t.Id))
            .ToListAsync(ct);

        var ranked = candidates
            .OrderByDescending(t => scoreByTrackId.GetValueOrDefault(t.Id))
            .ThenByDescending(t => t.PlayCount)
            .Take(limit)
            .ToList();

        if (ranked.Count < limit)
        {
            var have = ranked.Select(t => t.Id).ToHashSet();
            var fillersResult = await ForYou(limit, ct);
            if (fillersResult.Result is OkObjectResult { Value: IEnumerable<TrackDto> fillerDtos })
            {
                var fillerIds = fillerDtos.Select(t => t.Id).Where(id => !have.Contains(id)).Take(limit - ranked.Count).ToList();
                if (fillerIds.Count > 0)
                {
                    var fillers = await BaseQuery().Where(t => fillerIds.Contains(t.Id)).ToListAsync(ct);
                    ranked.AddRange(fillers.OrderBy(t => fillerIds.IndexOf(t.Id)));
                }
            }
        }

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
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .FirstOrDefaultAsync(t => t.Id == id && t.Status == "approved", ct);

        if (track is null) return NotFound();

        if (IsInstrumental(track))
        {
            if (!string.IsNullOrWhiteSpace(track.Lyrics) || !string.IsNullOrWhiteSpace(track.SyncedLyrics))
            {
                track.Lyrics = null;
                track.SyncedLyrics = "__none__";
                await _db.SaveChangesAsync(ct);
            }

            return Ok(new LyricsDto(null, null, "instrumental"));
        }

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

    private static bool IsInstrumental(Models.Track track)
        => track.TrackGenres.Any(tg => string.Equals(tg.Genre.Slug, "instrumental", StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Returns comments for a track, newest first. Public (no auth needed to read).
    /// </summary>
    [HttpGet("{id:guid}/comments")]
    public async Task<ActionResult<IEnumerable<TrackCommentDto>>> GetComments(Guid id, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 200);

        var track = await _db.Tracks
            .Where(t => t.Id == id && t.Status == "approved")
            .Select(t => new { t.DurationMs })
            .FirstOrDefaultAsync(ct);
        if (track is null) return NotFound();

        var comments = await _db.TrackComments
            .Where(c => c.TrackId == id && c.ParentId == null)
            .Include(c => c.User)
            .OrderByDescending(c => c.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);

        var dtos = comments.Select(c => new TrackCommentDto(
            c.Id, c.TrackId, _mapper.ToRef(c.User), c.Body,
            c.ParentId, c.TimestampMs, c.CreatedAt));

        return Ok(dtos);
    }

    /// <summary>
    /// Returns replies for a specific comment.
    /// </summary>
    [HttpGet("{id:guid}/comments/{commentId:guid}/replies")]
    public async Task<ActionResult<IEnumerable<TrackCommentDto>>> GetCommentReplies(Guid id, Guid commentId, CancellationToken ct = default)
    {
        var track = await _db.Tracks
            .Where(t => t.Id == id && t.Status == "approved")
            .Select(t => new { t.DurationMs })
            .FirstOrDefaultAsync(ct);
        if (track is null) return NotFound();

        var replies = await _db.TrackComments
            .Where(c => c.TrackId == id && c.ParentId == commentId)
            .Include(c => c.User)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(ct);

        var dtos = replies.Select(c => new TrackCommentDto(
            c.Id, c.TrackId, _mapper.ToRef(c.User), c.Body,
            c.ParentId, c.TimestampMs, c.CreatedAt));

        return Ok(dtos);
    }

    /// <summary>
    /// Post a comment on a track. Must be authenticated.
    /// </summary>
    [HttpPost("{id:guid}/comments")]
    [Authorize]
    public async Task<ActionResult<TrackCommentDto>> PostComment(Guid id, [FromBody] CreateCommentRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Body) || req.Body.Length > 1000)
            return BadRequest(new { message = "Comment body must be 1–1000 characters." });

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdValue, out var userId)) return Unauthorized();

        var track = await _db.Tracks
            .Where(t => t.Id == id && t.Status == "approved")
            .Select(t => new { t.DurationMs })
            .FirstOrDefaultAsync(ct);
        if (track is null) return NotFound();

        // If it's a reply, verify the parent comment exists on this track.
        if (req.ParentId is { } parentId)
        {
            var parentExists = await _db.TrackComments.AnyAsync(c => c.Id == parentId && c.TrackId == id, ct);
            if (!parentExists) return BadRequest(new { message = "Parent comment not found on this track." });
        }
        if (req.ParentId is not null && req.TimestampMs is not null)
            return BadRequest(new { message = "Replies cannot be pinned to the waveform." });
        if (req.TimestampMs is < 0 || req.TimestampMs > track.DurationMs)
            return BadRequest(new { message = "Comment timestamp must be within the track duration." });

        var comment = new Models.TrackComment
        {
            TrackId = id,
            UserId = userId,
            Body = req.Body.Trim(),
            ParentId = req.ParentId,
            TimestampMs = req.TimestampMs,
            CreatedAt = DateTime.UtcNow,
        };

        _db.TrackComments.Add(comment);
        await _db.SaveChangesAsync(ct);

        // Load the user for the response.
        await _db.Entry(comment).Reference(c => c.User).LoadAsync(ct);

        var dto = new TrackCommentDto(
            comment.Id, comment.TrackId, _mapper.ToRef(comment.User), comment.Body,
            comment.ParentId, comment.TimestampMs, comment.CreatedAt);

        return CreatedAtAction(nameof(GetComments), new { id }, dto);
    }

    /// <summary>
    /// Delete a comment. Only the comment author or an admin may delete.
    /// </summary>
    [HttpDelete("{id:guid}/comments/{commentId:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteComment(Guid id, Guid commentId, CancellationToken ct = default)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdValue, out var userId)) return Unauthorized();

        var comment = await _db.TrackComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.TrackId == id, ct);

        if (comment is null) return NotFound();

        var isAdmin = User.IsInRole("Admin");
        if (comment.UserId != userId && !isAdmin)
            return StatusCode(403, new { message = "You can only delete your own comments." });

        // Also delete replies to this comment.
        var replies = await _db.TrackComments
            .Where(c => c.ParentId == commentId)
            .ToListAsync(ct);
        _db.TrackComments.RemoveRange(replies);
        _db.TrackComments.Remove(comment);
        await _db.SaveChangesAsync(ct);

        return NoContent();
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
