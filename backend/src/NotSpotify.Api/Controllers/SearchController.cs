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

    public SearchController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<SearchResultsDto>> Search([FromQuery] string q, [FromQuery] string? type = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new SearchResultsDto(
                Array.Empty<TrackDto>(),
                Array.Empty<ArtistDto>(),
                Array.Empty<AlbumDto>(),
                Array.Empty<PlaylistSummaryDto>(),
                Array.Empty<TrackDto>()));

        var like = $"%{q}%";
        var wantAll = string.IsNullOrEmpty(type);

        IEnumerable<TrackDto> tracks = Array.Empty<TrackDto>();
        IEnumerable<TrackDto> tracksByLyrics = Array.Empty<TrackDto>();
        if (wantAll || type == "track")
        {
            var rows = await _db.Tracks
                .Where(t => EF.Functions.ILike(t.Title, like))
                .Include(t => t.Artist).Include(t => t.Album)
                .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
                .Take(20).ToListAsync(ct);
            tracks = await _mapper.ToDtoListAsync(rows, ct);

            // Lyrics search — only for queries long enough to be a lyric phrase,
            // excluding tracks the title search already found.
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
                .Where(a => EF.Functions.ILike(a.Name, like))
                .Take(20).ToListAsync(ct);
            artists = rows.Select(a => _mapper.ToDto(a));
        }

        IEnumerable<AlbumDto> albums = Array.Empty<AlbumDto>();
        if (wantAll || type == "album")
        {
            var rows = await _db.Albums
                .Where(a => EF.Functions.ILike(a.Title, like))
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

        return Ok(new SearchResultsDto(tracks, artists, albums, playlists, tracksByLyrics));
    }
}
