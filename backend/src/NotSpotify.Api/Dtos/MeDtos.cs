using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace NotSpotify.Api.Dtos;

public record UpdateProfileRequest(
    [StringLength(120, MinimumLength = 1)] string? Name,
    [EmailAddress] string? Email,
    [StringLength(2, MinimumLength = 2)] string? Country
);

public class AvatarUploadRequest
{
    [Required]
    public IFormFile File { get; set; } = null!;
}

public record RecentSearchRequest([Required, StringLength(120, MinimumLength = 1)] string Term);

public record RecentSearchDto(Guid Id, string Term, DateTime SearchedAt);

public record PlayHistoryDto(TrackDto Track, DateTime PlayedAt);

// ── Personal listening stats ("mini-Wrapped") ──────────────────────────────
public record StatTrackDto(TrackDto Track, int PlayCount);
public record StatArtistDto(string ArtistId, string Name, int PlayCount);
public record StatGenreDto(string Name, int PlayCount);
public record StatDayDto(string Date, int Count);

public record ListeningStatsDto(
    int Days,
    int TotalPlays,
    int TotalMinutes,
    int UniqueTracks,
    int UniqueArtists,
    IEnumerable<StatTrackDto> TopTracks,
    IEnumerable<StatArtistDto> TopArtists,
    IEnumerable<StatGenreDto> TopGenres,
    IEnumerable<StatDayDto> ByDay
);

public class PlaylistCoverUploadRequest
{
    [Required]
    public IFormFile File { get; set; } = null!;
}

public record RateTrackRequest([Required, Range(1, 5)] int Rating);

public record TrackRatingResultDto(int RatingCount, double AverageRating, int MyRating);
