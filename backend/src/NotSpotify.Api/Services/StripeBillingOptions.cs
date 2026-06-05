namespace NotSpotify.Api.Services;

public class StripeBillingOptions
{
    public string SecretKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string MonthlyPriceId { get; set; } = string.Empty;
    public string YearlyPriceId { get; set; } = string.Empty;
    public string SuccessUrl { get; set; } = "http://localhost:5173/premium?checkout=success";
    public string CancelUrl { get; set; } = "http://localhost:5173/premium?checkout=cancelled";
    public string PortalReturnUrl { get; set; } = "http://localhost:5173/account";
}
