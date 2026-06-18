namespace NotSpotify.Api.Models;

public class PlaylistMoodTag
{
    public Guid PlaylistId { get; set; }
    public Playlist Playlist { get; set; } = null!;

    public Guid MoodTagId { get; set; }
    public MoodTag MoodTag { get; set; } = null!;
}
