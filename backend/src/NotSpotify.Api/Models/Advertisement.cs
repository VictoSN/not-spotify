namespace NotSpotify.Api.Models;

/// <summary>
/// A house audio ad. Free-tier playback inserts one every N tracks (see
/// <see cref="AdSettings"/>); premium never hears them — which is what makes the
/// "ad-free" perk real. Audio resolves through the same <c>IStorageService</c>
/// path as tracks so it plays through a dedicated ad element on the client.
/// </summary>
public class Advertisement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Advertiser { get; set; } = string.Empty;

    public string AudioUrl { get; set; } = string.Empty;
    public string? AudioKey { get; set; }

    public string? ImageUrl { get; set; }
    public string? ImageKey { get; set; }

    /// <summary>Optional landing page opened when the listener clicks the ad.</summary>
    public string? ClickUrl { get; set; }

    public long DurationMs { get; set; }

    /// <summary>ISO-3166 alpha-2 target market. Null = serve everywhere.</summary>
    public string? Country { get; set; }

    /// <summary>Relative weight for the weighted-random pick (higher = more often).</summary>
    public int Weight { get; set; } = 1;

    public bool IsActive { get; set; } = true;

    /// <summary>Flight window. Null bounds mean "no lower/upper limit".</summary>
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    public long ImpressionCount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Singleton config row for the ads engine. <see cref="AdsPerNTracks"/> is the
/// free-tier cadence (an ad after every N tracks); <see cref="IsEnabled"/> kills
/// all ad serving when false.
/// </summary>
public class AdSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int AdsPerNTracks { get; set; } = 3;
    public bool IsEnabled { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
