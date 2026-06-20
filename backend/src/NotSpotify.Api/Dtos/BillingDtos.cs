namespace NotSpotify.Api.Dtos;

public record BillingPlanDto(
    string Plan,        // unique key: monthly | yearly | duo | family | student
    string Tier,        // individual | duo | family | student
    int MaxMembers,     // total seats incl. the owner (1 = no sharing)
    string Interval,    // billing interval: monthly | yearly
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

// Plan identifies the tier to subscribe to (monthly | yearly | duo | family |
// student). Interval is accepted for backward compatibility with older clients.
public record CreateCheckoutSessionRequest(string? Plan = null, string? Interval = null);

public record BillingRedirectDto(string Url);
