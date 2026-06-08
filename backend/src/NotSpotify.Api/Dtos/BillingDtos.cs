namespace NotSpotify.Api.Dtos;

public record BillingPlanDto(
    string Interval,
    string Label,
    string PriceId,
    bool IsConfigured,
    string? DiscountLabel,
    string? DisplayPrice,
    string? MissingConfiguration
);

public record BillingSubscriptionDto(
    string Plan,
    string? Status,
    string? Interval,
    DateTime? CurrentPeriodEnd,
    bool CancelAtPeriodEnd
);

public record CreateCheckoutSessionRequest(string Interval);

public record BillingRedirectDto(string Url);
