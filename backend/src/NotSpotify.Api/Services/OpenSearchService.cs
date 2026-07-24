using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using OpenSearch.Client;
using OpenSearch.Net;
using OpenSearch.Net.Auth.AwsSigV4;

namespace NotSpotify.Api.Services;

public sealed class OpenSearchOptions
{
    public string Endpoint { get; set; } = string.Empty;
    public string Region { get; set; } = "us-east-1";
    public bool UseAwsSigV4 { get; set; } = true;
}

// Lightweight documents — only what ES needs to rank results + the ID for Postgres lookup.
public sealed class TrackSearchDoc
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ArtistName { get; set; } = string.Empty;
    public string AlbumTitle { get; set; } = string.Empty;
    public string? SearchText { get; set; }
    public string? Lyrics { get; set; }
    /// <summary>Popularity signal blended into ranking (see SearchTracksAsync).</summary>
    public long PlayCount { get; set; }
}

public sealed class ArtistSearchDoc
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? SearchText { get; set; }
}

public sealed class AlbumSearchDoc
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ArtistName { get; set; } = string.Empty;
    public string? SearchText { get; set; }
}

public sealed class PlaylistSearchDoc
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public sealed class MusicVideoSearchDoc
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ArtistName { get; set; } = string.Empty;
    /// <summary>Popularity signal blended into ranking (see SearchMusicVideosAsync).</summary>
    public long ViewCount { get; set; }
}

/// <summary>Ranked ID lists returned by <see cref="OpenSearchService.SearchAsync"/>.</summary>
public sealed class SearchIds
{
    public List<Guid> TrackIds { get; set; } = new();
    public List<Guid> ArtistIds { get; set; } = new();
    public List<Guid> AlbumIds { get; set; } = new();
    public List<Guid> PlaylistIds { get; set; } = new();
    public List<Guid> LyricsTrackIds { get; set; } = new();
    public List<Guid> MusicVideoIds { get; set; } = new();
}

public sealed class OpenSearchService
{
    private readonly IOpenSearchClient _client;
    private readonly OpenSearchOptions _options;
    private readonly ILogger<OpenSearchService> _logger;

    private const string TracksIndex = "ns_tracks";
    private const string ArtistsIndex = "ns_artists";
    private const string AlbumsIndex = "ns_albums";
    private const string PlaylistsIndex = "ns_playlists";
    private const string MusicVideosIndex = "ns_music_videos";

    /// <summary>False when <c>OpenSearch:Endpoint</c> is not configured — falls back to SQL search.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.Endpoint);

    public OpenSearchService(OpenSearchOptions options, ILogger<OpenSearchService> logger)
    {
        _options = options;
        _logger = logger;

        if (!IsConfigured)
        {
            _client = new OpenSearchClient(new ConnectionSettings(new Uri("http://localhost:9200")));
            return;
        }

        ConnectionSettings settings;
        if (options.UseAwsSigV4)
        {
            var pool = new SingleNodeConnectionPool(new Uri(options.Endpoint));
            // Uses the default AWS credential chain: env vars → IAM role → profile.
            // NOTE: the single-string ctor overload is (service, …) NOT (region, …) —
            // passing the region there signs requests for a service named after the
            // region and the domain rejects everything with 403. Resolve the region
            // explicitly; the service code stays the default "es".
            var awsConnection = new AwsSigV4HttpConnection(Amazon.RegionEndpoint.GetBySystemName(options.Region));
            settings = new ConnectionSettings(pool, awsConnection);
        }
        else
        {
            settings = new ConnectionSettings(new Uri(options.Endpoint));
        }

        _client = new OpenSearchClient(settings);
    }

    // ── Index lifecycle ───────────────────────────────────────────────────────

    /// <summary>Creates each index if it doesn't exist yet. Called on startup.</summary>
    public async Task EnsureIndicesAsync(CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        foreach (var index in new[] { TracksIndex, ArtistsIndex, AlbumsIndex, PlaylistsIndex, MusicVideosIndex })
            await EnsureIndexAsync(index, ct);
    }

    private async Task EnsureIndexAsync(string index, CancellationToken ct)
    {
        var exists = await _client.Indices.ExistsAsync(index, ct: ct);
        if (exists.Exists) return;

        var create = await _client.Indices.CreateAsync(index, c => c
            .Settings(s => s.NumberOfShards(1).NumberOfReplicas(0)), ct);
        if (!create.IsValid)
            _logger.LogWarning("[OpenSearch] Failed to create index {Index}: {Reason}", index, create.DebugInformation);
    }

    // ── Full reindex ──────────────────────────────────────────────────────────

    /// <summary>
    /// Deletes + recreates all indices, then bulk-indexes everything from Postgres.
    /// Called by <c>dotnet run -- reindex-search</c>.
    /// </summary>
    public async Task BulkReindexAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (!IsConfigured)
        {
            Console.WriteLine("[OpenSearch] Endpoint not configured — skipping reindex.");
            return;
        }

        foreach (var index in new[] { TracksIndex, ArtistsIndex, AlbumsIndex, PlaylistsIndex, MusicVideosIndex })
            await DeleteAndRecreateIndexAsync(index, ct);

        var tracks = await db.Tracks
            .Where(t => t.Status == "approved")
            .Include(t => t.Artist).Include(t => t.Album)
            .Select(t => new TrackSearchDoc
            {
                Id = t.Id.ToString(),
                Title = t.Title,
                ArtistName = t.Artist.Name,
                AlbumTitle = t.Album.Title,
                SearchText = t.SearchText,
                Lyrics = t.Lyrics,
                PlayCount = t.PlayCount
            })
            .ToListAsync(ct);

        var artists = await db.Artists
            .Select(a => new ArtistSearchDoc { Id = a.Id.ToString(), Name = a.Name, SearchText = a.SearchText })
            .ToListAsync(ct);

        var albums = await db.Albums
            .Include(a => a.Artist)
            .Select(a => new AlbumSearchDoc
            {
                Id = a.Id.ToString(),
                Title = a.Title,
                ArtistName = a.Artist.Name,
                SearchText = a.SearchText
            })
            .ToListAsync(ct);

        var playlists = await db.Playlists
            .Where(p => p.IsPublic)
            .Select(p => new PlaylistSearchDoc { Id = p.Id.ToString(), Name = p.Name })
            .ToListAsync(ct);

        var musicVideos = await db.MusicVideos
            .Include(v => v.Artist)
            .Select(v => new MusicVideoSearchDoc { Id = v.Id.ToString(), Title = v.Title, ArtistName = v.Artist.Name, ViewCount = v.ViewCount })
            .ToListAsync(ct);

        await BulkUpsertAsync(TracksIndex, tracks, d => d.Id, ct);
        await BulkUpsertAsync(ArtistsIndex, artists, d => d.Id, ct);
        await BulkUpsertAsync(AlbumsIndex, albums, d => d.Id, ct);
        await BulkUpsertAsync(PlaylistsIndex, playlists, d => d.Id, ct);
        await BulkUpsertAsync(MusicVideosIndex, musicVideos, d => d.Id, ct);

        Console.WriteLine($"[OpenSearch] Reindexed: {tracks.Count} tracks, {artists.Count} artists, " +
                          $"{albums.Count} albums, {playlists.Count} playlists, {musicVideos.Count} music videos.");
    }

    private async Task DeleteAndRecreateIndexAsync(string index, CancellationToken ct)
    {
        var exists = await _client.Indices.ExistsAsync(index, ct: ct);
        if (exists.Exists)
            await _client.Indices.DeleteAsync(index, ct: ct);
        await _client.Indices.CreateAsync(index, c => c
            .Settings(s => s.NumberOfShards(1).NumberOfReplicas(0)), ct);
    }

    private async Task BulkUpsertAsync<T>(string index, List<T> docs, Func<T, string> getId, CancellationToken ct) where T : class
    {
        if (docs.Count == 0) return;
        const int pageSize = 500;
        for (int i = 0; i < docs.Count; i += pageSize)
        {
            var batch = docs.Skip(i).Take(pageSize).ToList();
            var result = await _client.BulkAsync(b => b
                .Index(index)
                .IndexMany(batch, (op, doc) => op.Id(getId(doc))), ct);
            // result.Errors only reflects per-item failures; a transport-level failure
            // (auth, connectivity) leaves it false with an invalid response — check both,
            // otherwise a reindex can report success while nothing was written.
            if (!result.IsValid)
                _logger.LogWarning("[OpenSearch] Bulk index {Index} batch {Batch} failed: {Reason}",
                    index, i / pageSize, result.DebugInformation);
            else if (result.Errors)
                _logger.LogWarning("[OpenSearch] Bulk index {Index} batch {Batch}: {Errors} error(s)",
                    index, i / pageSize, result.ItemsWithErrors.Count());
        }
    }

    // ── Per-document upsert/delete (call from admin controllers for real-time sync) ──

    public async Task IndexTrackAsync(TrackSearchDoc doc, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        await _client.IndexAsync(doc, i => i.Index(TracksIndex).Id(doc.Id), ct);
    }

    public async Task DeleteTrackAsync(Guid id, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        await _client.DeleteAsync<TrackSearchDoc>(id.ToString(), d => d.Index(TracksIndex), ct);
    }

    public async Task IndexArtistAsync(ArtistSearchDoc doc, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        await _client.IndexAsync(doc, i => i.Index(ArtistsIndex).Id(doc.Id), ct);
    }

    public async Task DeleteArtistAsync(Guid id, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        await _client.DeleteAsync<ArtistSearchDoc>(id.ToString(), d => d.Index(ArtistsIndex), ct);
    }

    public async Task IndexAlbumAsync(AlbumSearchDoc doc, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        await _client.IndexAsync(doc, i => i.Index(AlbumsIndex).Id(doc.Id), ct);
    }

    public async Task DeleteAlbumAsync(Guid id, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        await _client.DeleteAsync<AlbumSearchDoc>(id.ToString(), d => d.Index(AlbumsIndex), ct);
    }

    public async Task IndexMusicVideoAsync(MusicVideoSearchDoc doc, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        await _client.IndexAsync(doc, i => i.Index(MusicVideosIndex).Id(doc.Id), ct);
    }

    public async Task DeleteMusicVideoAsync(Guid id, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        await _client.DeleteAsync<MusicVideoSearchDoc>(id.ToString(), d => d.Index(MusicVideosIndex), ct);
    }

    /// <summary>Bulk upserts used by the live-sync cascade (e.g. artist rename touching all their tracks).</summary>
    public Task IndexTracksAsync(List<TrackSearchDoc> docs, CancellationToken ct = default)
        => IsConfigured ? BulkUpsertAsync(TracksIndex, docs, d => d.Id, ct) : Task.CompletedTask;

    /// <inheritdoc cref="IndexTracksAsync"/>
    public Task IndexAlbumsAsync(List<AlbumSearchDoc> docs, CancellationToken ct = default)
        => IsConfigured ? BulkUpsertAsync(AlbumsIndex, docs, d => d.Id, ct) : Task.CompletedTask;

    // ── Search ────────────────────────────────────────────────────────────────

    public async Task<SearchIds> SearchAsync(string query, string? type, CancellationToken ct = default)
    {
        var result = new SearchIds();
        if (!IsConfigured || string.IsNullOrWhiteSpace(query)) return result;

        var wantAll = string.IsNullOrEmpty(type);
        var tasks = new List<Task>();

        if (wantAll || type == "track")      tasks.Add(SearchTracksAsync(query, result, ct));
        if (wantAll || type == "artist")     tasks.Add(SearchArtistsAsync(query, result, ct));
        if (wantAll || type == "album")      tasks.Add(SearchAlbumsAsync(query, result, ct));
        if (wantAll || type == "playlist")   tasks.Add(SearchPlaylistsAsync(query, result, ct));
        if (wantAll || type == "musicVideo") tasks.Add(SearchMusicVideosAsync(query, result, ct));

        await Task.WhenAll(tasks);
        return result;
    }

    /// <summary>
    /// Two-clause text match shared by every entity search:
    ///  - best_fields + fuzziness   → whole-word matches with typo tolerance ("vampre" → vampire)
    ///  - bool_prefix               → the last term matches as a prefix ("vamp" → vampire while typing)
    /// Either clause alone qualifies a hit; whichever scores higher wins (bool should).
    /// </summary>
    private static QueryContainer TextQuery<T>(
        QueryContainerDescriptor<T> q,
        string query,
        Func<FieldsDescriptor<T>, IPromise<Fields>> fields) where T : class
    {
        return q.Bool(b => b
            .Should(
                sh => sh.MultiMatch(mm => mm
                    .Fields(fields)
                    .Query(query)
                    .Type(TextQueryType.BestFields)
                    .Fuzziness(Fuzziness.Auto)),
                sh => sh.MultiMatch(mm => mm
                    .Fields(fields)
                    .Query(query)
                    .Type(TextQueryType.BoolPrefix)))
            .MinimumShouldMatch(1));
    }

    private async Task SearchTracksAsync(string query, SearchIds result, CancellationToken ct)
    {
        // Popularity blend: text relevance × log2(playCount + 1). Unplayed tracks keep a
        // small constant factor (≈0.3) instead of zeroing out; a well-played track earns a
        // single-digit multiplier — enough to win ambiguous/short queries without letting
        // popularity drown out a precise title match.
        var response = await _client.SearchAsync<TrackSearchDoc>(s => s
            .Index(TracksIndex)
            .Size(20)
            .Query(q => q.FunctionScore(fs => fs
                .Query(fq => TextQuery(fq, query, f => f
                    .Field(d => d.Title, boost: 3)
                    .Field(d => d.ArtistName, boost: 2)
                    .Field(d => d.AlbumTitle, boost: 1.5)
                    .Field(d => d.SearchText)))
                .BoostMode(FunctionBoostMode.Multiply)
                .Functions(funcs => funcs.FieldValueFactor(fvf => fvf
                    .Field(d => d.PlayCount)
                    .Modifier(FieldValueFactorModifier.Log2P)
                    .Missing(0))))), ct);

        if (!response.IsValid)
        {
            _logger.LogWarning("[OpenSearch] Track search error: {Reason}", response.DebugInformation);
            return;
        }

        result.TrackIds = response.Hits.Select(h => Guid.Parse(h.Source.Id)).ToList();

        // Lyrics search for queries long enough to be a phrase
        if (query.Trim().Length >= 3)
        {
            var excludeIds = result.TrackIds.Select(id => id.ToString()).ToArray();
            var lyricsResponse = await _client.SearchAsync<TrackSearchDoc>(s => s
                .Index(TracksIndex)
                .Size(10)
                .Query(q => q.Bool(b => b
                    .Must(m => m.Match(mm => mm.Field(d => d.Lyrics).Query(query)))
                    .MustNot(mn => mn.Ids(ids => ids.Values(excludeIds)))
                )), ct);

            if (lyricsResponse.IsValid)
                result.LyricsTrackIds = lyricsResponse.Hits.Select(h => Guid.Parse(h.Source.Id)).ToList();
        }
    }

    private async Task SearchArtistsAsync(string query, SearchIds result, CancellationToken ct)
    {
        var response = await _client.SearchAsync<ArtistSearchDoc>(s => s
            .Index(ArtistsIndex)
            .Size(20)
            .Query(q => TextQuery(q, query, f => f.Field(d => d.Name, boost: 2).Field(d => d.SearchText))), ct);

        if (response.IsValid)
            result.ArtistIds = response.Hits.Select(h => Guid.Parse(h.Source.Id)).ToList();
        else
            _logger.LogWarning("[OpenSearch] Artist search error: {Reason}", response.DebugInformation);
    }

    private async Task SearchAlbumsAsync(string query, SearchIds result, CancellationToken ct)
    {
        var response = await _client.SearchAsync<AlbumSearchDoc>(s => s
            .Index(AlbumsIndex)
            .Size(20)
            .Query(q => TextQuery(q, query, f => f.Field(d => d.Title, boost: 2).Field(d => d.ArtistName, boost: 1.5).Field(d => d.SearchText))), ct);

        if (response.IsValid)
            result.AlbumIds = response.Hits.Select(h => Guid.Parse(h.Source.Id)).ToList();
        else
            _logger.LogWarning("[OpenSearch] Album search error: {Reason}", response.DebugInformation);
    }

    private async Task SearchPlaylistsAsync(string query, SearchIds result, CancellationToken ct)
    {
        var response = await _client.SearchAsync<PlaylistSearchDoc>(s => s
            .Index(PlaylistsIndex)
            .Size(20)
            .Query(q => TextQuery(q, query, f => f.Field(d => d.Name))), ct);

        if (response.IsValid)
            result.PlaylistIds = response.Hits.Select(h => Guid.Parse(h.Source.Id)).ToList();
        else
            _logger.LogWarning("[OpenSearch] Playlist search error: {Reason}", response.DebugInformation);
    }

    private async Task SearchMusicVideosAsync(string query, SearchIds result, CancellationToken ct)
    {
        // Same popularity blend as tracks, driven by view count.
        var response = await _client.SearchAsync<MusicVideoSearchDoc>(s => s
            .Index(MusicVideosIndex)
            .Size(10)
            .Query(q => q.FunctionScore(fs => fs
                .Query(fq => TextQuery(fq, query, f => f.Field(d => d.Title, boost: 2).Field(d => d.ArtistName)))
                .BoostMode(FunctionBoostMode.Multiply)
                .Functions(funcs => funcs.FieldValueFactor(fvf => fvf
                    .Field(d => d.ViewCount)
                    .Modifier(FieldValueFactorModifier.Log2P)
                    .Missing(0))))), ct);

        if (response.IsValid)
            result.MusicVideoIds = response.Hits.Select(h => Guid.Parse(h.Source.Id)).ToList();
        else
            _logger.LogWarning("[OpenSearch] Music video search error: {Reason}", response.DebugInformation);
    }
}
