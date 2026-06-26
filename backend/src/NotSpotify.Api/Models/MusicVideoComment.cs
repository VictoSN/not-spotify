namespace NotSpotify.Api.Models;

/// <summary>
/// A user comment on a music video. Supports reply threading via ParentId.
/// TimestampMs pins top-level comments to a point on the video timeline.
/// </summary>
public class MusicVideoComment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid MusicVideoId { get; set; }
    public MusicVideo MusicVideo { get; set; } = null!;

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public string Body { get; set; } = string.Empty;

    public Guid? ParentId { get; set; }
    public MusicVideoComment? Parent { get; set; }

    public long? TimestampMs { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
