namespace NotSpotify.Api.Dtos;

public record AdminBillingPlanDto(
    Guid Id,
    bool IsManaged,
    string Source,
    string Plan,
    string Tier,
    int MaxMembers,
    string Interval,
    string Label,
    string CardTitle,
    string? DiscountLabel,
    string[] Perks,
    string FinePrint,
    string AccentColor,
    string ButtonColor,
    string ButtonTextColor,
    string Currency,
    long UnitAmount,
    string DisplayPrice,
    string StripeProductId,
    string StripePriceId,
    bool IsActive,
    int SortOrder,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record UpsertAdminBillingPlanRequest(
    string Plan,
    string Tier,
    int MaxMembers,
    string Interval,
    string Label,
    string? CardTitle,
    string? DiscountLabel,
    string[]? Perks,
    string? FinePrint,
    string? AccentColor,
    string? ButtonColor,
    string? ButtonTextColor,
    string Currency,
    long UnitAmount,
    bool IsActive = true,
    int SortOrder = 0
);

public record ReorderAdminBillingPlansRequest(Guid[] PlanIds);
