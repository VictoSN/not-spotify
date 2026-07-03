using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/billing/plans")]
[Authorize(Roles = "Admin")]
public class AdminBillingPlansController : ControllerBase
{
    private static readonly Regex PlanKeyPattern = new("^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$", RegexOptions.Compiled);
    private static readonly HashSet<string> AllowedTiers = new(StringComparer.OrdinalIgnoreCase)
    {
        "individual", "duo", "family", "student",
    };
    private static readonly HashSet<string> AllowedIntervals = new(StringComparer.OrdinalIgnoreCase)
    {
        "monthly", "yearly",
    };

    private readonly AppDbContext _db;
    private readonly StripeBillingService _stripe;

    public AdminBillingPlansController(AppDbContext db, StripeBillingService stripe)
    {
        _db = db;
        _stripe = stripe;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminBillingPlanDto>>> List(CancellationToken ct = default)
    {
        var managedPlans = await _db.BillingPlans
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Label)
            .ToListAsync(ct);
        var managedKeys = new HashSet<string>(managedPlans.Select(p => p.Plan), StringComparer.OrdinalIgnoreCase);
        var plans = managedPlans.Select(ToDto).ToList();

        foreach (var info in StripeBillingService.AvailableCatalogue.Where(p => !managedKeys.Contains(p.Plan)))
            plans.Add(ToDefaultDto(info, _stripe.PriceIdForPlan(info.Plan) ?? string.Empty));

        return Ok(plans
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Label));
    }

    [HttpPost]
    public async Task<ActionResult<AdminBillingPlanDto>> Create([FromBody] UpsertAdminBillingPlanRequest req, CancellationToken ct = default)
    {
        if (!_stripe.HasSecretKey)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Stripe secret key is not configured." });

        var validation = Validate(req, out var normalized);
        if (validation is not null) return BadRequest(new { message = validation });

        if (await _db.BillingPlans.AnyAsync(p => p.Plan == normalized.Plan, ct))
            return BadRequest(new { message = "A plan with that key already exists." });

        try
        {
            var productId = await _stripe.CreateProductAsync(normalized.Label, normalized.DiscountLabel, normalized.Plan, ct);
            var priceId = await _stripe.CreateRecurringPriceAsync(
                productId,
                normalized.UnitAmount,
                normalized.Currency,
                normalized.Interval,
                normalized.Label,
                normalized.Plan,
                normalized.Tier,
                ct);

            var plan = new BillingPlan
            {
                Plan = normalized.Plan,
                Tier = normalized.Tier,
                MaxMembers = normalized.MaxMembers,
                Interval = normalized.Interval,
                Label = normalized.Label,
                CardTitle = normalized.CardTitle,
                DiscountLabel = normalized.DiscountLabel,
                Perks = string.Join('\n', normalized.Perks),
                FinePrint = normalized.FinePrint,
                AccentColor = normalized.AccentColor,
                ButtonColor = normalized.ButtonColor,
                ButtonTextColor = normalized.ButtonTextColor,
                Currency = normalized.Currency,
                UnitAmount = normalized.UnitAmount,
                StripeProductId = productId,
                StripePriceId = priceId,
                IsActive = normalized.IsActive,
                SortOrder = Math.Max(0, normalized.SortOrder),
            };

            _db.BillingPlans.Add(plan);
            await _db.SaveChangesAsync(ct);
            if (!plan.IsActive)
            {
                await _stripe.ArchivePriceAsync(plan.StripePriceId, ct);
                await _stripe.ArchiveProductAsync(plan.StripeProductId, ct);
            }
            return Ok(ToDto(plan));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("order")]
    public async Task<ActionResult<IEnumerable<AdminBillingPlanDto>>> Reorder([FromBody] ReorderAdminBillingPlansRequest req, CancellationToken ct = default)
    {
        if (req.PlanIds is null || req.PlanIds.Length == 0)
            return BadRequest(new { message = "Plan order is required." });

        var ids = req.PlanIds.Distinct().ToArray();
        var managedPlans = await _db.BillingPlans.ToListAsync(ct);
        var byId = managedPlans.ToDictionary(p => p.Id);
        var changed = false;

        for (var index = 0; index < ids.Length; index++)
        {
            var id = ids[index];
            if (!byId.TryGetValue(id, out var plan))
            {
                var builtInPlan = BuiltInPlanFromId(id);
                if (builtInPlan is null) continue;

                plan = CreateDefaultOverride(builtInPlan);
                _db.BillingPlans.Add(plan);
                changed = true;
            }

            var sortOrder = (index + 1) * 10;
            if (plan.SortOrder != sortOrder)
            {
                plan.SortOrder = sortOrder;
                plan.UpdatedAt = DateTime.UtcNow;
                changed = true;
            }
        }

        if (changed) await _db.SaveChangesAsync(ct);
        return await List(ct);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AdminBillingPlanDto>> Update(Guid id, [FromBody] UpsertAdminBillingPlanRequest req, CancellationToken ct = default)
    {
        if (!_stripe.HasSecretKey)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Stripe secret key is not configured." });

        var plan = await _db.BillingPlans.FirstOrDefaultAsync(p => p.Id == id, ct);
        var builtInPlan = plan is null ? BuiltInPlanFromId(id) : null;
        if (plan is null && builtInPlan is null) return NotFound();

        var validation = Validate(req, out var normalized);
        if (validation is not null) return BadRequest(new { message = validation });
        if (builtInPlan is not null && !string.Equals(builtInPlan, normalized.Plan, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Default plan keys cannot be changed. Create a new plan instead." });

        if (await _db.BillingPlans.AnyAsync(p => (plan == null || p.Id != id) && p.Plan == normalized.Plan, ct))
            return BadRequest(new { message = "A plan with that key already exists." });

        try
        {
            if (plan is null)
            {
                var created = await CreateManagedPlanAsync(normalized, ct);
                return Ok(ToDto(created));
            }

            var wasStripeManaged = plan.IsStripeManaged;
            var productCreated = false;
            if (string.IsNullOrWhiteSpace(plan.StripeProductId) || !plan.IsStripeManaged)
            {
                plan.StripeProductId = await _stripe.CreateProductAsync(normalized.Label, normalized.DiscountLabel, normalized.Plan, ct);
                productCreated = true;
            }
            else
            {
                await _stripe.UpdateProductAsync(plan.StripeProductId, normalized.Label, normalized.DiscountLabel, normalized.IsActive, ct);
            }

            var priceChanged = plan.UnitAmount != normalized.UnitAmount
                || !string.Equals(plan.Currency, normalized.Currency, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(plan.Interval, normalized.Interval, StringComparison.OrdinalIgnoreCase);
            var needsActivePrice = !plan.IsActive && normalized.IsActive;
            var missingPrice = string.IsNullOrWhiteSpace(plan.StripePriceId);
            if (productCreated || priceChanged || needsActivePrice || missingPrice)
            {
                if (!missingPrice && wasStripeManaged) await _stripe.ArchivePriceAsync(plan.StripePriceId, ct);
                plan.StripePriceId = await _stripe.CreateRecurringPriceAsync(
                    plan.StripeProductId,
                    normalized.UnitAmount,
                    normalized.Currency,
                    normalized.Interval,
                    normalized.Label,
                    normalized.Plan,
                    normalized.Tier,
                    ct);
            }
            else if (!normalized.IsActive)
            {
                await _stripe.ArchivePriceAsync(plan.StripePriceId, ct);
            }

            plan.Plan = normalized.Plan;
            plan.Tier = normalized.Tier;
            plan.MaxMembers = normalized.MaxMembers;
            plan.Interval = normalized.Interval;
            plan.Label = normalized.Label;
            plan.CardTitle = normalized.CardTitle;
            plan.DiscountLabel = normalized.DiscountLabel;
            plan.Perks = string.Join('\n', normalized.Perks);
            plan.FinePrint = normalized.FinePrint;
            plan.AccentColor = normalized.AccentColor;
            plan.ButtonColor = normalized.ButtonColor;
            plan.ButtonTextColor = normalized.ButtonTextColor;
            plan.Currency = normalized.Currency;
            plan.UnitAmount = normalized.UnitAmount;
            plan.IsStripeManaged = true;
            plan.IsActive = normalized.IsActive;
            plan.SortOrder = Math.Max(0, normalized.SortOrder);
            plan.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);
            if (!plan.IsActive)
            {
                await _stripe.ArchivePriceAsync(plan.StripePriceId, ct);
                await _stripe.ArchiveProductAsync(plan.StripeProductId, ct);
            }
            return Ok(ToDto(plan));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var plan = await _db.BillingPlans.FirstOrDefaultAsync(p => p.Id == id, ct);
        var builtInPlan = plan is null ? BuiltInPlanFromId(id) : null;
        if (plan is null && builtInPlan is null) return NotFound();

        try
        {
            if (plan is not null)
            {
                if (_stripe.HasSecretKey && plan.IsStripeManaged)
                {
                    await _stripe.ArchivePriceAsync(plan.StripePriceId, ct);
                    await _stripe.ArchiveProductAsync(plan.StripeProductId, ct);
                }

                if (IsBuiltInPlan(plan.Plan))
                {
                    plan.IsActive = false;
                    plan.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _db.BillingPlans.Remove(plan);
                }
            }
            else
            {
                var info = StripeBillingService.AvailableCatalogue.First(p => string.Equals(p.Plan, builtInPlan, StringComparison.OrdinalIgnoreCase));
                var overridePlan = CreateDefaultOverride(info.Plan);
                overridePlan.IsActive = false;
                _db.BillingPlans.Add(overridePlan);
            }
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<BillingPlan> CreateManagedPlanAsync(NormalizedPlan normalized, CancellationToken ct)
    {
        var productId = await _stripe.CreateProductAsync(normalized.Label, normalized.DiscountLabel, normalized.Plan, ct);
        var priceId = await _stripe.CreateRecurringPriceAsync(
            productId,
            normalized.UnitAmount,
            normalized.Currency,
            normalized.Interval,
            normalized.Label,
            normalized.Plan,
            normalized.Tier,
            ct);

        var plan = new BillingPlan
        {
            Plan = normalized.Plan,
            Tier = normalized.Tier,
            MaxMembers = normalized.MaxMembers,
            Interval = normalized.Interval,
            Label = normalized.Label,
            CardTitle = normalized.CardTitle,
            DiscountLabel = normalized.DiscountLabel,
            Perks = string.Join('\n', normalized.Perks),
            FinePrint = normalized.FinePrint,
            AccentColor = normalized.AccentColor,
            ButtonColor = normalized.ButtonColor,
            ButtonTextColor = normalized.ButtonTextColor,
            Currency = normalized.Currency,
            UnitAmount = normalized.UnitAmount,
            StripeProductId = productId,
            StripePriceId = priceId,
            IsActive = normalized.IsActive,
            SortOrder = Math.Max(0, normalized.SortOrder),
        };

        _db.BillingPlans.Add(plan);
        await _db.SaveChangesAsync(ct);
        if (!plan.IsActive)
        {
            await _stripe.ArchivePriceAsync(plan.StripePriceId, ct);
            await _stripe.ArchiveProductAsync(plan.StripeProductId, ct);
        }

        return plan;
    }

    private BillingPlan CreateDefaultOverride(string planKey)
    {
        var info = StripeBillingService.AvailableCatalogue.First(p => string.Equals(p.Plan, planKey, StringComparison.OrdinalIgnoreCase));
        var (currency, unitAmount) = ParseDisplayPrice(info.DisplayPrice);
        return new BillingPlan
        {
            Plan = info.Plan,
            Tier = info.Tier,
            MaxMembers = info.MaxMembers,
            Interval = info.Interval,
            Label = info.Label,
            CardTitle = DefaultCardTitle(info.Plan, info.Label),
            DiscountLabel = info.DiscountLabel,
            Perks = string.Join('\n', DefaultPerks(info.Plan, info.MaxMembers)),
            FinePrint = DefaultFinePrint(info.Plan),
            AccentColor = DefaultAccentColor(info.Plan),
            ButtonColor = DefaultAccentColor(info.Plan),
            ButtonTextColor = "#000000",
            Currency = currency,
            UnitAmount = unitAmount,
            StripePriceId = _stripe.PriceIdForPlan(info.Plan) ?? string.Empty,
            IsStripeManaged = false,
            IsActive = true,
            SortOrder = BuiltInSortOrder(info.Plan),
        };
    }

    private static string? Validate(UpsertAdminBillingPlanRequest req, out NormalizedPlan normalized)
    {
        var plan = (req.Plan ?? string.Empty).Trim().ToLowerInvariant();
        var tier = (req.Tier ?? string.Empty).Trim().ToLowerInvariant();
        var interval = (req.Interval ?? string.Empty).Trim().ToLowerInvariant();
        var label = (req.Label ?? string.Empty).Trim();
        var cardTitle = string.IsNullOrWhiteSpace(req.CardTitle) ? DefaultCardTitle(plan, label) : req.CardTitle.Trim();
        var discount = string.IsNullOrWhiteSpace(req.DiscountLabel) ? null : req.DiscountLabel.Trim();
        var perks = (req.Perks ?? Array.Empty<string>())
            .Select(perk => perk.Trim())
            .Where(perk => !string.IsNullOrWhiteSpace(perk))
            .Take(8)
            .ToArray();
        if (perks.Length == 0) perks = DefaultPerks(plan, Math.Max(1, req.MaxMembers));
        var finePrint = string.IsNullOrWhiteSpace(req.FinePrint) ? DefaultFinePrint(plan) : req.FinePrint.Trim();
        var accentColor = NormalizeColor(req.AccentColor, DefaultAccentColor(plan));
        var buttonColor = NormalizeColor(req.ButtonColor, accentColor);
        var buttonTextColor = NormalizeColor(req.ButtonTextColor, "#000000");
        var currency = (req.Currency ?? string.Empty).Trim().ToLowerInvariant();

        normalized = new NormalizedPlan(plan, tier, Math.Max(1, req.MaxMembers), interval, label, cardTitle, discount, perks, finePrint, accentColor, buttonColor, buttonTextColor, currency, req.UnitAmount, req.IsActive, Math.Max(0, req.SortOrder));

        if (!PlanKeyPattern.IsMatch(plan)) return "Plan key must be 3-80 lowercase letters, numbers, or hyphens.";
        if (!AllowedTiers.Contains(tier)) return "Tier must be individual, duo, family, or student.";
        if (!AllowedIntervals.Contains(interval)) return "Interval must be monthly or yearly.";
        if (string.IsNullOrWhiteSpace(label)) return "Label is required.";
        if (!Regex.IsMatch(currency, "^[a-z]{3}$")) return "Currency must be a three-letter ISO code.";
        if (req.UnitAmount < 50) return "Amount must be at least 50 minor units.";
        if (cardTitle.Length > 80) return "Card title must be 80 characters or fewer.";
        if (finePrint.Length > 500) return "Fine print must be 500 characters or fewer.";
        return null;
    }

    private static AdminBillingPlanDto ToDto(BillingPlan plan)
        => new(
            plan.Id,
            true,
            plan.IsStripeManaged ? "Admin" : "Default order",
            plan.Plan,
            plan.Tier,
            plan.MaxMembers,
            plan.Interval,
            plan.Label,
            string.IsNullOrWhiteSpace(plan.CardTitle) ? DefaultCardTitle(plan.Plan, plan.Label) : plan.CardTitle,
            plan.DiscountLabel,
            SplitPerks(plan.Perks, plan.Plan, plan.MaxMembers),
            string.IsNullOrWhiteSpace(plan.FinePrint) ? DefaultFinePrint(plan.Plan) : plan.FinePrint,
            NormalizeColor(plan.AccentColor, DefaultAccentColor(plan.Plan)),
            NormalizeColor(plan.ButtonColor, DefaultAccentColor(plan.Plan)),
            NormalizeColor(plan.ButtonTextColor, "#000000"),
            plan.Currency,
            plan.UnitAmount,
            FormatPrice(plan.UnitAmount, plan.Currency, plan.Interval),
            plan.StripeProductId,
            plan.StripePriceId,
            plan.IsActive,
            plan.SortOrder,
            plan.CreatedAt,
            plan.UpdatedAt);

    private static AdminBillingPlanDto ToDefaultDto(StripeBillingService.PlanInfo plan, string priceId)
    {
        var (currency, unitAmount) = ParseDisplayPrice(plan.DisplayPrice);
        return new AdminBillingPlanDto(
            BuiltInId(plan.Plan),
            false,
            "Default",
            plan.Plan,
            plan.Tier,
            plan.MaxMembers,
            plan.Interval,
            plan.Label,
            DefaultCardTitle(plan.Plan, plan.Label),
            plan.DiscountLabel,
            DefaultPerks(plan.Plan, plan.MaxMembers),
            DefaultFinePrint(plan.Plan),
            DefaultAccentColor(plan.Plan),
            DefaultAccentColor(plan.Plan),
            "#000000",
            currency,
            unitAmount,
            plan.DisplayPrice ?? FormatPrice(unitAmount, currency, plan.Interval),
            string.Empty,
            priceId,
            true,
            BuiltInSortOrder(plan.Plan),
            DateTime.MinValue,
            DateTime.MinValue);
    }

    private static Guid BuiltInId(string plan) => plan switch
    {
        "monthly" => Guid.Parse("00000000-0000-0000-0000-000000000101"),
        "yearly" => Guid.Parse("00000000-0000-0000-0000-000000000102"),
        "duo" => Guid.Parse("00000000-0000-0000-0000-000000000103"),
        "family" => Guid.Parse("00000000-0000-0000-0000-000000000104"),
        "student" => Guid.Parse("00000000-0000-0000-0000-000000000105"),
        _ => Guid.Parse("00000000-0000-0000-0000-000000000199"),
    };

    private static string? BuiltInPlanFromId(Guid id)
        => StripeBillingService.AvailableCatalogue.FirstOrDefault(plan => BuiltInId(plan.Plan) == id)?.Plan;

    private static bool IsBuiltInPlan(string plan)
        => StripeBillingService.AvailableCatalogue.Any(info => string.Equals(info.Plan, plan, StringComparison.OrdinalIgnoreCase));

    private static int BuiltInSortOrder(string plan) => plan switch
    {
        "monthly" => 10,
        "yearly" => 20,
        "duo" => 30,
        "family" => 40,
        "student" => 50,
        _ => 100,
    };

    private static (string Currency, long UnitAmount) ParseDisplayPrice(string? displayPrice)
    {
        if (string.IsNullOrWhiteSpace(displayPrice)) return ("myr", 0);
        var match = Regex.Match(displayPrice, @"^(?<currency>[A-Z]{3})\s+(?<amount>\d+(?:\.\d+)?)");
        if (!match.Success) return ("myr", 0);

        var currency = match.Groups["currency"].Value.ToLowerInvariant();
        var amount = decimal.TryParse(match.Groups["amount"].Value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0m;
        return (currency, (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero));
    }

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
        => Regex.IsMatch(color ?? string.Empty, "^#[0-9a-fA-F]{6}$") ? color! : fallback;

    private static string FormatPrice(long unitAmount, string currency, string interval)
    {
        var amount = unitAmount / 100m;
        var suffix = interval == "yearly" ? "year" : "month";
        return string.Create(CultureInfo.InvariantCulture, $"{currency.ToUpperInvariant()} {amount:0.##}/{suffix}");
    }

    private sealed record NormalizedPlan(
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
        bool IsActive,
        int SortOrder);
}
