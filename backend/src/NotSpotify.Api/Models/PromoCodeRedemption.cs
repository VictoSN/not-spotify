namespace NotSpotify.Api.Models;

/// <summary>
/// Durable audit record for an in-app promotion redemption. The database's
/// unique (UserId, Code) index is the final concurrency-safe one-use guard.
/// </summary>
public class PromoCodeRedemption
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public string Code { get; set; } = string.Empty;
    public DateTime RedeemedAt { get; set; } = DateTime.UtcNow;
}
