namespace NotSpotify.Api.Models;

/// <summary>
/// A music video. Demo-scale: video is served from a URL (seeded with public
/// sample footage) or the same <c>IStorageService</c> key path as audio, and
/// plays in a plain <c>&lt;video&gt;</c> element. Linked to an artist (for the
/// name) and optionally to the catalogue <see cref="Track"/> it accompanies.
/// </summary>
public class MusicVideo
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Title { get; set; } = string.Empty;

    public Guid ArtistId { get; set; }
    public Artist Artist { get; set; } = null!;

    /// <summary>Optional link to the audio track this video accompanies.</summary>
    public Guid? TrackId { get; set; }
    public Track? Track { get; set; }

    public string VideoUrl { get; set; } = string.Empty;
    public string? VideoKey { get; set; }

    public string? ThumbnailUrl { get; set; }
    public string? ThumbnailKey { get; set; }

    public long DurationMs { get; set; }
    public long ViewCount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
