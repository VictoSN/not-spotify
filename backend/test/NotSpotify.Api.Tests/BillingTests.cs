using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Billing & plans: the plan catalogue, the shared seat-release path used when a
/// subscription lapses (Stripe cancel/downgrade), and the webhook signature
/// guard. The full webhook happy-path needs live Stripe and is out of unit scope.
/// </summary>
public class BillingTests
{
    // ── Plan catalogue ────────────────────────────────────────────────────────

    [Theory]
    [InlineData("individual", 1)]
    [InlineData("duo", 2)]
    [InlineData("family", 6)]
    [InlineData("student", 1)]
    [InlineData(null, 1)]
    [InlineData("nonsense", 1)]
    public void MaxMembersForTier_MapsTierToSeatAllowance(string? tier, int expected)
        => Assert.Equal(expected, StripeBillingService.MaxMembersForTier(tier));

    [Fact]
    public void PlanFor_NormalizesAliases()
    {
        Assert.Equal("monthly", StripeBillingService.PlanFor("month")?.Plan);
        Assert.Equal("yearly", StripeBillingService.PlanFor("annual")?.Plan);
        Assert.Equal("family", StripeBillingService.PlanFor("family")?.Plan);
        Assert.Null(StripeBillingService.PlanFor("garbage"));
    }

    [Fact]
    public void Catalogue_UsesCorrectIndividualLabels_AndOnlyExposesReadyPlans()
    {
        Assert.Equal("Premium Individual", StripeBillingService.PlanFor("monthly")?.Label);
        Assert.Equal("Premium Individual Yearly", StripeBillingService.PlanFor("yearly")?.Label);
        Assert.Null(StripeBillingService.PlanFor("duo")?.UnavailableReason);
        Assert.Null(StripeBillingService.PlanFor("family")?.UnavailableReason);
        Assert.Equal("Student verification is not available yet.", StripeBillingService.PlanFor("student")?.UnavailableReason);
        Assert.DoesNotContain(StripeBillingService.AvailableCatalogue, p => p.Plan == "student");
        Assert.Contains(StripeBillingService.AvailableCatalogue, p => p.Plan == "duo");
        Assert.Contains(StripeBillingService.AvailableCatalogue, p => p.Plan == "family");
        Assert.DoesNotContain(StripeBillingService.Catalogue, p => p.Label == "Premium Monthly");
    }

    [Fact]
    public async Task Checkout_RejectsStudentPlanUntilVerificationExists()
    {
        await using var db = TestHelpers.NewDb();
        var userId = Guid.NewGuid();
        db.Users.Add(new ApplicationUser
        {
            Id = userId,
            Name = "student",
            Email = "student@test",
            UserName = "student@test",
        });
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Stripe:SecretKey"] = "sk_test",
                ["Stripe:StudentPriceId"] = "price_student",
            })
            .Build();
        var controller = new BillingController(db, new StripeBillingService(new HttpClient(), config)).AsUser(userId);

        var result = await controller.CheckoutSession(new NotSpotify.Api.Dtos.CreateCheckoutSessionRequest("student"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("verification", badRequest.Value?.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Null(db.Users.Single().StripeCustomerId);
    }

    // ── Seat release (cancel / downgrade) ───────────────────────────────────────

    [Fact]
    public async Task ReleaseAllForOwner_DropsMembersToFree_RemovesSeats_NormalizesOwnerTier()
    {
        await using var db = TestHelpers.NewDb();
        var ownerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        db.Users.Add(new ApplicationUser { Id = ownerId, Name = "owner", Plan = "premium", PlanTier = "family" });
        db.Users.Add(new ApplicationUser
        {
            Id = memberId, Name = "member", Plan = "premium", PlanTier = "family", PlanOwnerId = ownerId,
        });
        db.PlanMemberships.Add(new PlanMembership { OwnerId = ownerId, MemberId = memberId, InvitedEmail = "m@test", Status = "active" });
        db.PlanMemberships.Add(new PlanMembership { OwnerId = ownerId, InvitedEmail = "pending@test", Status = "invited" });
        await db.SaveChangesAsync();

        await PlanSeats.ReleaseAllForOwnerAsync(db, ownerId);
        await db.SaveChangesAsync();

        Assert.Empty(db.PlanMemberships);                              // all seats gone
        var member = db.Users.Single(u => u.Id == memberId);
        Assert.Equal("free", member.Plan);
        Assert.Null(member.PlanOwnerId);
        Assert.Equal("individual", member.PlanTier);
        Assert.Equal("individual", db.Users.Single(u => u.Id == ownerId).PlanTier); // owner normalized
    }

    // ── Webhook signature guard ─────────────────────────────────────────────────

    private static StripeWebhookController WebhookController(NotSpotify.Api.Data.AppDbContext db, string? webhookSecret, string body, string signature)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(webhookSecret is null
                ? new Dictionary<string, string?>()
                : new Dictionary<string, string?> { ["Stripe:WebhookSecret"] = webhookSecret })
            .Build();
        var stripe = new StripeBillingService(new HttpClient(), config);

        var http = new DefaultHttpContext();
        http.Request.Body = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(body));
        http.Request.Headers["Stripe-Signature"] = signature;

        return new StripeWebhookController(db, stripe) { ControllerContext = new ControllerContext { HttpContext = http } };
    }

    [Fact]
    public async Task Webhook_InvalidSignature_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var controller = WebhookController(db, webhookSecret: "whsec_test", body: "{}", signature: "t=123,v1=deadbeef");

        var result = await controller.Webhook();

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Webhook_NoSecretConfigured_RejectsRequest()
    {
        await using var db = TestHelpers.NewDb();
        var controller = WebhookController(db, webhookSecret: null, body: "{}", signature: "t=123,v1=abc");

        var result = await controller.Webhook();

        Assert.IsType<BadRequestObjectResult>(result);
    }
}
