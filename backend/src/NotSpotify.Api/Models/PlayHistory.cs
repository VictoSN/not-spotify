namespace NotSpotify.Api.Models;

public class PlayHistory
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;

    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// The surface the play started from: "playlist" | "album" | "artist" | "liked" | "mix".
    /// Null for standalone plays (a track card, search result, queue page…). Lets the
    /// recents page group a listening session under its playlist/album.
    /// </summary>
    public string? ContextType { get; set; }

    /// <summary>
    /// Id of the context — a playlist/album/artist Guid, a daily-mix genre slug,
    /// or the literal "liked". Stored as text since not every context is a Guid.
    /// </summary>
    public string? ContextId { get; set; }
}
