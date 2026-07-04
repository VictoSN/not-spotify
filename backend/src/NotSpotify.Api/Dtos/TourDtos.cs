namespace NotSpotify.Api.Dtos;

/// <summary>A single song on a tour date's setlist.</summary>
public record TourSongDto(
    string TrackId,
    string Title,
    string ArtistName,
    long DurationMs
);

/// <summary>A concert/tour date for an artist, including its setlist.</summary>
public record TourDateDto(
    string Id,
    DateTime EventDate,
    string City,
    string Venue,
    string Country,
    string? TicketUrl,
    IReadOnlyList<TourSongDto> Songs
);

/// <summary>An upcoming event enriched with the artist data needed by Live Events discovery.</summary>
public record LiveEventArtistDto(
    string Id,
    string Name,
    string? ImageUrl,
    string? HeaderImageUrl,
    long MonthlyListeners,
    IReadOnlyList<string> Genres
);

public record LiveEventDto(
    string Id,
    DateTime EventDate,
    string City,
    string Venue,
    string Country,
    string? TicketUrl,
    IReadOnlyList<TourSongDto> Songs,
    LiveEventArtistDto Artist
);

/// <summary>Create/update payload for an artist-managed tour date.</summary>
public record TourDateUpsertRequest(
    DateTime EventDate,
    string City,
    string Venue,
    string? Country,
    string? TicketUrl
);

/// <summary>Replace a tour date's setlist with these tracks, in order.</summary>
public record TourSetlistRequest(
    IReadOnlyList<string> TrackIds
);
