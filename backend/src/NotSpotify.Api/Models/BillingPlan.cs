namespace NotSpotify.Api.Models;

public class BillingPlan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Plan { get; set; } = string.Empty;
    public string Tier { get; set; } = "individual";
    public int MaxMembers { get; set; } = 1;
    public string Interval { get; set; } = "monthly";
    public string Label { get; set; } = string.Empty;
    public string CardTitle { get; set; } = string.Empty;
    public string? DiscountLabel { get; set; }
    public string Perks { get; set; } = string.Empty;
    public string FinePrint { get; set; } = string.Empty;
    public string AccentColor { get; set; } = "#ffd2d7";
    public string ButtonColor { get; set; } = "#ffd2d7";
    public string ButtonTextColor { get; set; } = "#000000";
    public string Currency { get; set; } = "myr";
    public long UnitAmount { get; set; }
    public string StripeProductId { get; set; } = string.Empty;
    public string StripePriceId { get; set; } = string.Empty;
    public bool IsStripeManaged { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
