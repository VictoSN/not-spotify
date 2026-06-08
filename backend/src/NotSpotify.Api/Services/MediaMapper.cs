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
            t.TrackGenres.Select(g => g.Genre.Slug),
            t.CreatedAt,
            t.RatingCount,
            avg,
            myRating,
            t.Status,
            t.ReviewNote
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
        a.CreatedAt
    );

    public AlbumDto ToDto(Album a, IEnumerable<string>? genres = null) => new(
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
        a.ReviewNote
    );

    public GenreDto ToDto(Genre g) => new(g.Id, g.Name, g.Slug, g.Color, g.ImageUrl);

    public PlaylistSummaryDto ToSummary(Playlist p, bool isOwner = false, bool isSaved = false) => new(
        p.Id,
        p.Name,
        p.Description,
        ResolveImage(p.CoverKey, p.CoverUrl),
        p.IsPublic,
        ToRef(p.Owner),
        p.PlaylistTracks.Count,
        p.FollowerCount,
        p.CreatedAt,
        p.UpdatedAt,
        isOwner,
        isSaved
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
            ToRef(p.Owner),
            trackDtos,
            p.FollowerCount,
            p.PlaylistTracks.Sum(pt => pt.Track.DurationMs),
            p.CreatedAt,
            p.UpdatedAt,
            isOwner,
            isSaved
        );
    }
}
