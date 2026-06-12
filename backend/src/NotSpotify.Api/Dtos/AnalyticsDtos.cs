using System.ComponentModel.DataAnnotations;

namespace NotSpotify.Api.Dtos;

public record RecordVisitRequest([StringLength(512)] string? Path);

public record PlaybackHeartbeatRequest([Required] Guid TrackId);

public record AdminTrendPointDto(string Date, int Count);

public record AdminTopTrackDto(
    Guid Id,
    string Title,
    string ArtistName,
    string AlbumTitle,
    string? CoverUrl,
    long PlayCount,
    int PlaysInWindow,
    int UniqueListeners
);

public record AdminActiveTrackDto(
    Guid Id,
    string Title,
    string ArtistName,
    string? CoverUrl,
    int ActiveListeners
);

public record AdminRecentVisitDto(
    string Path,
    string? UserName,
    DateTime VisitedAt
);

public record AdminDashboardStatsDto(
    long TotalVisits,
    int VisitsToday,
    int ActiveListeners,
    int TotalUsers,
    int PremiumUsers,
    int TotalTracks,
    int TotalArtists,
    int TotalAlbums,
    int PendingApplications,
    int PendingAlbums,
    int PendingTracks,
    int PlaysToday,
    int PlaysLast7Days,
    IEnumerable<AdminTrendPointDto> VisitsTrend,
    IEnumerable<AdminTrendPointDto> PlaysTrend,
    IEnumerable<AdminTopTrackDto> TopTracks,
    IEnumerable<AdminActiveTrackDto> ActiveTracks,
    IEnumerable<AdminRecentVisitDto> RecentVisits
);
