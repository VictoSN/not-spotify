using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

public interface IRegistrationEmailSender
{
    Task SendVerificationCodeAsync(string email, string name, string code, CancellationToken ct = default);
}

public sealed class SmtpRegistrationEmailSender(
    IConfiguration config,
    IWebHostEnvironment environment,
    ILogger<SmtpRegistrationEmailSender> logger) : IRegistrationEmailSender
{
    public async Task SendVerificationCodeAsync(string email, string name, string code, CancellationToken ct = default)
    {
        var host = config["Email:Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            if (environment.IsDevelopment())
            {
                logger.LogWarning("[Auth] Registration OTP for {Email}: {Code}. Configure Email:Smtp to send mail.", email, code);
                return;
            }
            throw new InvalidOperationException("Registration email SMTP is not configured.");
        }

        var fromAddress = config["Email:Smtp:FromAddress"] ?? config["Email:Smtp:Username"];
        if (string.IsNullOrWhiteSpace(fromAddress))
            throw new InvalidOperationException("Email:Smtp:FromAddress is required when SMTP is enabled.");

        using var message = new MailMessage
        {
            From = new MailAddress(fromAddress, config["Email:Smtp:FromName"] ?? "not-spotify"),
            Subject = "Verify your not-spotify account",
            Body = $"Hi {name},\n\nYour not-spotify verification code is {code}.\n\nThis code expires in 10 minutes.",
            IsBodyHtml = false,
        };
        message.To.Add(email);

        using var smtp = new SmtpClient(host, config.GetValue("Email:Smtp:Port", 587))
        {
            EnableSsl = config.GetValue("Email:Smtp:EnableSsl", true),
        };
        var username = config["Email:Smtp:Username"];
        if (!string.IsNullOrWhiteSpace(username))
            smtp.Credentials = new NetworkCredential(username, config["Email:Smtp:Password"]);

        ct.ThrowIfCancellationRequested();
        await smtp.SendMailAsync(message);
    }
}

public enum RegistrationOtpVerificationResult
{
    Valid,
    Invalid,
    Expired,
}

public sealed record RegistrationOtpIssue(string Code, DateTime ExpiresAt);

public sealed class RegistrationVerificationService(
    JwtOptions jwt,
    IRegistrationEmailSender emailSender)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
    public const int MaxAttempts = 5;

    public bool CanResend(ApplicationUser user, DateTime now) =>
        user.EmailConfirmationOtpSentAt is null || user.EmailConfirmationOtpSentAt <= now - ResendCooldown;

    public async Task<RegistrationOtpIssue> IssueAsync(
        ApplicationUser user,
        DateTime now,
        CancellationToken ct = default)
    {
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var expiresAt = now.Add(Lifetime);
        user.EmailConfirmed = false;
        user.EmailConfirmationOtpHash = Hash(user.Id, code);
        user.EmailConfirmationOtpExpiresAt = expiresAt;
        user.EmailConfirmationOtpSentAt = now;
        user.EmailConfirmationOtpAttempts = 0;
        await emailSender.SendVerificationCodeAsync(user.Email!, user.Name, code, ct);
        return new RegistrationOtpIssue(code, expiresAt);
    }

    public RegistrationOtpVerificationResult Verify(ApplicationUser user, string code, DateTime now)
    {
        if (user.EmailConfirmationOtpHash is null || user.EmailConfirmationOtpExpiresAt <= now)
            return RegistrationOtpVerificationResult.Expired;

        if (user.EmailConfirmationOtpAttempts >= MaxAttempts)
            return RegistrationOtpVerificationResult.Invalid;

        var expected = Convert.FromHexString(user.EmailConfirmationOtpHash);
        var actual = Convert.FromHexString(Hash(user.Id, code));
        if (!CryptographicOperations.FixedTimeEquals(expected, actual))
        {
            user.EmailConfirmationOtpAttempts++;
            return RegistrationOtpVerificationResult.Invalid;
        }

        user.EmailConfirmed = true;
        user.EmailConfirmationOtpHash = null;
        user.EmailConfirmationOtpExpiresAt = null;
        user.EmailConfirmationOtpSentAt = null;
        user.EmailConfirmationOtpAttempts = 0;
        return RegistrationOtpVerificationResult.Valid;
    }

    private string Hash(Guid userId, string code)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(jwt.SigningKey));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{userId:N}:{code}")));
    }
}
