namespace NotSpotify.Api.Models;

public class UserSavedPlaylist
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public Guid PlaylistId { get; set; }
    public Playlist Playlist { get; set; } = null!;

    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}
