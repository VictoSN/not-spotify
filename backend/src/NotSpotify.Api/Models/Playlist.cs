namespace NotSpotify.Api.Models;

public class Playlist
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CoverUrl { get; set; }
    public string? CoverKey { get; set; }
    public bool IsPublic { get; set; } = true;

    /// <summary>
    /// Three-state visibility: "public" | "friends" | "private".
    /// Kept in sync with IsPublic: public=true/true, friends=false/friends, private=false/private.
    /// </summary>
    public string Visibility { get; set; } = "public";
    public bool IsFeatured { get; set; } = false;
    public int SortOrder { get; set; } = 0;
    /// <summary>
    /// JSON-serialized smart-playlist rules. Null means this is a regular,
    /// manually curated playlist.
    /// </summary>
    public string? Rules { get; set; }
    public long FollowerCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Guid OwnerId { get; set; }
    public ApplicationUser Owner { get; set; } = null!;

    public ICollection<PlaylistTrack> PlaylistTracks { get; set; } = new List<PlaylistTrack>();
    public ICollection<PlaylistMoodTag> PlaylistMoodTags { get; set; } = new List<PlaylistMoodTag>();
}
