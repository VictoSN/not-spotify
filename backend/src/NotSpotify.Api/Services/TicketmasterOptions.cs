namespace NotSpotify.Api.Services;

public class TicketmasterOptions
{
    /// <summary>
    /// Discovery API consumer key. Empty = integration disabled (tour endpoint
    /// falls back to artist-authored dates only). Set via user-secrets or env,
    /// never committed — see appsettings.json for the placeholder.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;
}
