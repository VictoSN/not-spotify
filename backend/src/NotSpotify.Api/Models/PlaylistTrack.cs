namespace NotSpotify.Api.Models;

public class PlaylistTrack
{
    public Guid PlaylistId { get; set; }
    public Playlist Playlist { get; set; } = null!;

    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;

    public int Position { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    public Guid AddedByUserId { get; set; }
    public ApplicationUser AddedByUser { get; set; } = null!;
}
