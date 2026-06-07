namespace NotSpotify.Api.Models;

public class Track
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public long DurationMs { get; set; }
    public string AudioUrl { get; set; } = string.Empty;
    public string? AudioKey { get; set; }
    public string? PreviewUrl { get; set; }
    public int TrackNumber { get; set; }
    public int DiscNumber { get; set; } = 1;
    public bool Explicit { get; set; }
    public long PlayCount { get; set; }
    public int RatingCount { get; set; }
    public int RatingSum { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // approved | pending | rejected  (admin-created tracks are approved by default)
    public string Status { get; set; } = "approved";
    public Guid? SubmittedByUserId { get; set; }
    public ApplicationUser? SubmittedBy { get; set; }

    public Guid ArtistId { get; set; }
    public Artist Artist { get; set; } = null!;

    public Guid AlbumId { get; set; }
    public Album Album { get; set; } = null!;

    public ICollection<TrackGenre> TrackGenres { get; set; } = new List<TrackGenre>();
    public ICollection<PlaylistTrack> PlaylistTracks { get; set; } = new List<PlaylistTrack>();
    public ICollection<TrackRating> Ratings { get; set; } = new List<TrackRating>();
}
