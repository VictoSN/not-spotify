namespace NotSpotify.Api.Models;

/// <summary>
/// A concert/tour date for an artist. Initially seeded with plausible dates, but
/// artists can now manage their own from the dashboard: add/edit/cancel a show,
/// attach a <see cref="Setlist"/> of songs, and point <see cref="TicketUrl"/> at
/// wherever they actually sell tickets. No on-site payments — the ticket link is
/// just an external link the artist supplies (seeded rows default to a web search).
/// </summary>
public class TourDate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ArtistId { get; set; }
    public Artist Artist { get; set; } = null!;

    public DateTime EventDate { get; set; }
    public string City { get; set; } = string.Empty;
    public string Venue { get; set; } = string.Empty;
    /// <summary>ISO alpha-2 country code (matches the Country fields elsewhere).</summary>
    public string Country { get; set; } = string.Empty;
    public string? TicketUrl { get; set; }

    /// <summary>Ordered setlist — the songs the artist plans to play at this show.</summary>
    public ICollection<TourDateTrack> Setlist { get; set; } = new List<TourDateTrack>();
}
