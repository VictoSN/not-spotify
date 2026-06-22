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

    /// <summary>
    /// Where this row came from: "artist" (entered in the dashboard — the source of
    /// truth, never touched by the sync) or "ticketmaster" (cached from the external
    /// API by <c>TourSyncService</c>). Artist rows always win on a collision.
    /// </summary>
    public string Source { get; set; } = "artist";

    /// <summary>Provider's event id for synced rows (e.g. a Ticketmaster event id); null for artist rows. Used to upsert.</summary>
    public string? ExternalId { get; set; }

    /// <summary>Ordered setlist — the songs the artist plans to play at this show.</summary>
    public ICollection<TourDateTrack> Setlist { get; set; } = new List<TourDateTrack>();
}
