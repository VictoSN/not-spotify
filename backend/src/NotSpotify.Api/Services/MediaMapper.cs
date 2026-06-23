using System.Text.Json;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

public class MediaMapper
{
    private readonly IStorageService _storage;

    public MediaMapper(IStorageService storage) => _storage = storage;

    private string? ResolveImage(string? key, string? legacyUrl)
        => key is not null ? _storage.GetPublicUrl(key) : legacyUrl;

    private async Task<string> ResolveAudioAsync(string? key, string legacyUrl, CancellationToken ct = default)
        => key is not null ? await _storage.GetAudioUrlAsync(key, ct) : legacyUrl;

    public ArtistRefDto ToRef(Artist a)
        => new(a.Id, a.Name, ResolveImage(a.ImageKey, a.ImageUrl));

    public AlbumRefDto ToRef(Album a)
        => new(a.Id, a.Title, ResolveImage(a.CoverKey, a.CoverUrl) ?? string.Empty, a.ReleaseDate, a.Type);

    public UserRefDto ToRef(ApplicationUser u)
        => new(u.Id, u.Name, ResolveImage(u.AvatarKey, u.AvatarUrl));

    public UserDto ToUserDto(ApplicationUser u, IEnumerable<string> roles)
    {
        var premium = string.Equals(u.Plan, "premium", StringComparison.OrdinalIgnoreCase);
        return new UserDto(
            u.Id,
            u.Name,
            u.Email ?? string.Empty,
            ResolveImage(u.AvatarKey, u.AvatarUrl),
            u.Plan,
            u.Country,
            u.CreatedAt,
            roles,
            u.StripeSubscriptionStatus,
            u.StripeBillingInterval,
            u.StripeCurrentPeriodEnd,
            u.StripeCancelAtPeriodEnd,
            new UserCapabilitiesDto(
                UnlimitedPlayback: premium,
                CustomPlaylistPictures: true
            ),
            u.ArtistId
        );
    }

    public async Task<TrackDto> ToDtoAsync(Track t, CancellationToken ct = default, int? myRating = null)
    {
        var audioUrl = await ResolveAudioAsync(t.AudioKey, t.AudioUrl, ct);
        var avg = t.RatingCount > 0 ? Math.Round((double)t.RatingSum / t.RatingCount, 1) : 0.0;
        var genres = t.TrackGenres.Select(g => g.Genre.Slug).ToList();
        var lyrics = genres.Any(g => string.Equals(g, "instrumental", StringComparison.OrdinalIgnoreCase))
            ? null
            : t.Lyrics;

        return new TrackDto(
            t.Id,
            t.Title,
            t.DurationMs,
            audioUrl,
            t.PreviewUrl,
            t.TrackNumber,
            t.DiscNumber,
            t.Explicit,
            t.PlayCount,
            ToRef(t.Artist),
            ToRef(t.Album),
            genres,
            t.CreatedAt,
            t.RatingCount,
            avg,
            myRating,
            t.Status,
            t.ReviewNote,
            Lyrics: lyrics,
            Waveform: DeserializeWaveform(t.Waveform)
        );
    }

    public async Task<List<TrackDto>> ToDtoListAsync(IEnumerable<Track> tracks, CancellationToken ct = default, Dictionary<Guid, int>? myRatings = null)
    {
        var list = new List<TrackDto>();
        foreach (var t in tracks)
        {
            var myRating = myRatings?.GetValueOrDefault(t.Id);
            list.Add(await ToDtoAsync(t, ct, myRating));
        }
        return list;
    }

    private static double[]? DeserializeWaveform(string? waveform)
    {
        if (string.IsNullOrWhiteSpace(waveform)) return null;
        try { return JsonSerializer.Deserialize<double[]>(waveform); }
        catch (JsonException) { return null; }
    }

    public ArtistDto ToDto(Artist a, IEnumerable<string>? genres = null) => new(
        a.Id,
        a.Name,
        a.Bio,
        ResolveImage(a.ImageKey, a.ImageUrl),
        ResolveImage(a.HeaderImageKey, a.HeaderImageUrl),
        a.MonthlyListeners,
        genres ?? Array.Empty<string>(),
        a.FollowerCount,
        a.Verified,
        new SocialLinksDto(a.Instagram, a.Twitter, a.Website),
        a.CreatedAt,
        a.IsRevoked,
        a.RevocationNote,
        a.RevokedAt,
        a.Country
    );

    public AlbumDto ToDto(Album a, IEnumerable<string>? genres = null, int totalSaves = 0)
    {
        var tracks = a.Tracks.ToList();
        var totalPlays = tracks.Sum(t => t.PlayCount);
        var ratingCount = tracks.Sum(t => t.RatingCount);
        var avgRating = ratingCount > 0
            ? tracks.Where(t => t.RatingCount > 0)
                    .Sum(t => (double)t.RatingSum / t.RatingCount) / tracks.Count(t => t.RatingCount > 0)
            : 0.0;
        return new AlbumDto(
            a.Id,
            a.Title,
            a.Type,
            ResolveImage(a.CoverKey, a.CoverUrl) ?? string.Empty,
            a.ReleaseDate,
            a.TotalTracks,
            a.DurationMs,
            ToRef(a.Artist),
            genres ?? Array.Empty<string>(),
            a.Label,
            a.Copyright,
            a.Popularity,
            a.Status,
            a.ReviewNote,
            totalPlays,
            Math.Round(avgRating, 1),
            ratingCount,
            totalSaves,
            a.Country
        );
    }

    public GenreDto ToDto(Genre g) => new(g.Id, g.Name, g.Slug, g.Color, g.ImageUrl);

    public async Task<MusicVideoDto> ToDtoAsync(MusicVideo v, CancellationToken ct = default)
    {
        var videoUrl = v.VideoKey is not null ? await _storage.GetAudioUrlAsync(v.VideoKey, ct) : v.VideoUrl;
        return new MusicVideoDto(
            v.Id,
            v.Title,
            ToRef(v.Artist),
            v.TrackId,
            videoUrl,
            ResolveImage(v.ThumbnailKey, v.ThumbnailUrl),
            v.DurationMs,
            v.ViewCount,
            v.CreatedAt
        );
    }

    public async Task<AdDto> ToDtoAsync(Advertisement ad, CancellationToken ct = default)
    {
        var audioUrl = await ResolveAudioAsync(ad.AudioKey, ad.AudioUrl, ct);
        return new AdDto(
            ad.Id,
            ad.Title,
            ad.Advertiser,
            audioUrl,
            ResolveImage(ad.ImageKey, ad.ImageUrl),
            ad.ClickUrl,
            ad.DurationMs
        );
    }

    public async Task<AdAdminDto> ToAdminDtoAsync(Advertisement ad, CancellationToken ct = default)
    {
        var audioUrl = await ResolveAudioAsync(ad.AudioKey, ad.AudioUrl, ct);
        return new AdAdminDto(
            ad.Id,
            ad.Title,
            ad.Advertiser,
            audioUrl,
            ResolveImage(ad.ImageKey, ad.ImageUrl),
            ad.ClickUrl,
            ad.DurationMs,
            ad.Country,
            ad.Weight,
            ad.IsActive,
            ad.StartsAt,
            ad.EndsAt,
            ad.ImpressionCount,
            ad.CreatedAt
        );
    }

    public async Task<EpisodeDto> ToDtoAsync(Episode ep, CancellationToken ct = default)
    {
        var audioUrl = await ResolveAudioAsync(ep.AudioKey, ep.AudioUrl, ct);
        return new EpisodeDto(
            ep.Id,
            ep.PodcastId,
            ep.Podcast?.Title ?? string.Empty,
            ep.Title,
            ep.Description,
            audioUrl,
            ep.DurationMs,
            ep.EpisodeNumber,
            ResolveImage(ep.Podcast?.ImageKey, ep.Podcast?.ImageUrl),
            ep.PublishedAt
        );
    }

    public PodcastSummaryDto ToSummary(Podcast p) => new(
        p.Id,
        p.Title,
        p.Author,
        p.Description,
        p.Category,
        ResolveImage(p.ImageKey, p.ImageUrl),
        p.Episodes?.Count ?? 0,
        p.CreatedAt
    );

    public async Task<PodcastDto> ToDtoAsync(Podcast p, CancellationToken ct = default)
    {
        var episodes = new List<EpisodeDto>();
        foreach (var ep in (p.Episodes ?? new List<Episode>()).OrderBy(e => e.EpisodeNumber).ThenByDescending(e => e.PublishedAt))
        {
            ep.Podcast ??= p;
            episodes.Add(await ToDtoAsync(ep, ct));
        }
        return new PodcastDto(
            p.Id,
            p.Title,
            p.Author,
            p.Description,
            p.Category,
            ResolveImage(p.ImageKey, p.ImageUrl),
            p.CreatedAt,
            episodes
        );
    }

    public MoodTagDto ToDto(MoodTag m)
        => new(m.Id, m.Name, m.Slug, m.Kind, m.Color, m.Icon, m.SearchQuery, m.SortOrder);

    public PlaylistSummaryDto ToSummary(Playlist p, bool isOwner = false, bool isSaved = false) => new(
        p.Id,
        p.Name,
        p.Description,
        ResolveImage(p.CoverKey, p.CoverUrl),
        p.IsPublic,
        p.Visibility,
        p.IsFeatured,
        p.SortOrder,
        ToRef(p.Owner),
        p.PlaylistTracks.Count,
        p.FollowerCount,
        p.CreatedAt,
        p.UpdatedAt,
        isOwner,
        isSaved,
        SmartPlaylistService.Deserialize(p.Rules)
    );

    public async Task<PlaylistDto> ToDtoAsync(Playlist p, CancellationToken ct = default, bool isOwner = false, bool isSaved = false)
    {
        var ordered = p.PlaylistTracks.OrderBy(pt => pt.Position).ToList();
        var trackDtos = new List<PlaylistTrackDto>(ordered.Count);
        foreach (var pt in ordered)
        {
            var trackDto = await ToDtoAsync(pt.Track, ct);
            trackDtos.Add(new PlaylistTrackDto(trackDto, pt.AddedAt, ToRef(pt.AddedByUser)));
        }

        return new PlaylistDto(
            p.Id,
            p.Name,
            p.Description,
            ResolveImage(p.CoverKey, p.CoverUrl),
            p.IsPublic,
            p.Visibility,
            p.IsFeatured,
            p.SortOrder,
            ToRef(p.Owner),
            trackDtos,
            p.FollowerCount,
            p.PlaylistTracks.Sum(pt => pt.Track.DurationMs),
            p.CreatedAt,
            p.UpdatedAt,
            isOwner,
            isSaved,
            SmartPlaylistService.Deserialize(p.Rules)
        );
    }
}
