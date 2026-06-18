namespace NotSpotify.Api.Models;

/// <summary>
/// A repost (re-share) by a user to their followers.
/// Extends the asymmetric follow graph — followers see reposts in their feed.
/// Polymorphic: can reference a Track, Album, or Playlist.
/// </summary>
public class Repost
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Who reposted.</summary>
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public Guid? TrackId { get; set; }
    public Track? Track { get; set; }

    public Guid? AlbumId { get; set; }
    public Album? Album { get; set; }

    public Guid? PlaylistId { get; set; }
    public Playlist? Playlist { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
