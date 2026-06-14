namespace NotSpotify.Api.Models;

/// <summary>
/// An in-app notification addressed to a single user (the bell menu).
/// Producers create these via NotificationService; the frontend polls
/// (and receives a live SignalR nudge) to render the unread badge + list.
/// </summary>
public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Recipient.</summary>
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    /// <summary>
    /// Machine-readable kind, e.g. "friend_request", "friend_accepted",
    /// "approval", "rejection", "system". Drives the icon on the client.
    /// </summary>
    public string Type { get; set; } = "system";

    public string Title { get; set; } = string.Empty;
    public string? Body { get; set; }

    /// <summary>Optional in-app link the notification opens, e.g. "/user/{id}".</summary>
    public string? LinkUrl { get; set; }

    /// <summary>Optional avatar/cover to show, e.g. the actor's avatar URL.</summary>
    public string? ImageUrl { get; set; }

    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
