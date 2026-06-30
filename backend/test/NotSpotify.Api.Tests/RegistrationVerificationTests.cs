using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class RegistrationVerificationTests
{
    private sealed class RecordingEmailSender : IRegistrationEmailSender
    {
        public List<(string Email, string Code)> Sent { get; } = [];

        public Task SendVerificationCodeAsync(string email, string name, string code, CancellationToken ct = default)
        {
            Sent.Add((email, code));
            return Task.CompletedTask;
        }
    }

    private static (RegistrationVerificationService Service, RecordingEmailSender Email, ApplicationUser User) Create()
    {
        var email = new RecordingEmailSender();
        var service = new RegistrationVerificationService(
            new JwtOptions { SigningKey = "registration-test-key-that-is-at-least-32-chars" },
            email);
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = "new@example.com",
            UserName = "new@example.com",
            Name = "New User",
        };
        return (service, email, user);
    }

    [Fact]
    public async Task Issue_SendsSixDigitOtpToRegistrationEmail()
    {
        var (service, email, user) = Create();

        await service.IssueAsync(user, DateTime.UtcNow);

        var sent = Assert.Single(email.Sent);
        Assert.Equal(user.Email, sent.Email);
        Assert.Matches("^[0-9]{6}$", sent.Code);
        Assert.False(user.EmailConfirmed);
        Assert.NotNull(user.EmailConfirmationOtpHash);
    }

    [Fact]
    public async Task CorrectOtp_ConfirmsAccountAndConsumesCode()
    {
        var (service, email, user) = Create();
        var now = DateTime.UtcNow;
        await service.IssueAsync(user, now);

        var result = service.Verify(user, email.Sent.Single().Code, now.AddMinutes(1));

        Assert.Equal(RegistrationOtpVerificationResult.Valid, result);
        Assert.True(user.EmailConfirmed);
        Assert.Null(user.EmailConfirmationOtpHash);
    }

    [Fact]
    public async Task IncorrectOtp_DoesNotConfirmAccount()
    {
        var (service, email, user) = Create();
        var now = DateTime.UtcNow;
        await service.IssueAsync(user, now);

        var wrongCode = email.Sent.Single().Code == "000000" ? "111111" : "000000";
        var result = service.Verify(user, wrongCode, now.AddMinutes(1));

        Assert.Equal(RegistrationOtpVerificationResult.Invalid, result);
        Assert.False(user.EmailConfirmed);
        Assert.Equal(1, user.EmailConfirmationOtpAttempts);
    }

    [Fact]
    public async Task Otp_ExpiresAfterTenMinutes()
    {
        var (service, email, user) = Create();
        var now = DateTime.UtcNow;
        await service.IssueAsync(user, now);

        var result = service.Verify(user, email.Sent.Single().Code, now.Add(RegistrationVerificationService.Lifetime).AddSeconds(1));

        Assert.Equal(RegistrationOtpVerificationResult.Expired, result);
        Assert.False(user.EmailConfirmed);
    }

    [Fact]
    public async Task Resend_IsRateLimitedThenSendsANewOtp()
    {
        var (service, email, user) = Create();
        var now = DateTime.UtcNow;
        await service.IssueAsync(user, now);

        Assert.False(service.CanResend(user, now.AddSeconds(30)));
        Assert.True(service.CanResend(user, now.Add(RegistrationVerificationService.ResendCooldown)));

        await service.IssueAsync(user, now.Add(RegistrationVerificationService.ResendCooldown));
        Assert.Equal(2, email.Sent.Count);
        Assert.Equal(now.Add(RegistrationVerificationService.ResendCooldown).Add(RegistrationVerificationService.Lifetime),
            user.EmailConfirmationOtpExpiresAt);
    }
}
