namespace NotSpotify.Api.Models;

public class Artist
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Match-only search blob (normalized name + romanization aliases). Built by
    /// <see cref="Services.SearchTextBuilder"/>; never displayed. Null until backfilled.
    /// </summary>
    public string? SearchText { get; set; }

    public string? Bio { get; set; }
    public string? ImageUrl { get; set; }
    public string? ImageKey { get; set; }
    public string? HeaderImageUrl { get; set; }
    public string? HeaderImageKey { get; set; }
    public long MonthlyListeners { get; set; }
    public long FollowerCount { get; set; }
    public bool Verified { get; set; }
    /// <summary>ISO-3166 alpha-2 market/origin code (e.g. "US"). Null = unspecified.</summary>
    public string? Country { get; set; }
    public string? Instagram { get; set; }
    public string? Twitter { get; set; }
    public string? Website { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsRevoked { get; set; }
    public string? RevocationNote { get; set; }
    public DateTime? RevokedAt { get; set; }

    /// <summary>When this artist's external (Ticketmaster) tour dates were last refreshed. Null = never synced.</summary>
    public DateTime? TourSyncedAt { get; set; }

    public ICollection<Album> Albums { get; set; } = new List<Album>();
    public ICollection<Track> Tracks { get; set; } = new List<Track>();
    public ICollection<Podcast> Podcasts { get; set; } = new List<Podcast>();
    public ICollection<MusicVideo> MusicVideos { get; set; } = new List<MusicVideo>();
}
