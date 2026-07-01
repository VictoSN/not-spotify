using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class PasswordResetServiceTests
{
    private sealed class RecordingEmailSender : IPasswordResetEmailSender
    {
        public List<(string Email, string Code, string? ResetUrl)> Sent { get; } = [];

        public Task SendResetCodeAsync(string email, string code, string? resetUrl, CancellationToken ct = default)
        {
            Sent.Add((email, code, resetUrl));
            return Task.CompletedTask;
        }
    }

    private static (PasswordResetService Service, RecordingEmailSender Email, Data.AppDbContext Db) Create()
    {
        var db = TestHelpers.NewDb();
        var email = new RecordingEmailSender();
        var service = new PasswordResetService(
            db,
            new JwtOptions { SigningKey = "password-reset-test-key-that-is-at-least-32-chars" },
            email);
        return (service, email, db);
    }

    [Fact]
    public async Task Issue_EmailsSixDigitCodeAndLinkButStoresOnlyAHash()
    {
        var (service, email, db) = Create();

        var issue = await service.IssueAsync("USER@Example.com", "https://app.test/reset-password", DateTime.UtcNow);

        Assert.NotNull(issue);
        var sent = Assert.Single(email.Sent);
        Assert.Equal("user@example.com", sent.Email); // normalized
        Assert.Matches("^[0-9]{6}$", sent.Code);
        Assert.Equal(sent.Code, issue!.Code);
        Assert.NotNull(sent.ResetUrl);
        Assert.Contains("code=" + sent.Code, sent.ResetUrl);
        Assert.Contains("email=user%40example.com", sent.ResetUrl);

        // The database must never hold the plaintext code.
        var row = await db.PasswordResetOtps.SingleAsync();
        Assert.NotEqual(sent.Code, row.CodeHash);
        Assert.Matches("^[0-9A-F]{64}$", row.CodeHash); // HMAC-SHA256 hex
        Assert.False(row.IsUsed);
    }

    [Fact]
    public async Task CorrectCode_IsAcceptedOnceThenConsumed()
    {
        var (service, email, _) = Create();
        var now = DateTime.UtcNow;
        await service.IssueAsync("user@example.com", null, now);
        var code = email.Sent.Single().Code;

        Assert.True(await service.TryConsumeAsync("user@example.com", code, now.AddMinutes(1)));
        // Single-use: a second attempt with the same code fails.
        Assert.False(await service.TryConsumeAsync("user@example.com", code, now.AddMinutes(1)));
    }

    [Fact]
    public async Task IncorrectCode_IsRejected()
    {
        var (service, email, _) = Create();
        var now = DateTime.UtcNow;
        await service.IssueAsync("user@example.com", null, now);
        var wrong = email.Sent.Single().Code == "000000" ? "111111" : "000000";

        Assert.False(await service.TryConsumeAsync("user@example.com", wrong, now.AddMinutes(1)));
    }

    [Fact]
    public async Task Code_ExpiresAfterTenMinutes()
    {
        var (service, email, _) = Create();
        var now = DateTime.UtcNow;
        await service.IssueAsync("user@example.com", null, now);
        var code = email.Sent.Single().Code;

        var afterExpiry = now.Add(PasswordResetService.Lifetime).AddSeconds(1);
        Assert.False(await service.TryConsumeAsync("user@example.com", code, afterExpiry));
    }

    [Fact]
    public async Task Issue_IsRateLimitedWithinTheCooldownThenAllowsANewCode()
    {
        var (service, email, _) = Create();
        var now = DateTime.UtcNow;
        await service.IssueAsync("user@example.com", null, now);

        // A second request inside the cooldown returns null and sends nothing extra.
        var throttled = await service.IssueAsync("user@example.com", null, now.AddSeconds(30));
        Assert.Null(throttled);
        Assert.Single(email.Sent);

        // After the cooldown a fresh code is issued and emailed.
        var again = await service.IssueAsync("user@example.com", null, now.Add(PasswordResetService.ResendCooldown));
        Assert.NotNull(again);
        Assert.Equal(2, email.Sent.Count);
    }
}
