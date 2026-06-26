namespace NotSpotify.Api.Models;

/// <summary>
/// Per-device Web Push subscription registered from the browser via
/// PushManager.subscribe(). One user can have many (per device/browser).
/// </summary>
public class PushSubscriptionRow
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }

    /// <summary>Push service endpoint (FCM/Mozilla autopush/Edge). Unique per subscription.</summary>
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>Public ECDH key (p256dh) for envelope encryption.</summary>
    public string P256dh { get; set; } = string.Empty;

    /// <summary>Auth secret used in HKDF salt.</summary>
    public string AuthSecret { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
