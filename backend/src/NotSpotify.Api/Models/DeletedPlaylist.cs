namespace NotSpotify.Api.Models;

public class DeletedPlaylist
{
    public Guid Id { get; set; }
    public Guid OriginalPlaylistId { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CoverUrl { get; set; }
    public string? CoverKey { get; set; }
    public bool IsPublic { get; set; }
    public string Visibility { get; set; } = "public";
    public string? Rules { get; set; }
    public string TracksJson { get; set; } = "[]";
    public DateTime DeletedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(30);
}
