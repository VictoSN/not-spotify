namespace NotSpotify.Api.Models;

public class TrackMoodTag
{
    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;

    public Guid MoodTagId { get; set; }
    public MoodTag MoodTag { get; set; } = null!;
}
