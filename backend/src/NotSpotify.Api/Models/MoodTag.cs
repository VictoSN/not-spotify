namespace NotSpotify.Api.Models;

/// <summary>
/// A mood ("Chill", "Hype") or activity ("Focus", "Workout") tag in the browse
/// taxonomy. Tracks and playlists are tagged via the join tables; the /moods
/// browse page falls back to <see cref="SearchQuery"/> when a tag has no
/// curated assignments yet.
/// </summary>
public class MoodTag
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;

    /// <summary>"mood" | "activity" — drives grouping on the browse page.</summary>
    public string Kind { get; set; } = "mood";

    public string Color { get; set; } = "#888888";

    /// <summary>Heroicon component name the frontend renders on the card (e.g. "BoltIcon").</summary>
    public string? Icon { get; set; }

    /// <summary>Free-text catalogue search used as a fallback when no tracks are tagged yet.</summary>
    public string? SearchQuery { get; set; }

    public int SortOrder { get; set; }

    public ICollection<TrackMoodTag> TrackMoodTags { get; set; } = new List<TrackMoodTag>();
    public ICollection<PlaylistMoodTag> PlaylistMoodTags { get; set; } = new List<PlaylistMoodTag>();
}
