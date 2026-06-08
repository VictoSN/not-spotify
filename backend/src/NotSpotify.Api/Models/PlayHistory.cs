namespace NotSpotify.Api.Models;

public class PlayHistory
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;

    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;
}
