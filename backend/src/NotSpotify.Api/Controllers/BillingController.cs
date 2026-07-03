using System.Security.Claims;
using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("billing")]
public partial class BillingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly StripeBillingService _stripe;

    public BillingController(AppDbContext db, StripeBillingService stripe)
    {
        _db = db;
        _stripe = stripe;
    }

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    [HttpGet("plans")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<BillingPlanDto>>> Plans(CancellationToken ct = default)
    {
        var plans = new List<BillingPlanDto>();
        var managedPlans = await _db.BillingPlans
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Label)
            .ToListAsync(ct);
        var managedKeys = new HashSet<string>(managedPlans.Select(p => p.Plan), StringComparer.OrdinalIgnoreCase);

        foreach (var plan in managedPlans.Where(p => p.IsActive))
            plans.Add(BuildManagedPlan(plan));
        foreach (var info in StripeBillingService.AvailableCatalogue.Where(p => !managedKeys.Contains(p.Plan)))
            plans.Add(await BuildPlanAsync(info, _stripe.PriceIdForPlan(info.Plan) ?? string.Empty, ct));
        return Ok(plans);
    }

    [HttpGet("subscription")]
    [Authorize]
    public async Task<ActionResult<BillingSubscriptionDto>> Subscription(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == me, ct);
        if (user is null) return NotFound();

        return Ok(new BillingSubscriptionDto(
            user.Plan,
            user.PlanTier,
            user.StripeSubscriptionStatus,
            user.StripeBillingInterval,
            user.StripeCurrentPeriodEnd,
            user.StripeCancelAtPeriodEnd
        ));
    }

    [HttpPost("checkout-session")]
    [Authorize]
    public async Task<ActionResult<BillingRedirectDto>> CheckoutSession([FromBody] CreateCheckoutSessionRequest req, CancellationToken ct = default)
    {
        if (!_stripe.HasSecretKey)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Stripe is not configured." });

        // Prefer the new `plan` key; fall back to the legacy `interval` field.
        var (plan, priceId) = await ResolvePlanAsync(req.Plan ?? req.Interval, ct);
        if (plan is null) return BadRequest(new { message = "Unknown plan. Use monthly, yearly, duo, family or student." });
        if (plan.UnavailableReason is not null)
            return BadRequest(new { message = plan.UnavailableReason });
        if (priceId is null) return BadRequest(new { message = $"Stripe price id for the {plan.Plan} plan is not configured." });

        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == me, ct);
        if (user is null) return NotFound();

        try
        {
            if (string.IsNullOrWhiteSpace(user.StripeCustomerId))
            {
                user.StripeCustomerId = await _stripe.CreateCustomerAsync(user, ct);
                await _db.SaveChangesAsync(ct);
            }

            var url = await _stripe.CreateCheckoutSessionAsync(user, priceId, plan, ct);
            return Ok(new BillingRedirectDto(url));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("subscription")]
    [Authorize]
    public async Task<IActionResult> CancelSubscription(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == me, ct);
        if (user is null) return NotFound();

        // If Stripe is configured and the user has an active subscription, cancel it there first.
        if (_stripe.HasSecretKey && !string.IsNullOrWhiteSpace(user.StripeSubscriptionId))
        {
            try { await _stripe.CancelSubscriptionAsync(user.StripeSubscriptionId, ct); }
            catch { /* best-effort; still downgrade locally */ }
        }

        // Release any shared seats (Duo/Family) so members don't keep Premium
        // after the plan they ride on is gone; also resets the owner's tier.
        await PlanSeats.ReleaseAllForOwnerAsync(_db, user.Id, ct);

        // Downgrade the user to free immediately regardless of Stripe response.
        user.Plan = "free";
        user.PlanOwnerId = null;
        user.StripeSubscriptionStatus = "canceled";
        user.StripeCancelAtPeriodEnd = false;
        user.StripeSubscriptionId = null;
        user.StripeCurrentPeriodEnd = null;
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("portal-session")]
    [Authorize]
    public async Task<ActionResult<BillingRedirectDto>> PortalSession(CancellationToken ct = default)
    {
        if (!_stripe.HasSecretKey)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Stripe is not configured." });

        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == me, ct);
        if (user is null) return NotFound();
        if (string.IsNullOrWhiteSpace(user.StripeCustomerId))
            return BadRequest(new { message = "No Stripe customer exists for this account yet." });

        try
        {
            var url = await _stripe.CreatePortalSessionAsync(user.StripeCustomerId, ct);
            return Ok(new BillingRedirectDto(url));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private async Task<BillingPlanDto> BuildPlanAsync(
        StripeBillingService.PlanInfo info,
        string priceId,
        CancellationToken ct)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(priceId)) missing.Add($"{info.Plan} Price ID");
        if (!_stripe.HasSecretKey) missing.Add("Stripe secret key");

        // Prefer the hard-coded MYR price so the card always shows an amount (even
        // when Stripe isn't configured). Fall back to the live Stripe amount only
        // if a plan has no hard-coded price.
        string? displayPrice = info.DisplayPrice;
        if (displayPrice is null && missing.Count == 0)
        {
            try
            {
                var price = await _stripe.FetchPriceAsync(priceId, ct);
                var amount = GetLong(price, "unit_amount");
                var currency = GetString(price, "currency");
                if (amount is not null && currency is not null)
                    displayPrice = FormatPrice(amount.Value, currency, info.Interval);
            }
            catch
            {
                displayPrice = null;
            }
        }

        return new BillingPlanDto(
            info.Plan,
            info.Tier,
            info.MaxMembers,
            info.Interval,
            info.Label,
            DefaultCardTitle(info.Plan, info.Label),
            priceId,
            missing.Count == 0,
            info.DiscountLabel,
            DefaultPerks(info.Plan, info.MaxMembers),
            DefaultFinePrint(info.Plan),
            DefaultAccentColor(info.Plan),
            DefaultAccentColor(info.Plan),
            "#000000",
            displayPrice,
            missing.Count == 0 ? null : $"Configure {string.Join(" and ", missing)}."
        );
    }

    private BillingPlanDto BuildManagedPlan(BillingPlan plan)
        => new(
            plan.Plan,
            plan.Tier,
            plan.MaxMembers,
            plan.Interval,
            plan.Label,
            string.IsNullOrWhiteSpace(plan.CardTitle) ? DefaultCardTitle(plan.Plan, plan.Label) : plan.CardTitle,
            plan.StripePriceId,
            _stripe.HasSecretKey && !string.IsNullOrWhiteSpace(plan.StripePriceId),
            plan.DiscountLabel,
            SplitPerks(plan.Perks, plan.Plan, plan.MaxMembers),
            string.IsNullOrWhiteSpace(plan.FinePrint) ? DefaultFinePrint(plan.Plan) : plan.FinePrint,
            NormalizeColor(plan.AccentColor, DefaultAccentColor(plan.Plan)),
            NormalizeColor(plan.ButtonColor, DefaultAccentColor(plan.Plan)),
            NormalizeColor(plan.ButtonTextColor, "#000000"),
            FormatPrice(plan.UnitAmount, plan.Currency, plan.Interval),
            !_stripe.HasSecretKey
                ? "Configure Stripe secret key."
                : string.IsNullOrWhiteSpace(plan.StripePriceId)
                    ? "Stripe price id is missing."
                    : null
        );

    private static string DefaultCardTitle(string plan, string label)
        => plan switch
        {
            "monthly" => "Individual",
            "yearly" => "Individual Yearly",
            "duo" => "Duo",
            "family" => "Family",
            "student" => "Student",
            _ => label.Replace("Premium ", string.Empty, StringComparison.OrdinalIgnoreCase),
        };

    private static string[] DefaultPerks(string plan, int maxMembers)
        => plan switch
        {
            "monthly" => new[] { "1 Premium account", "Ad-free music listening", "Cancel anytime" },
            "yearly" => new[] { "1 Premium account", "Annual billing savings", "Cancel anytime" },
            "duo" => new[] { "2 Premium accounts", "Ad-free music listening for two people", "Cancel anytime" },
            "family" => new[] { "Up to 6 Premium accounts", "Parental controls for the plan manager", "Ad-free music listening for the family", "Cancel anytime" },
            "student" => new[] { "1 verified Premium account", "Discount for eligible students", "Cancel anytime" },
            _ => new[] { $"{maxMembers} Premium {(maxMembers == 1 ? "account" : "accounts")}", "Ad-free music listening", "Cancel anytime" },
        };

    private static string DefaultFinePrint(string plan)
        => plan switch
        {
            "yearly" => "Annual billing terms apply.",
            "duo" => "For two people who reside at the same address. Terms apply.",
            "family" => "For up to 6 family members residing at the same address. Terms apply.",
            "student" => "Offer available only to students at an accredited higher education institution. Terms apply.",
            _ => "Terms apply.",
        };

    private static string DefaultAccentColor(string plan)
        => plan switch
        {
            "yearly" => "#c4f0c5",
            "duo" => "#ffc862",
            "family" => "#a5bbd1",
            "student" => "#c4b1d4",
            _ => "#ffd2d7",
        };

    private static string[] SplitPerks(string perks, string plan, int maxMembers)
    {
        var lines = perks
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToArray();
        return lines.Length == 0 ? DefaultPerks(plan, maxMembers) : lines;
    }

    private static string NormalizeColor(string? color, string fallback)
        => RegexColor().IsMatch(color ?? string.Empty) ? color! : fallback;

    [System.Text.RegularExpressions.GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial System.Text.RegularExpressions.Regex RegexColor();

    private async Task<(StripeBillingService.PlanInfo? Plan, string? PriceId)> ResolvePlanAsync(string? planKey, CancellationToken ct)
    {
        var normalized = NormalizePlanKey(planKey);
        if (normalized is null) return (null, null);

        var managed = await _db.BillingPlans
            .Where(p => p.Plan == normalized)
            .FirstOrDefaultAsync(ct);
        if (managed is not null)
        {
            if (!managed.IsActive) return (null, null);

            var info = new StripeBillingService.PlanInfo(
                managed.Plan,
                managed.Tier,
                managed.MaxMembers,
                managed.Interval,
                managed.Label,
                managed.DiscountLabel,
                FormatPrice(managed.UnitAmount, managed.Currency, managed.Interval));
            return (info, string.IsNullOrWhiteSpace(managed.StripePriceId) ? null : managed.StripePriceId);
        }

        var fallback = StripeBillingService.PlanFor(normalized);
        return (fallback, fallback is null ? null : _stripe.PriceIdForPlan(fallback.Plan));
    }

    private static string? NormalizePlanKey(string? plan)
    {
        var key = plan?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(key)) return null;
        return key switch
        {
            "month" => "monthly",
            "annual" or "annually" or "year" => "yearly",
            _ => key,
        };
    }

    private static string FormatPrice(long unitAmount, string currency, string interval)
    {
        var amount = unitAmount / 100m;
        var suffix = interval == "yearly" ? "year" : "month";
        return string.Create(CultureInfo.InvariantCulture, $"{currency.ToUpperInvariant()} {amount:0.##}/{suffix}");
    }

    private static string? GetString(JsonElement obj, string property)
        => obj.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static long? GetLong(JsonElement obj, string property)
        => obj.TryGetProperty(property, out var value) && value.TryGetInt64(out var result)
            ? result
            : null;
}
