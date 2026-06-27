using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("search")]
public class SearchController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly OpenSearchService _search;

    public SearchController(AppDbContext db, MediaMapper mapper, OpenSearchService search)
    {
        _db = db;
        _mapper = mapper;
        _search = search;
    }

    [HttpGet]
    public async Task<ActionResult<SearchResultsDto>> Search(
        [FromQuery] string q,
        [FromQuery] string? type = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new SearchResultsDto(
                Array.Empty<TrackDto>(),
                Array.Empty<ArtistDto>(),
                Array.Empty<AlbumDto>(),
                Array.Empty<PlaylistSummaryDto>(),
                Array.Empty<TrackDto>(),
                Array.Empty<MusicVideoDto>()));

        return _search.IsConfigured
            ? await SearchViaOpenSearch(q, type, ct)
            : await SearchViaSql(q, type, ct);
    }

    // ── OpenSearch path ───────────────────────────────────────────────────────

    private async Task<ActionResult<SearchResultsDto>> SearchViaOpenSearch(
        string q, string? type, CancellationToken ct)
    {
        var ids = await _search.SearchAsync(q, type, ct);
        var wantAll = string.IsNullOrEmpty(type);

        IEnumerable<TrackDto> tracks = Array.Empty<TrackDto>();
        IEnumerable<TrackDto> tracksByLyrics = Array.Empty<TrackDto>();
        if ((wantAll || type == "track") && ids.TrackIds.Count > 0)
        {
            var rows = await _db.Tracks
                .Where(t => ids.TrackIds.Contains(t.Id))
                .Include(t => t.Artist).Include(t => t.Album)
                .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
                .ToListAsync(ct);
            tracks = await _mapper.ToDtoListAsync(RankBy(rows, r => r.Id, ids.TrackIds), ct);

            if (ids.LyricsTrackIds.Count > 0)
            {
                var lyricRows = await _db.Tracks
                    .Where(t => ids.LyricsTrackIds.Contains(t.Id))
                    .Include(t => t.Artist).Include(t => t.Album)
                    .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
                    .ToListAsync(ct);
                tracksByLyrics = await _mapper.ToDtoListAsync(RankBy(lyricRows, r => r.Id, ids.LyricsTrackIds), ct);
            }
        }

        IEnumerable<ArtistDto> artists = Array.Empty<ArtistDto>();
        if ((wantAll || type == "artist") && ids.ArtistIds.Count > 0)
        {
            var rows = await _db.Artists.Where(a => ids.ArtistIds.Contains(a.Id)).ToListAsync(ct);
            artists = RankBy(rows, r => r.Id, ids.ArtistIds).Select(a => _mapper.ToDto(a));
        }

        IEnumerable<AlbumDto> albums = Array.Empty<AlbumDto>();
        if ((wantAll || type == "album") && ids.AlbumIds.Count > 0)
        {
            var rows = await _db.Albums
                .Where(a => ids.AlbumIds.Contains(a.Id))
                .Include(a => a.Artist)
                .ToListAsync(ct);
            albums = RankBy(rows, r => r.Id, ids.AlbumIds).Select(a => _mapper.ToDto(a));
        }

        IEnumerable<PlaylistSummaryDto> playlists = Array.Empty<PlaylistSummaryDto>();
        if ((wantAll || type == "playlist") && ids.PlaylistIds.Count > 0)
        {
            var rows = await _db.Playlists
                .Where(p => ids.PlaylistIds.Contains(p.Id))
                .Include(p => p.Owner)
                .Include(p => p.PlaylistTracks)
                .ToListAsync(ct);
            playlists = RankBy(rows, r => r.Id, ids.PlaylistIds).Select(p => _mapper.ToSummary(p));
        }

        IEnumerable<MusicVideoDto> musicVideos = Array.Empty<MusicVideoDto>();
        if ((wantAll || type == "musicVideo") && ids.MusicVideoIds.Count > 0)
        {
            var rows = await _db.MusicVideos
                .Where(v => ids.MusicVideoIds.Contains(v.Id))
                .Include(v => v.Artist)
                .ToListAsync(ct);
            var videoDtos = new List<MusicVideoDto>(rows.Count);
            foreach (var row in RankBy(rows, r => r.Id, ids.MusicVideoIds))
                videoDtos.Add(await _mapper.ToDtoAsync(row, ct));
            musicVideos = videoDtos;
        }

        return Ok(new SearchResultsDto(tracks, artists, albums, playlists, tracksByLyrics, musicVideos));
    }

    // Reorder a Postgres result set to match the ES ranking order.
    private static List<T> RankBy<T>(List<T> rows, Func<T, Guid> getId, List<Guid> ranking)
    {
        var rank = ranking.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
        return rows.OrderBy(r => rank.TryGetValue(getId(r), out var i) ? i : int.MaxValue).ToList();
    }

    // ── SQL fallback (used when OpenSearch:Endpoint is not configured) ────────

    private async Task<ActionResult<SearchResultsDto>> SearchViaSql(
        string q, string? type, CancellationToken ct)
    {
        var like = $"%{q}%";
        var wantAll = string.IsNullOrEmpty(type);

        var normalized = SearchTextBuilder.Normalize(q);
        var searchLike = string.IsNullOrEmpty(normalized) ? null : $"%{normalized}%";

        IEnumerable<TrackDto> tracks = Array.Empty<TrackDto>();
        IEnumerable<TrackDto> tracksByLyrics = Array.Empty<TrackDto>();
        if (wantAll || type == "track")
        {
            var rows = await _db.Tracks
                .Where(t => EF.Functions.ILike(t.Title, like)
                    || (searchLike != null && t.SearchText != null && EF.Functions.ILike(t.SearchText, searchLike)))
                .Include(t => t.Artist).Include(t => t.Album)
                .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
                .Take(20).ToListAsync(ct);
            tracks = await _mapper.ToDtoListAsync(rows, ct);

            if (q.Trim().Length >= 3)
            {
                var titleIds = rows.Select(r => r.Id).ToList();
                var lyricRows = await _db.Tracks
                    .Where(t => t.Lyrics != null && EF.Functions.ILike(t.Lyrics, like) && !titleIds.Contains(t.Id))
                    .Include(t => t.Artist).Include(t => t.Album)
                    .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
                    .Take(10).ToListAsync(ct);
                tracksByLyrics = await _mapper.ToDtoListAsync(lyricRows, ct);
            }
        }

        IEnumerable<ArtistDto> artists = Array.Empty<ArtistDto>();
        if (wantAll || type == "artist")
        {
            var rows = await _db.Artists
                .Where(a => EF.Functions.ILike(a.Name, like)
                    || (searchLike != null && a.SearchText != null && EF.Functions.ILike(a.SearchText, searchLike)))
                .Take(20).ToListAsync(ct);
            artists = rows.Select(a => _mapper.ToDto(a));
        }

        IEnumerable<AlbumDto> albums = Array.Empty<AlbumDto>();
        if (wantAll || type == "album")
        {
            var rows = await _db.Albums
                .Where(a => EF.Functions.ILike(a.Title, like)
                    || (searchLike != null && a.SearchText != null && EF.Functions.ILike(a.SearchText, searchLike)))
                .Include(a => a.Artist)
                .Take(20).ToListAsync(ct);
            albums = rows.Select(a => _mapper.ToDto(a));
        }

        IEnumerable<PlaylistSummaryDto> playlists = Array.Empty<PlaylistSummaryDto>();
        if (wantAll || type == "playlist")
        {
            var rows = await _db.Playlists
                .Where(p => p.IsPublic && EF.Functions.ILike(p.Name, like))
                .Include(p => p.Owner)
                .Include(p => p.PlaylistTracks)
                .Take(20).ToListAsync(ct);
            playlists = rows.Select(p => _mapper.ToSummary(p));
        }

        IEnumerable<MusicVideoDto> musicVideos = Array.Empty<MusicVideoDto>();
        if (wantAll || type == "musicVideo")
        {
            var rows = await _db.MusicVideos
                .Where(v => EF.Functions.ILike(v.Title, like) || EF.Functions.ILike(v.Artist.Name, like))
                .Include(v => v.Artist)
                .Take(10).ToListAsync(ct);
            var videoDtos = new List<MusicVideoDto>(rows.Count);
            foreach (var row in rows)
                videoDtos.Add(await _mapper.ToDtoAsync(row, ct));
            musicVideos = videoDtos;
        }

        return Ok(new SearchResultsDto(tracks, artists, albums, playlists, tracksByLyrics, musicVideos));
    }
}
