namespace NotSpotify.Api.Models;

/// <summary>
/// One episode of a <see cref="Podcast"/>. Audio is resolved through the same
/// <c>IStorageService</c> path as tracks (AudioKey preferred, AudioUrl legacy
/// fallback) so it plays through the existing two-deck audio engine unchanged.
/// </summary>
public class Episode
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PodcastId { get; set; }
    public Podcast Podcast { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    public string AudioUrl { get; set; } = string.Empty;
    public string? AudioKey { get; set; }

    public string? ImageUrl { get; set; }
    public string? ImageKey { get; set; }
    public bool Explicit { get; set; }

    public long DurationMs { get; set; }
    public int EpisodeNumber { get; set; }

    public DateTime PublishedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
