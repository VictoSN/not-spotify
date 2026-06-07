namespace NotSpotify.Api.Models;

public class TrackRating
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;

    public int Rating { get; set; } // 1–5
    public DateTime RatedAt { get; set; } = DateTime.UtcNow;
}
