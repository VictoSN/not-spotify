using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("stripe")]
public class StripeWebhookController : ControllerBase
{
    private static readonly TimeSpan SignatureTolerance = TimeSpan.FromMinutes(5);

    private readonly AppDbContext _db;
    private readonly StripeBillingService _stripe;

    public StripeWebhookController(AppDbContext db, StripeBillingService stripe)
    {
        _db = db;
        _stripe = stripe;
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook(CancellationToken ct = default)
    {
        using var reader = new StreamReader(Request.Body);
        var json = await reader.ReadToEndAsync(ct);
        var signature = Request.Headers["Stripe-Signature"].ToString();

        if (!VerifySignature(json, signature))
            return BadRequest(new { message = "Invalid Stripe signature." });

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var eventId = GetString(root, "id");
        var eventType = GetString(root, "type");
        if (eventId is null || eventType is null)
            return BadRequest(new { message = "Malformed Stripe event." });

        if (await _db.StripeWebhookEvents.AnyAsync(e => e.Id == eventId, ct))
            return Ok();

        var stripeObject = root.GetProperty("data").GetProperty("object");
        await HandleEventAsync(eventType, stripeObject, ct);

        _db.StripeWebhookEvents.Add(new StripeWebhookEvent
        {
            Id = eventId,
            Type = eventType,
            ReceivedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        return Ok();
    }

    private async Task HandleEventAsync(string eventType, JsonElement obj, CancellationToken ct)
    {
        switch (eventType)
        {
            case "checkout.session.completed":
                await HandleCheckoutSessionCompletedAsync(obj, ct);
                break;

            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
            case "customer.subscription.paused":
            case "customer.subscription.resumed":
                await HandleSubscriptionAsync(obj, ct);
                break;

            case "invoice.paid":
            case "invoice.payment_failed":
                await HandleInvoiceAsync(obj, ct);
                break;
        }
    }

    private async Task HandleCheckoutSessionCompletedAsync(JsonElement session, CancellationToken ct)
    {
        var user = await FindUserFromSessionAsync(session, ct);
        if (user is null) return;

        var customerId = GetString(session, "customer");
        if (!string.IsNullOrWhiteSpace(customerId))
            user.StripeCustomerId = customerId;

        var subscriptionId = GetString(session, "subscription");
        if (!string.IsNullOrWhiteSpace(subscriptionId))
        {
            var subscription = await _stripe.FetchSubscriptionAsync(subscriptionId, ct);
            _stripe.ApplySubscriptionToUser(user, subscription);
        }
    }

    private async Task HandleSubscriptionAsync(JsonElement subscription, CancellationToken ct)
    {
        var user = await FindUserFromSubscriptionAsync(subscription, ct);
        if (user is null) return;

        _stripe.ApplySubscriptionToUser(user, subscription);

        // If this subscription lapsed, release any shared seats so members don't
        // keep Premium after the owner's plan ended.
        if (string.Equals(user.Plan, "free", StringComparison.OrdinalIgnoreCase))
        {
            await PlanSeats.ReleaseAllForOwnerAsync(_db, user.Id, ct);
            user.PlanOwnerId = null;
        }
    }

    private async Task HandleInvoiceAsync(JsonElement invoice, CancellationToken ct)
    {
        var subscriptionId = GetString(invoice, "subscription")
            ?? GetNestedString(invoice, "parent", "subscription_details", "subscription");

        if (string.IsNullOrWhiteSpace(subscriptionId)) return;

        var subscription = await _stripe.FetchSubscriptionAsync(subscriptionId, ct);
        await HandleSubscriptionAsync(subscription, ct);
    }

    private async Task<ApplicationUser?> FindUserFromSessionAsync(JsonElement session, CancellationToken ct)
    {
        var userId = MetadataValue(session, "userId") ?? GetString(session, "client_reference_id");
        if (Guid.TryParse(userId, out var guid))
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == guid, ct);
            if (user is not null) return user;
        }

        var customerId = GetString(session, "customer");
        return string.IsNullOrWhiteSpace(customerId)
            ? null
            : await _db.Users.FirstOrDefaultAsync(u => u.StripeCustomerId == customerId, ct);
    }

    private async Task<ApplicationUser?> FindUserFromSubscriptionAsync(JsonElement subscription, CancellationToken ct)
    {
        var userId = MetadataValue(subscription, "userId");
        if (Guid.TryParse(userId, out var guid))
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == guid, ct);
            if (user is not null) return user;
        }

        var subscriptionId = GetString(subscription, "id");
        if (!string.IsNullOrWhiteSpace(subscriptionId))
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.StripeSubscriptionId == subscriptionId, ct);
            if (user is not null) return user;
        }

        var customerId = GetString(subscription, "customer");
        return string.IsNullOrWhiteSpace(customerId)
            ? null
            : await _db.Users.FirstOrDefaultAsync(u => u.StripeCustomerId == customerId, ct);
    }

    private bool VerifySignature(string payload, string signatureHeader)
    {
        var secret = _stripe.Options.WebhookSecret;
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(signatureHeader))
            return false;

        string? timestamp = null;
        var signatures = new List<string>();
        foreach (var piece in signatureHeader.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var idx = piece.IndexOf('=');
            if (idx <= 0) continue;

            var key = piece[..idx];
            var value = piece[(idx + 1)..];
            if (key == "t") timestamp = value;
            if (key == "v1") signatures.Add(value);
        }

        if (!long.TryParse(timestamp, out var seconds) || signatures.Count == 0)
            return false;

        var signedAt = DateTimeOffset.FromUnixTimeSeconds(seconds);
        if (DateTimeOffset.UtcNow - signedAt > SignatureTolerance)
            return false;

        var signedPayload = $"{timestamp}.{payload}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var expected = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(signedPayload))).ToLowerInvariant();
        var expectedBytes = Encoding.UTF8.GetBytes(expected);

        return signatures.Any(sig =>
            sig.Length == expected.Length &&
            CryptographicOperations.FixedTimeEquals(expectedBytes, Encoding.UTF8.GetBytes(sig.ToLowerInvariant())));
    }

    private static string? MetadataValue(JsonElement obj, string key)
    {
        if (!obj.TryGetProperty("metadata", out var metadata) || metadata.ValueKind != JsonValueKind.Object)
            return null;

        return GetString(metadata, key);
    }

    private static string? GetNestedString(JsonElement obj, params string[] path)
    {
        var current = obj;
        foreach (var segment in path)
        {
            if (!current.TryGetProperty(segment, out current))
                return null;
        }

        return StringValue(current);
    }

    private static string? GetString(JsonElement obj, string property)
    {
        return obj.TryGetProperty(property, out var value) ? StringValue(value) : null;
    }

    private static string? StringValue(JsonElement value)
    {
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.Object when value.TryGetProperty("id", out var id) => StringValue(id),
            _ => null,
        };
    }
}
