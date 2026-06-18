namespace NotSpotify.Api.Models;

/// <summary>
/// A user comment on a track. Supports reply threading via ParentId.
/// TimestampMs is reserved for future timed-comment (waveform) support.
/// </summary>
public class TrackComment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public string Body { get; set; } = string.Empty;

    /// <summary>Optional parent for reply threading.</summary>
    public Guid? ParentId { get; set; }
    public TrackComment? Parent { get; set; }

    /// <summary>Reserved for future timed (waveform-pinned) comments.</summary>
    public long? TimestampMs { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
