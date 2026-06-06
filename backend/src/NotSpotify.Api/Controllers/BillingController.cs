using System.Security.Claims;
using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("billing")]
public class BillingController : ControllerBase
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
        return Ok(new[]
        {
            await BuildPlanAsync("monthly", "Premium Monthly", _stripe.Options.MonthlyPriceId, null, ct),
            await BuildPlanAsync("yearly", "Premium Yearly", _stripe.Options.YearlyPriceId, "15% cheaper, billed annually", ct),
        });
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

        var interval = NormalizeInterval(req.Interval);
        if (interval is null) return BadRequest(new { message = "Interval must be monthly or yearly." });

        var priceId = _stripe.PriceIdFor(interval);
        if (priceId is null) return BadRequest(new { message = $"Stripe {interval} price id is not configured." });

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

            var url = await _stripe.CreateCheckoutSessionAsync(user, priceId, interval, ct);
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

        // Downgrade the user to free immediately regardless of Stripe response.
        user.Plan = "free";
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

    private static string? NormalizeInterval(string interval) => interval.Trim().ToLowerInvariant() switch
    {
        "monthly" or "month" => "monthly",
        "yearly" or "annual" or "annually" or "year" => "yearly",
        _ => null,
    };

    private async Task<BillingPlanDto> BuildPlanAsync(
        string interval,
        string label,
        string priceId,
        string? discountLabel,
        CancellationToken ct)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(priceId)) missing.Add($"{interval} Price ID");
        if (!_stripe.HasSecretKey) missing.Add("Stripe secret key");

        string? displayPrice = null;
        if (missing.Count == 0)
        {
            try
            {
                var price = await _stripe.FetchPriceAsync(priceId, ct);
                var amount = GetLong(price, "unit_amount");
                var currency = GetString(price, "currency");
                if (amount is not null && currency is not null)
                    displayPrice = FormatPrice(amount.Value, currency, interval);
            }
            catch
            {
                displayPrice = null;
            }
        }

        return new BillingPlanDto(
            interval,
            label,
            priceId,
            missing.Count == 0,
            discountLabel,
            displayPrice,
            missing.Count == 0 ? null : $"Configure {string.Join(" and ", missing)}."
        );
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
