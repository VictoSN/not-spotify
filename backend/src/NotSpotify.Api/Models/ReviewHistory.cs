namespace NotSpotify.Api.Models;

/// <summary>
/// Immutable log entry written every time an admin approves or rejects an album or track.
/// EntityType is "album" or "track". EntityId is the album/track Guid.
/// </summary>
public class ReviewHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>"album" or "track"</summary>
    public string EntityType { get; set; } = string.Empty;

    public Guid EntityId { get; set; }

    /// <summary>"approved" or "rejected"</summary>
    public string Action { get; set; } = string.Empty;

    public string? Note { get; set; }

    /// <summary>Display name of the admin who performed the review.</summary>
    public string? ReviewedByName { get; set; }

    public DateTime ReviewedAt { get; set; } = DateTime.UtcNow;
}
