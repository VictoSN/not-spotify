namespace NotSpotify.Api.Models;

/// <summary>
/// A user comment on a track. Supports reply threading via ParentId.
/// TimestampMs pins top-level comments to a point on the waveform.
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

    /// <summary>Optional waveform position for a top-level timed comment.</summary>
    public long? TimestampMs { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
