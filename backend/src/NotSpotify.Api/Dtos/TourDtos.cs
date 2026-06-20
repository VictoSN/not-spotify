namespace NotSpotify.Api.Dtos;

/// <summary>A single upcoming concert/tour date for an artist.</summary>
public record TourDateDto(
    string Id,
    DateTime EventDate,
    string City,
    string Venue,
    string Country,
    string? TicketUrl
);
