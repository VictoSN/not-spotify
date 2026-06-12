using System.Text.Json.Serialization;

namespace NotSpotify.Api.Dtos;

/// <summary>Response from GET /tracks/{id}/lyrics</summary>
public record LyricsDto(string? Lyrics, string? SyncedLyrics, string Source);

/// <summary>Shape returned by the Lyrics.ovh public API.</summary>
public record LyricsOvhResponse([property: JsonPropertyName("lyrics")] string? Lyrics);

/// <summary>Shape returned by the LRCLIB public API (both /api/get and /api/search items).</summary>
public record LrclibResponse(
    [property: JsonPropertyName("plainLyrics")] string? PlainLyrics,
    [property: JsonPropertyName("syncedLyrics")] string? SyncedLyrics,
    [property: JsonPropertyName("instrumental")] bool Instrumental,
    [property: JsonPropertyName("duration")] double? Duration
);

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
    int? MyRating,
    string? Status = null,
    string? ReviewNote = null,
    int SavedCount = 0,
    string? Lyrics = null
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
    DateTime CreatedAt,
    bool IsRevoked = false,
    string? RevocationNote = null,
    DateTime? RevokedAt = null
);

public record ReviewHistoryDto(
    Guid Id,
    string EntityType,
    Guid EntityId,
    string Action,
    string? Note,
    string? ReviewedByName,
    DateTime ReviewedAt
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
    string Status,
    string? ReviewNote = null,
    long TotalPlays = 0,
    double AverageRating = 0.0,
    int RatingCount = 0,
    int TotalSaves = 0
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
    string Visibility,
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
    string Visibility,
    UserRefDto Owner,
    int TrackCount,
    long FollowerCount,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsOwner,
    bool IsSaved
);

public record CreatePlaylistRequest(string Name, string? Description, bool IsPublic = true);

public record UpdatePlaylistRequest(
    string? Name,
    string? Description,
    bool? IsPublic,
    string? Visibility,   // "public" | "friends" | "private"
    string? CoverUrl
);

public record AddPlaylistTrackRequest(Guid TrackId);

public record SearchResultsDto(
    IEnumerable<TrackDto> Tracks,
    IEnumerable<ArtistDto> Artists,
    IEnumerable<AlbumDto> Albums,
    IEnumerable<PlaylistSummaryDto> Playlists
);
