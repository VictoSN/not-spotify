namespace NotSpotify.Api.Models;

public class UserSavedTrack
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;

    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}
