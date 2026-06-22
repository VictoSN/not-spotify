using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using NotSpotify.Api.Dtos;

namespace NotSpotify.Api.Services;

/// <summary>
/// Pulls real upcoming concerts from the Ticketmaster Discovery API (the same kind
/// of ticketing partner Spotify aggregates) and shapes them into the app's
/// <see cref="TourDateDto"/>. Like Spotify's On Tour section, matching is by
/// performer (attraction) name, so festivals/co-bills featuring the artist surface
/// too. Best-effort: a missing key, a network error, or a bad response is swallowed
/// and treated as "no events", so the tour endpoint never fails just because the
/// external API is unavailable.
/// </summary>
public class TicketmasterService
{
    private const string BaseUrl = "https://app.ticketmaster.com/discovery/v2/events.json";

    private readonly HttpClient _http;
    private readonly TicketmasterOptions _options;
    private readonly ILogger<TicketmasterService> _logger;

    public TicketmasterService(HttpClient http, IOptions<TicketmasterOptions> options, ILogger<TicketmasterService> logger)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(8);
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey);

    /// <summary>
    /// Looks up upcoming music events whose attraction (performer) name matches
    /// <paramref name="artistName"/>. Returns an empty list on any failure.
    /// </summary>
    public async Task<List<TourDateDto>> SearchEventsAsync(string artistName, int size, CancellationToken ct = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(artistName)) return [];

        try
        {
            var url = $"{BaseUrl}?apikey={Uri.EscapeDataString(_options.ApiKey)}"
                + $"&keyword={Uri.EscapeDataString(artistName)}"
                + "&classificationName=Music&sort=date,asc"
                + $"&size={Math.Clamp(size, 1, 50)}";

            var resp = await _http.GetFromJsonAsync<TmResponse>(url, ct);
            var events = resp?.Embedded?.Events;
            if (events is not { Count: > 0 }) return [];

            var results = new List<TourDateDto>();
            foreach (var ev in events)
            {
                if (!Matches(ev, artistName)) continue;
                var dto = ToDto(ev);
                if (dto is not null) results.Add(dto);
            }
            return results;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            _logger.LogDebug(ex, "Ticketmaster lookup failed for {Artist}", artistName);
            return [];
        }
    }

    /// <summary>
    /// Keyword search is fuzzy, so keep only events that actually feature an
    /// attraction matching the artist name — otherwise a search for "Ana" returns
    /// every act with "Ana" in the title.
    /// </summary>
    private static bool Matches(TmEvent ev, string artistName)
    {
        var attractions = ev.Embedded?.Attractions;
        if (attractions is not { Count: > 0 }) return false;
        return attractions.Any(a =>
            string.Equals(a.Name?.Trim(), artistName.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    private static TourDateDto? ToDto(TmEvent ev)
    {
        if (!TryGetDate(ev, out var when)) return null;

        var venue = ev.Embedded?.Venues?.FirstOrDefault();
        return new TourDateDto(
            Id: $"tm:{ev.Id}",
            EventDate: when,
            City: venue?.City?.Name ?? string.Empty,
            Venue: venue?.Name ?? "Venue TBA",
            Country: venue?.Country?.CountryCode ?? string.Empty,
            TicketUrl: ev.Url,
            // Ticketmaster doesn't expose setlists; that stays an artist-only feature.
            Songs: []);
    }

    private static bool TryGetDate(TmEvent ev, out DateTime when)
    {
        var start = ev.Dates?.Start;
        // Prefer the precise UTC instant; fall back to the local date (no time known).
        if (!string.IsNullOrWhiteSpace(start?.DateTime)
            && DateTime.TryParse(start.DateTime, null,
                System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal,
                out when))
            return true;

        if (!string.IsNullOrWhiteSpace(start?.LocalDate)
            && DateTime.TryParse(start.LocalDate, null,
                System.Globalization.DateTimeStyles.AssumeUniversal, out when))
        {
            when = DateTime.SpecifyKind(when, DateTimeKind.Utc);
            return true;
        }

        when = default;
        return false;
    }

    // --- Discovery API response shapes (only the fields we use) ---

    private record TmResponse([property: JsonPropertyName("_embedded")] TmEmbedded? Embedded);
    private record TmEmbedded(
        [property: JsonPropertyName("events")] List<TmEvent>? Events,
        [property: JsonPropertyName("attractions")] List<TmAttraction>? Attractions,
        [property: JsonPropertyName("venues")] List<TmVenue>? Venues);

    private record TmEvent(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("url")] string? Url,
        [property: JsonPropertyName("dates")] TmDates? Dates,
        [property: JsonPropertyName("_embedded")] TmEmbedded? Embedded);

    private record TmDates([property: JsonPropertyName("start")] TmStart? Start);
    private record TmStart(
        [property: JsonPropertyName("dateTime")] string? DateTime,
        [property: JsonPropertyName("localDate")] string? LocalDate);

    private record TmAttraction([property: JsonPropertyName("name")] string? Name);
    private record TmVenue(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("city")] TmCity? City,
        [property: JsonPropertyName("country")] TmCountry? Country);
    private record TmCity([property: JsonPropertyName("name")] string? Name);
    private record TmCountry([property: JsonPropertyName("countryCode")] string? CountryCode);
}
