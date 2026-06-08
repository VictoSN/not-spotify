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

public class PlaylistCoverUploadRequest
{
    [Required]
    public IFormFile File { get; set; } = null!;
}

public record RateTrackRequest([Required, Range(1, 5)] int Rating);

public record TrackRatingResultDto(int RatingCount, double AverageRating, int MyRating);
