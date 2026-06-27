namespace NotSpotify.Api.Models;

public class UserAccountPreference
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public bool AllowPersonalizedAds { get; set; } = true;
    public bool BlockAlcoholAds { get; set; } = false;
    public bool BlockGamblingAds { get; set; } = false;
    public bool EmailProductUpdates { get; set; } = true;
    public bool EmailSecurityAlerts { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
