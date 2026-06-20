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
    string? Lyrics = null,
    IEnumerable<double>? Waveform = null
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
    DateTime? RevokedAt = null,
    string? Country = null
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
    int TotalSaves = 0,
    string? Country = null
);

public record GenreDto(Guid Id, string Name, string Slug, string Color, string? ImageUrl);

public record MoodTagDto(
    Guid Id,
    string Name,
    string Slug,
    string Kind,
    string Color,
    string? Icon,
    string? SearchQuery,
    int SortOrder
);

/// <summary>Replaces the full set of mood/activity tags on a track or playlist.</summary>
public record SetMoodTagsRequest(IEnumerable<Guid> MoodTagIds);

/// <summary>Create/update payload for the admin mood-tag taxonomy editor.</summary>
public record UpsertMoodTagRequest(
    string Name,
    string Slug,
    string Kind,
    string? Color,
    string? Icon,
    string? SearchQuery,
    int SortOrder = 0
);

public record UserRefDto(Guid Id, string Name, string? AvatarUrl);

public record PlaylistTrackDto(TrackDto Track, DateTime AddedAt, UserRefDto AddedBy);

public record SmartPlaylistRulesDto(
    string? Genre = null,
    double? MinimumRating = null,
    long? MinimumPlayCount = null,
    int? AddedWithinDays = null,
    int Limit = 100
);

public record PlaylistDto(
    Guid Id,
    string Name,
    string? Description,
    string? CoverUrl,
    bool IsPublic,
    string Visibility,
    bool IsFeatured,
    int SortOrder,
    UserRefDto Owner,
    IEnumerable<PlaylistTrackDto> Tracks,
    long FollowerCount,
    long TotalDurationMs,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsOwner,
    bool IsSaved,
    SmartPlaylistRulesDto? SmartRules
);

public record PlaylistSummaryDto(
    Guid Id,
    string Name,
    string? Description,
    string? CoverUrl,
    bool IsPublic,
    string Visibility,
    bool IsFeatured,
    int SortOrder,
    UserRefDto Owner,
    int TrackCount,
    long FollowerCount,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsOwner,
    bool IsSaved,
    SmartPlaylistRulesDto? SmartRules
);

public record CreatePlaylistRequest(
    string Name,
    string? Description,
    bool IsPublic = true,
    SmartPlaylistRulesDto? SmartRules = null
);

public record UpdatePlaylistRequest(
    string? Name,
    string? Description,
    bool? IsPublic,
    string? Visibility,   // "public" | "friends" | "private"
    string? CoverUrl,
    SmartPlaylistRulesDto? SmartRules,
    bool ClearSmartRules = false
);

public record AddPlaylistTrackRequest(Guid TrackId);

/// <summary>One row of the weekly Top 50 chart.</summary>
public record ChartEntryDto(int Rank, int PlaysThisWeek, TrackDto Track);

/// <summary>A genre-based "Daily Mix" of tracks built for the listener.</summary>
public record DailyMixDto(string Id, string Title, string Subtitle, string? Color, IEnumerable<TrackDto> Tracks);

public record TrackCommentDto(
    Guid Id,
    Guid TrackId,
    UserRefDto User,
    string Body,
    Guid? ParentId,
    long? TimestampMs,
    DateTime CreatedAt
);

public record CreateCommentRequest(string Body, Guid? ParentId = null, long? TimestampMs = null);

public record RepostDto(
    Guid Id,
    UserRefDto User,
    Guid? TrackId,
    Guid? AlbumId,
    Guid? PlaylistId,
    TrackDto? Track,
    AlbumDto? Album,
    PlaylistSummaryDto? Playlist,
    DateTime CreatedAt
);

public record CreateRepostRequest(Guid? TrackId, Guid? AlbumId, Guid? PlaylistId);

public record EpisodeDto(
    Guid Id,
    Guid PodcastId,
    string PodcastTitle,
    string Title,
    string? Description,
    string AudioUrl,
    long DurationMs,
    int EpisodeNumber,
    string? ImageUrl,
    DateTime PublishedAt
);

public record PodcastSummaryDto(
    Guid Id,
    string Title,
    string Author,
    string? Description,
    string? Category,
    string? ImageUrl,
    int EpisodeCount,
    DateTime CreatedAt
);

public record PodcastDto(
    Guid Id,
    string Title,
    string Author,
    string? Description,
    string? Category,
    string? ImageUrl,
    DateTime CreatedAt,
    IEnumerable<EpisodeDto> Episodes
);

public record AdDto(
    Guid Id,
    string Title,
    string Advertiser,
    string AudioUrl,
    string? ImageUrl,
    string? ClickUrl,
    long DurationMs
);

/// <summary>Full ad row for the admin list (adds targeting + flight + stats).</summary>
public record AdAdminDto(
    Guid Id,
    string Title,
    string Advertiser,
    string AudioUrl,
    string? ImageUrl,
    string? ClickUrl,
    long DurationMs,
    string? Country,
    int Weight,
    bool IsActive,
    DateTime? StartsAt,
    DateTime? EndsAt,
    long ImpressionCount,
    DateTime CreatedAt
);

public record UpsertAdRequest(
    string Title,
    string Advertiser,
    string AudioUrl,
    string? AudioKey = null,
    string? ImageUrl = null,
    string? ClickUrl = null,
    long DurationMs = 0,
    string? Country = null,
    int Weight = 1,
    bool IsActive = true,
    DateTime? StartsAt = null,
    DateTime? EndsAt = null
);

public record AdSettingsDto(int AdsPerNTracks, bool IsEnabled);

public record UserUploadDto(
    Guid Id,
    string Title,
    string? Artist,
    string AudioUrl,
    long DurationMs,
    DateTime CreatedAt
);

// ── RBAC ────────────────────────────────────────────────────────────────────

public record TeamMemberDto(
    Guid Id,
    string Name,
    string Email,
    string? AvatarUrl,
    bool IsMaster,
    bool IsAdmin,
    DateTime CreatedAt
);

public record GrantAdminRequest(string Email);

public record PendingActionDto(
    Guid Id,
    string ActionType,
    Guid TargetUserId,
    string TargetEmail,
    string Status,
    Guid RequestedByUserId,
    string RequestedByName,
    DateTime RequestedAt,
    string? ReviewedByName,
    DateTime? ReviewedAt,
    string? ReviewNote
);

public record ReviewActionRequest(string? Note);

public record SearchResultsDto(
    IEnumerable<TrackDto> Tracks,
    IEnumerable<ArtistDto> Artists,
    IEnumerable<AlbumDto> Albums,
    IEnumerable<PlaylistSummaryDto> Playlists,
    // Tracks whose lyrics (not title) matched the query.
    IEnumerable<TrackDto> TracksByLyrics
);
