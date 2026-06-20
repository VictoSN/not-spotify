namespace NotSpotify.Api.Services;

public class StripeBillingOptions
{
    public string SecretKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string MonthlyPriceId { get; set; } = string.Empty;
    public string YearlyPriceId { get; set; } = string.Empty;
    // Multi-seat / discounted tiers. Each is its own recurring Stripe Price; seats
    // are managed in-app (PlanMembership), so checkout still uses quantity 1.
    public string DuoPriceId { get; set; } = string.Empty;
    public string FamilyPriceId { get; set; } = string.Empty;
    public string StudentPriceId { get; set; } = string.Empty;
    public string SuccessUrl { get; set; } = "http://localhost:5173/premium?checkout=success";
    public string CancelUrl { get; set; } = "http://localhost:5173/premium?checkout=cancelled";
    public string PortalReturnUrl { get; set; } = "http://localhost:5173/account";
}
