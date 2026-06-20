using System.Net.Http.Headers;
using System.Text.Json;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

public class StripeBillingService
{
    private readonly HttpClient _http;
    public StripeBillingOptions Options { get; }

    public StripeBillingService(HttpClient http, IConfiguration config)
    {
        _http = http;
        Options = config.GetSection("Stripe").Get<StripeBillingOptions>() ?? new StripeBillingOptions();
        _http.BaseAddress = new Uri("https://api.stripe.com/v1/");
    }

    public bool HasSecretKey => !string.IsNullOrWhiteSpace(Options.SecretKey);

    // The plan catalogue. Each plan is a distinct recurring Stripe Price; the
    // multi-seat tiers (duo/family) manage seats in-app via PlanMembership, so
    // their Checkout Session still uses quantity 1.
    public sealed record PlanInfo(string Plan, string Tier, int MaxMembers, string Interval, string Label, string? DiscountLabel);

    public static readonly IReadOnlyList<PlanInfo> Catalogue = new[]
    {
        new PlanInfo("monthly", "individual", 1, "monthly", "Premium Monthly", null),
        new PlanInfo("yearly",  "individual", 1, "yearly",  "Premium Yearly",  "15% cheaper, billed annually"),
        new PlanInfo("duo",     "duo",        2, "monthly", "Premium Duo",     "For 2 people"),
        new PlanInfo("family",  "family",     6, "monthly", "Premium Family",  "Up to 6 people"),
        new PlanInfo("student", "student",    1, "monthly", "Premium Student", "Discounted for students"),
    };

    public static PlanInfo? PlanFor(string? plan)
        => Catalogue.FirstOrDefault(p => string.Equals(p.Plan, NormalizePlan(plan), StringComparison.OrdinalIgnoreCase));

    // Maps a tier (as recorded on a subscription) back to its seat allowance.
    public static int MaxMembersForTier(string? tier)
        => Catalogue.FirstOrDefault(p => string.Equals(p.Tier, tier, StringComparison.OrdinalIgnoreCase))?.MaxMembers ?? 1;

    private static string? NormalizePlan(string? plan) => plan?.Trim().ToLowerInvariant() switch
    {
        "monthly" or "month" => "monthly",
        "yearly" or "annual" or "annually" or "year" => "yearly",
        "duo" => "duo",
        "family" => "family",
        "student" => "student",
        _ => null,
    };

    public string? PriceIdForPlan(string? plan)
    {
        var key = NormalizePlan(plan);
        var id = key switch
        {
            "monthly" => Options.MonthlyPriceId,
            "yearly" => Options.YearlyPriceId,
            "duo" => Options.DuoPriceId,
            "family" => Options.FamilyPriceId,
            "student" => Options.StudentPriceId,
            _ => null,
        };
        return string.IsNullOrWhiteSpace(id) ? null : id;
    }

    // Resolve a Stripe price id back to its plan (used by the webhook to record
    // which tier a subscription is on).
    public PlanInfo? PlanForPriceId(string? priceId)
    {
        if (string.IsNullOrWhiteSpace(priceId)) return null;
        string? plan =
            priceId == Options.MonthlyPriceId ? "monthly" :
            priceId == Options.YearlyPriceId ? "yearly" :
            priceId == Options.DuoPriceId ? "duo" :
            priceId == Options.FamilyPriceId ? "family" :
            priceId == Options.StudentPriceId ? "student" : null;
        return PlanFor(plan);
    }

    public string? PriceIdFor(string interval) => PriceIdForPlan(interval);

    public async Task<string> CreateCustomerAsync(ApplicationUser user, CancellationToken ct = default)
    {
        var root = await PostFormAsync("customers", new[]
        {
            Pair("email", user.Email ?? string.Empty),
            Pair("name", user.Name),
            Pair("metadata[userId]", user.Id.ToString()),
        }, ct);

        return root.GetProperty("id").GetString()
            ?? throw new InvalidOperationException("Stripe did not return a customer id.");
    }

    public async Task<string> CreateCheckoutSessionAsync(ApplicationUser user, string priceId, PlanInfo plan, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(user.StripeCustomerId))
            throw new InvalidOperationException("User must have a Stripe customer id before checkout.");

        // No payment_method_types — Stripe selects eligible methods dynamically
        // from Dashboard settings (per Stripe best practices for subscriptions).
        var root = await PostFormAsync("checkout/sessions", new[]
        {
            Pair("mode", "subscription"),
            Pair("customer", user.StripeCustomerId),
            Pair("client_reference_id", user.Id.ToString()),
            Pair("success_url", Options.SuccessUrl),
            Pair("cancel_url", Options.CancelUrl),
            Pair("allow_promotion_codes", "true"),
            Pair("line_items[0][price]", priceId),
            Pair("line_items[0][quantity]", "1"),
            Pair("metadata[userId]", user.Id.ToString()),
            Pair("metadata[interval]", plan.Interval),
            Pair("metadata[tier]", plan.Tier),
            Pair("subscription_data[metadata][userId]", user.Id.ToString()),
            Pair("subscription_data[metadata][interval]", plan.Interval),
            Pair("subscription_data[metadata][tier]", plan.Tier),
        }, ct);

        return root.GetProperty("url").GetString()
            ?? throw new InvalidOperationException("Stripe did not return a checkout URL.");
    }

    public async Task<string> CreatePortalSessionAsync(string customerId, CancellationToken ct = default)
    {
        var root = await PostFormAsync("billing_portal/sessions", new[]
        {
            Pair("customer", customerId),
            Pair("return_url", Options.PortalReturnUrl),
        }, ct);

        return root.GetProperty("url").GetString()
            ?? throw new InvalidOperationException("Stripe did not return a portal URL.");
    }

    public Task<JsonElement> FetchSubscriptionAsync(string subscriptionId, CancellationToken ct = default)
        => GetJsonAsync($"subscriptions/{Uri.EscapeDataString(subscriptionId)}", ct);

    public async Task CancelSubscriptionAsync(string subscriptionId, CancellationToken ct = default)
    {
        EnsureConfigured();
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"subscriptions/{Uri.EscapeDataString(subscriptionId)}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Options.SecretKey);
        await SendJsonAsync(req, ct);
    }

    public Task<JsonElement> FetchPriceAsync(string priceId, CancellationToken ct = default)
        => GetJsonAsync($"prices/{Uri.EscapeDataString(priceId)}", ct);

    private async Task<JsonElement> PostFormAsync(string path, IEnumerable<KeyValuePair<string, string>> fields, CancellationToken ct)
    {
        EnsureConfigured();
        using var req = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = new FormUrlEncodedContent(fields),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Options.SecretKey);
        return await SendJsonAsync(req, ct);
    }

    private async Task<JsonElement> GetJsonAsync(string path, CancellationToken ct)
    {
        EnsureConfigured();
        using var req = new HttpRequestMessage(HttpMethod.Get, path);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Options.SecretKey);
        return await SendJsonAsync(req, ct);
    }

    private async Task<JsonElement> SendJsonAsync(HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await _http.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"Stripe request failed ({(int)res.StatusCode}): {ExtractStripeError(body) ?? res.ReasonPhrase}");

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.Clone();
    }

    private void EnsureConfigured()
    {
        if (!HasSecretKey)
            throw new InvalidOperationException("Stripe secret key is not configured.");
    }

    private static string? ExtractStripeError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement
                .GetProperty("error")
                .GetProperty("message")
                .GetString();
        }
        catch
        {
            return null;
        }
    }

    private static KeyValuePair<string, string> Pair(string key, string value) => new(key, value);
}
