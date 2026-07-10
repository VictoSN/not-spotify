using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;

namespace NotSpotify.Api.Services;

/// <summary>
/// Best-effort live sync of catalogue changes into the OpenSearch indices, so
/// admin edits appear in search without waiting for the next full
/// <c>reindex-search</c>. Every method is fire-safe: failures are logged and
/// swallowed (search staleness must never break an admin operation), and
/// everything no-ops when OpenSearch isn't configured.
///
/// Playlists are deliberately NOT synced here — they churn constantly through
/// ordinary user actions and are refreshed by the periodic full reindex
/// instead. Popularity fields (play/view counts) also refresh on reindex; the
/// per-document sync snapshots whatever count the row has at edit time.
/// </summary>
public sealed class SearchIndexSyncService
{
    private readonly AppDbContext _db;
    private readonly OpenSearchService _search;
    private readonly ILogger<SearchIndexSyncService> _logger;

    public SearchIndexSyncService(AppDbContext db, OpenSearchService search, ILogger<SearchIndexSyncService> logger)
    {
        _db = db;
        _search = search;
        _logger = logger;
    }

    /// <summary>Upserts an approved track; removes missing/unapproved ones (covers approve, reject, edit, delete).</summary>
    public async Task SyncTrackAsync(Guid trackId, CancellationToken ct = default)
    {
        if (!_search.IsConfigured) return;
        try
        {
            var track = await _db.Tracks.AsNoTracking()
                .Include(t => t.Artist).Include(t => t.Album)
                .FirstOrDefaultAsync(t => t.Id == trackId, ct);
            if (track is null || track.Status != "approved")
            {
                await _search.DeleteTrackAsync(trackId, ct);
                return;
            }
            await _search.IndexTrackAsync(new TrackSearchDoc
            {
                Id = track.Id.ToString(),
                Title = track.Title,
                ArtistName = track.Artist.Name,
                AlbumTitle = track.Album.Title,
                SearchText = track.SearchText,
                Lyrics = track.Lyrics,
                PlayCount = track.PlayCount,
            }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[OpenSearch] Live sync failed for track {Id}: {Message}", trackId, ex.Message);
        }
    }

    public async Task RemoveTrackAsync(Guid trackId, CancellationToken ct = default)
    {
        if (!_search.IsConfigured) return;
        try { await _search.DeleteTrackAsync(trackId, ct); }
        catch (Exception ex) { _logger.LogWarning("[OpenSearch] Live remove failed for track {Id}: {Message}", trackId, ex.Message); }
    }

    /// <summary>
    /// Upserts an album and, when <paramref name="cascadeTracks"/> is set (retitle),
    /// re-upserts its tracks so their AlbumTitle field follows. Missing albums are removed.
    /// </summary>
    public async Task SyncAlbumAsync(Guid albumId, bool cascadeTracks = false, CancellationToken ct = default)
    {
        if (!_search.IsConfigured) return;
        try
        {
            var album = await _db.Albums.AsNoTracking()
                .Include(a => a.Artist)
                .FirstOrDefaultAsync(a => a.Id == albumId, ct);
            if (album is null)
            {
                await _search.DeleteAlbumAsync(albumId, ct);
                return;
            }
            await _search.IndexAlbumAsync(new AlbumSearchDoc
            {
                Id = album.Id.ToString(),
                Title = album.Title,
                ArtistName = album.Artist.Name,
                SearchText = album.SearchText,
            }, ct);
            if (cascadeTracks) await SyncTracksWhereAsync(t => t.AlbumId == albumId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[OpenSearch] Live sync failed for album {Id}: {Message}", albumId, ex.Message);
        }
    }

    /// <summary>Removes an album and the given (already deleted) track ids that lived on it.</summary>
    public async Task RemoveAlbumAsync(Guid albumId, IEnumerable<Guid> trackIds, CancellationToken ct = default)
    {
        if (!_search.IsConfigured) return;
        try
        {
            await _search.DeleteAlbumAsync(albumId, ct);
            foreach (var trackId in trackIds) await _search.DeleteTrackAsync(trackId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[OpenSearch] Live remove failed for album {Id}: {Message}", albumId, ex.Message);
        }
    }

    /// <summary>
    /// Upserts an artist. A rename fans out to the ArtistName field on all of their
    /// tracks/albums, so <paramref name="cascade"/> re-upserts those in bulk too.
    /// </summary>
    public async Task SyncArtistAsync(Guid artistId, bool cascade = false, CancellationToken ct = default)
    {
        if (!_search.IsConfigured) return;
        try
        {
            var artist = await _db.Artists.AsNoTracking().FirstOrDefaultAsync(a => a.Id == artistId, ct);
            if (artist is null)
            {
                await _search.DeleteArtistAsync(artistId, ct);
                return;
            }
            await _search.IndexArtistAsync(new ArtistSearchDoc
            {
                Id = artist.Id.ToString(),
                Name = artist.Name,
                SearchText = artist.SearchText,
            }, ct);

            if (!cascade) return;
            await SyncTracksWhereAsync(t => t.ArtistId == artistId, ct);
            var albums = await _db.Albums.AsNoTracking()
                .Where(a => a.ArtistId == artistId)
                .Include(a => a.Artist)
                .Select(a => new AlbumSearchDoc
                {
                    Id = a.Id.ToString(),
                    Title = a.Title,
                    ArtistName = a.Artist.Name,
                    SearchText = a.SearchText,
                })
                .ToListAsync(ct);
            await _search.IndexAlbumsAsync(albums, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[OpenSearch] Live sync failed for artist {Id}: {Message}", artistId, ex.Message);
        }
    }

    public async Task RemoveArtistAsync(Guid artistId, CancellationToken ct = default)
    {
        if (!_search.IsConfigured) return;
        try { await _search.DeleteArtistAsync(artistId, ct); }
        catch (Exception ex) { _logger.LogWarning("[OpenSearch] Live remove failed for artist {Id}: {Message}", artistId, ex.Message); }
    }

    /// <summary>Upserts a music video; removes missing ones.</summary>
    public async Task SyncMusicVideoAsync(Guid videoId, CancellationToken ct = default)
    {
        if (!_search.IsConfigured) return;
        try
        {
            var video = await _db.MusicVideos.AsNoTracking()
                .Include(v => v.Artist)
                .FirstOrDefaultAsync(v => v.Id == videoId, ct);
            if (video is null)
            {
                await _search.DeleteMusicVideoAsync(videoId, ct);
                return;
            }
            await _search.IndexMusicVideoAsync(new MusicVideoSearchDoc
            {
                Id = video.Id.ToString(),
                Title = video.Title,
                ArtistName = video.Artist.Name,
                ViewCount = video.ViewCount,
            }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[OpenSearch] Live sync failed for music video {Id}: {Message}", videoId, ex.Message);
        }
    }

    public async Task RemoveMusicVideoAsync(Guid videoId, CancellationToken ct = default)
    {
        if (!_search.IsConfigured) return;
        try { await _search.DeleteMusicVideoAsync(videoId, ct); }
        catch (Exception ex) { _logger.LogWarning("[OpenSearch] Live remove failed for music video {Id}: {Message}", videoId, ex.Message); }
    }

    private async Task SyncTracksWhereAsync(System.Linq.Expressions.Expression<Func<Models.Track, bool>> predicate, CancellationToken ct)
    {
        var docs = await _db.Tracks.AsNoTracking()
            .Where(t => t.Status == "approved")
            .Where(predicate)
            .Include(t => t.Artist).Include(t => t.Album)
            .Select(t => new TrackSearchDoc
            {
                Id = t.Id.ToString(),
                Title = t.Title,
                ArtistName = t.Artist.Name,
                AlbumTitle = t.Album.Title,
                SearchText = t.SearchText,
                Lyrics = t.Lyrics,
                PlayCount = t.PlayCount,
            })
            .ToListAsync(ct);
        await _search.IndexTracksAsync(docs, ct);
    }
}
