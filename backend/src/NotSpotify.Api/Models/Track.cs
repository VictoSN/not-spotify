namespace NotSpotify.Api.Models;

public class Track
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public long DurationMs { get; set; }
    public string AudioUrl { get; set; } = string.Empty;
    public string? AudioKey { get; set; }
    public string? PreviewUrl { get; set; }
    public int TrackNumber { get; set; }
    public int DiscNumber { get; set; } = 1;
    public bool Explicit { get; set; }
    public long PlayCount { get; set; }
    public int RatingCount { get; set; }
    public int RatingSum { get; set; }
    /// <summary>JSON array of normalized 0..1 waveform peaks extracted at upload.</summary>
    public string? Waveform { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Optional lyrics text (plain text, line-breaks preserved).
    /// Null means no lyrics stored yet — the API will attempt a Lyrics.ovh fallback on request.
    /// </summary>
    public string? Lyrics { get; set; }

    /// <summary>
    /// Time-synced lyrics in LRC format ("[mm:ss.xx] line"), used by the karaoke view.
    /// Null = never looked up; empty string = looked up but the provider had no synced
    /// version (sentinel so we don't re-query LRCLIB on every lyrics request).
    /// </summary>
    public string? SyncedLyrics { get; set; }

    /// <summary>
    /// Match-only search blob: normalized title + artist/album names + romanization
    /// aliases (pinyin, no-space pinyin, initials, English). Built by
    /// <see cref="Services.SearchTextBuilder"/>. Never displayed — the UI always shows
    /// the original <see cref="Title"/>. Null until backfilled.
    /// </summary>
    public string? SearchText { get; set; }

    // approved | pending | rejected  (admin-created tracks are approved by default)
    public string Status { get; set; } = "approved";
    public string? ReviewNote { get; set; }
    public Guid? SubmittedByUserId { get; set; }
    public ApplicationUser? SubmittedBy { get; set; }

    public Guid ArtistId { get; set; }
    public Artist Artist { get; set; } = null!;

    public Guid AlbumId { get; set; }
    public Album Album { get; set; } = null!;

    public ICollection<TrackGenre> TrackGenres { get; set; } = new List<TrackGenre>();
    public ICollection<TrackMoodTag> TrackMoodTags { get; set; } = new List<TrackMoodTag>();
    public ICollection<PlaylistTrack> PlaylistTracks { get; set; } = new List<PlaylistTrack>();
    public ICollection<TrackRating> Ratings { get; set; } = new List<TrackRating>();
}
