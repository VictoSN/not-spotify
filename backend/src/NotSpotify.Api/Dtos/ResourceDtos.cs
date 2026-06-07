namespace NotSpotify.Api.Dtos;

public record SavedTrackDto(TrackDto Track, DateTime SavedAt);

public record ArtistRefDto(Guid Id, string Name, string? ImageUrl);

public record AlbumRefDto(Guid Id, string Title, string CoverUrl, DateOnly ReleaseDate, string Type);

public record TrackDto(
    Guid Id,
    string Title,
    long DurationMs,
    string AudioUrl,
    string? PreviewUrl,
    int TrackNumber,
    int DiscNumber,
    bool Explicit,
    long PlayCount,
    ArtistRefDto Artist,
    AlbumRefDto Album,
    IEnumerable<string> Genres,
    DateTime CreatedAt,
    int RatingCount,
    double AverageRating,
    int? MyRating
);

public record ArtistDto(
    Guid Id,
    string Name,
    string? Bio,
    string? ImageUrl,
    string? HeaderImageUrl,
    long MonthlyListeners,
    IEnumerable<string> Genres,
    long FollowerCount,
    bool Verified,
    SocialLinksDto SocialLinks,
    DateTime CreatedAt
);

public record SocialLinksDto(string? Instagram, string? Twitter, string? Website);

public record AlbumDto(
    Guid Id,
    string Title,
    string Type,
    string CoverUrl,
    DateOnly ReleaseDate,
    int TotalTracks,
    long DurationMs,
    ArtistRefDto Artist,
    IEnumerable<string> Genres,
    string? Label,
    string? Copyright,
    int Popularity,
    string Status
);

public record GenreDto(Guid Id, string Name, string Slug, string Color, string? ImageUrl);

public record UserRefDto(Guid Id, string Name, string? AvatarUrl);

public record PlaylistTrackDto(TrackDto Track, DateTime AddedAt, UserRefDto AddedBy);

public record PlaylistDto(
    Guid Id,
    string Name,
    string? Description,
    string? CoverUrl,
    bool IsPublic,
    UserRefDto Owner,
    IEnumerable<PlaylistTrackDto> Tracks,
    long FollowerCount,
    long TotalDurationMs,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsOwner,
    bool IsSaved
);

public record PlaylistSummaryDto(
    Guid Id,
    string Name,
    string? Description,
    string? CoverUrl,
    bool IsPublic,
    UserRefDto Owner,
    int TrackCount,
    long FollowerCount,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsOwner,
    bool IsSaved
);

public record CreatePlaylistRequest(string Name, string? Description, bool IsPublic = true);

public record UpdatePlaylistRequest(string? Name, string? Description, bool? IsPublic, string? CoverUrl);

public record AddPlaylistTrackRequest(Guid TrackId);

public record SearchResultsDto(
    IEnumerable<TrackDto> Tracks,
    IEnumerable<ArtistDto> Artists,
    IEnumerable<AlbumDto> Albums,
    IEnumerable<PlaylistSummaryDto> Playlists
);
