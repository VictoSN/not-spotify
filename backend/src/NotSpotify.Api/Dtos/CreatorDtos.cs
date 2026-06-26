using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace NotSpotify.Api.Dtos;

public record ArtistPodcastUpsertRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Title,
    [StringLength(1000)] string? Description = null,
    [StringLength(80)] string? Category = null
);

public class ArtistEpisodeUploadForm
{
    [Required]
    public IFormFile File { get; set; } = null!;

    public IFormFile? Image { get; set; }

    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    [Range(0, long.MaxValue)]
    public long DurationMs { get; set; }

    [Range(1, int.MaxValue)]
    public int? EpisodeNumber { get; set; }

    public bool Explicit { get; set; }

    public DateTime? PublishedAt { get; set; }
}

public record ArtistEpisodeUpdateRequest(
    string? Title,
    string? Description,
    long? DurationMs,
    int? EpisodeNumber,
    bool? Explicit,
    DateTime? PublishedAt
);

public class ArtistMusicVideoUploadForm
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    public Guid? TrackId { get; set; }

    [Required]
    public IFormFile Video { get; set; } = null!;

    public IFormFile? Thumbnail { get; set; }

    [Range(0, long.MaxValue)]
    public long DurationMs { get; set; }
}

public record ArtistMusicVideoUpdateRequest(
    string? Title,
    string? Description,
    Guid? TrackId,
    bool ClearTrack = false
);
