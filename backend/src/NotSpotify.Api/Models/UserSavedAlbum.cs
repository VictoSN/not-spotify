namespace NotSpotify.Api.Models;

public class UserSavedAlbum
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public Guid AlbumId { get; set; }
    public Album Album { get; set; } = null!;

    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}
