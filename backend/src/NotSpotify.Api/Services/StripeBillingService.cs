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
    // DisplayPrice is the hard-coded shown price (MYR, average Malaysian streaming
    // rates) so the Premium page always shows a price even when Stripe isn't
    // configured. Keep these in sync with the amounts entered in Stripe and in
    // docs/stripe-setup.md.
    public sealed record PlanInfo(
        string Plan,
        string Tier,
        int MaxMembers,
        string Interval,
        string Label,
        string? DiscountLabel,
        string? DisplayPrice = null,
        string? UnavailableReason = null);

    public static readonly IReadOnlyList<PlanInfo> Catalogue = new[]
    {
        new PlanInfo("monthly", "individual", 1, "monthly", "Premium Individual",        null,                            "MYR 17.90/month"),
        new PlanInfo("yearly",  "individual", 1, "yearly",  "Premium Individual Yearly", "15% cheaper, billed annually",  "MYR 182.90/year"),
        new PlanInfo("duo",     "duo",        2, "monthly", "Premium Duo",     "For 2 people",                  "MYR 23.90/month"),
        new PlanInfo("family",  "family",     6, "monthly", "Premium Family",  "Up to 6 people",                "MYR 29.90/month"),
        new PlanInfo(
            "student",
            "student",
            1,
            "monthly",
            "Premium Student",
            "Discounted for students",
            "MYR 8.90/month",
            "Student verification is not available yet."),
    };

    // Only plans with a complete eligibility flow are advertised to clients.
    // PlanFor still knows about unavailable keys so direct API attempts receive
    // an explicit explanation instead of silently creating an unchecked plan.
    public static IEnumerable<PlanInfo> AvailableCatalogue
        => Catalogue.Where(plan => plan.UnavailableReason is null);

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

    public async Task<string> CreateProductAsync(string name, string? description, string planKey, CancellationToken ct = default)
    {
        var fields = new List<KeyValuePair<string, string>>
        {
            Pair("name", name),
            Pair("metadata[plan]", planKey),
        };
        if (!string.IsNullOrWhiteSpace(description)) fields.Add(Pair("description", description));

        var root = await PostFormAsync("products", fields, ct);
        return root.GetProperty("id").GetString()
            ?? throw new InvalidOperationException("Stripe did not return a product id.");
    }

    public async Task UpdateProductAsync(string productId, string name, string? description, bool active, CancellationToken ct = default)
    {
        var fields = new List<KeyValuePair<string, string>>
        {
            Pair("name", name),
            Pair("active", active ? "true" : "false"),
        };
        if (!string.IsNullOrWhiteSpace(description)) fields.Add(Pair("description", description));

        await PostFormAsync($"products/{Uri.EscapeDataString(productId)}", fields, ct);
    }

    public async Task<string> CreateRecurringPriceAsync(
        string productId,
        long unitAmount,
        string currency,
        string interval,
        string nickname,
        string planKey,
        string tier,
        CancellationToken ct = default)
    {
        var stripeInterval = interval == "yearly" ? "year" : "month";
        var root = await PostFormAsync("prices", new[]
        {
            Pair("product", productId),
            Pair("unit_amount", unitAmount.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            Pair("currency", currency),
            Pair("recurring[interval]", stripeInterval),
            Pair("nickname", nickname),
            Pair("metadata[plan]", planKey),
            Pair("metadata[tier]", tier),
        }, ct);

        return root.GetProperty("id").GetString()
            ?? throw new InvalidOperationException("Stripe did not return a price id.");
    }

    // Stripe has no true "delete" for a Price/Product once it exists — the only
    // supported way to remove it from active use is to set active:false. Treat a
    // resource that's already gone (deleted directly in the Stripe dashboard) as
    // success too, since the desired end state (not active) already holds.
    public async Task ArchivePriceAsync(string priceId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(priceId)) return;
        try
        {
            await PostFormAsync($"prices/{Uri.EscapeDataString(priceId)}", new[] { Pair("active", "false") }, ct);
        }
        catch (StripeResourceMissingException) { }
    }

    public async Task ArchiveProductAsync(string productId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(productId)) return;
        try
        {
            await PostFormAsync($"products/{Uri.EscapeDataString(productId)}", new[] { Pair("active", "false") }, ct);
        }
        catch (StripeResourceMissingException) { }
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

    // Lists a customer's subscriptions and returns the one that best represents
    // their current entitlement: an active/trialing/past_due subscription if any,
    // otherwise the most recently created. Returns null when the customer has none.
    // Used to reconcile Premium on the checkout-success redirect without waiting
    // for the asynchronous webhook (which may not even be configured).
    public async Task<JsonElement?> GetLatestSubscriptionAsync(string customerId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(customerId)) return null;

        var root = await GetJsonAsync(
            $"subscriptions?customer={Uri.EscapeDataString(customerId)}&status=all&limit=100", ct);
        if (!root.TryGetProperty("data", out var data) ||
            data.ValueKind != JsonValueKind.Array ||
            data.GetArrayLength() == 0)
            return null;

        JsonElement? best = null;
        long bestRank = long.MinValue;
        foreach (var sub in data.EnumerateArray())
        {
            var created = SubGetLong(sub, "created") ?? 0;
            // Premium-granting statuses outrank everything; within a rank, newest wins.
            var rank = (IsPremiumSubscriptionStatus(SubGetString(sub, "status")) ? 10_000_000_000L : 0L) + created;
            if (best is null || rank > bestRank)
            {
                best = sub;
                bestRank = rank;
            }
        }
        return best;
    }

    // Applies a Stripe subscription object to the local user, mirroring the state
    // the billing webhook records. Shared by the webhook and the on-demand sync so
    // both grant/downgrade Premium identically.
    public void ApplySubscriptionToUser(ApplicationUser user, JsonElement subscription)
    {
        var status = SubGetString(subscription, "status");

        user.StripeSubscriptionId = SubGetString(subscription, "id") ?? user.StripeSubscriptionId;
        user.StripeCustomerId = SubGetString(subscription, "customer") ?? user.StripeCustomerId;
        user.StripeSubscriptionStatus = status;
        user.StripeBillingInterval = SubscriptionInterval(subscription);
        user.StripeCurrentPeriodEnd = SubGetUnixTime(subscription, "current_period_end");
        user.StripeCancelAtPeriodEnd = SubGetBool(subscription, "cancel_at_period_end") ?? false;
        user.Plan = IsPremiumSubscriptionStatus(status) ? "premium" : "free";

        // Record which tier this subscription is on so we know the seat allowance.
        // Prefer the subscription metadata, fall back to resolving the price id.
        if (string.Equals(user.Plan, "premium", StringComparison.OrdinalIgnoreCase))
        {
            user.PlanTier = SubMetadataValue(subscription, "tier")
                ?? PlanForPriceId(SubscriptionPriceId(subscription))?.Tier
                ?? "individual";
        }
        else
        {
            user.PlanTier = "individual";
        }
    }

    public static bool IsPremiumSubscriptionStatus(string? status)
        => status is "active" or "trialing" or "past_due";

    private string? SubscriptionInterval(JsonElement subscription)
    {
        var item = FirstSubscriptionItem(subscription);
        if (item is null) return null;

        var interval = SubGetNestedString(item.Value, "price", "recurring", "interval");
        if (interval == "month") return "monthly";
        if (interval == "year") return "yearly";

        var priceId = SubGetNestedString(item.Value, "price", "id");
        if (!string.IsNullOrWhiteSpace(priceId))
        {
            if (priceId == Options.MonthlyPriceId) return "monthly";
            if (priceId == Options.YearlyPriceId) return "yearly";
        }
        return null;
    }

    private static string? SubscriptionPriceId(JsonElement subscription)
    {
        var item = FirstSubscriptionItem(subscription);
        return item is null ? null : SubGetNestedString(item.Value, "price", "id");
    }

    private static JsonElement? FirstSubscriptionItem(JsonElement subscription)
    {
        if (subscription.TryGetProperty("items", out var items) &&
            items.TryGetProperty("data", out var data) &&
            data.ValueKind == JsonValueKind.Array &&
            data.GetArrayLength() > 0)
            return data[0];
        return null;
    }

    private static string? SubGetString(JsonElement obj, string property)
        => obj.TryGetProperty(property, out var value) ? SubStringValue(value) : null;

    private static string? SubGetNestedString(JsonElement obj, params string[] path)
    {
        var current = obj;
        foreach (var segment in path)
        {
            if (!current.TryGetProperty(segment, out current)) return null;
        }
        return SubStringValue(current);
    }

    private static string? SubStringValue(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.String => value.GetString(),
        JsonValueKind.Number => value.GetRawText(),
        JsonValueKind.Object when value.TryGetProperty("id", out var id) => SubStringValue(id),
        _ => null,
    };

    private static bool? SubGetBool(JsonElement obj, string property)
    {
        if (!obj.TryGetProperty(property, out var value)) return null;
        return value.ValueKind == JsonValueKind.True ? true
             : value.ValueKind == JsonValueKind.False ? false
             : null;
    }

    private static long? SubGetLong(JsonElement obj, string property)
        => obj.TryGetProperty(property, out var value) && value.TryGetInt64(out var result) ? result : null;

    private static DateTime? SubGetUnixTime(JsonElement obj, string property)
    {
        var seconds = SubGetLong(obj, property);
        return seconds is null ? null : DateTimeOffset.FromUnixTimeSeconds(seconds.Value).UtcDateTime;
    }

    private static string? SubMetadataValue(JsonElement obj, string key)
        => obj.TryGetProperty("metadata", out var metadata) && metadata.ValueKind == JsonValueKind.Object
            ? SubGetString(metadata, key)
            : null;

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
        {
            var (message, code, parameter) = ExtractStripeError(body);
            if (res.StatusCode == System.Net.HttpStatusCode.NotFound || code == "resource_missing")
                throw new StripeResourceMissingException(
                    message ?? res.ReasonPhrase ?? "Stripe resource not found.",
                    parameter);
            throw new InvalidOperationException($"Stripe request failed ({(int)res.StatusCode}): {message ?? res.ReasonPhrase}");
        }

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.Clone();
    }

    private void EnsureConfigured()
    {
        if (!HasSecretKey)
            throw new InvalidOperationException("Stripe secret key is not configured.");
    }

    private static (string? Message, string? Code, string? Parameter) ExtractStripeError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var error = doc.RootElement.GetProperty("error");
            var message = error.TryGetProperty("message", out var m) ? m.GetString() : null;
            var code = error.TryGetProperty("code", out var c) ? c.GetString() : null;
            var parameter = error.TryGetProperty("param", out var p) ? p.GetString() : null;
            return (message, code, parameter);
        }
        catch
        {
            return (null, null, null);
        }
    }

    private static KeyValuePair<string, string> Pair(string key, string value) => new(key, value);
}

// Thrown when Stripe reports the price/product/etc. no longer exists (404 or
// error.code = "resource_missing"). Distinct from other failures so archive
// calls can treat "already gone" as success instead of blocking the caller.
public sealed class StripeResourceMissingException : InvalidOperationException
{
    public StripeResourceMissingException(string message, string? parameter = null) : base(message)
        => Parameter = parameter;

    public string? Parameter { get; }

    public bool IsMissingCustomer
        => string.Equals(Parameter, "customer", StringComparison.OrdinalIgnoreCase)
            || Message.StartsWith("No such customer", StringComparison.OrdinalIgnoreCase);
}
