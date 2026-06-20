namespace NotSpotify.Api.Models;

/// <summary>
/// An upcoming concert/tour date for an artist. Demo-scale and seeded — the
/// real concert APIs (Bandsintown / Songkick) need approved keys, so instead
/// the table is seeded with plausible future dates and a ticket link that
/// points at a generic web search (a real, working link — not a fake checkout).
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
}
