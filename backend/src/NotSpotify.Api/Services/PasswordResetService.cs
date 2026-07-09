using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

public interface IPasswordResetEmailSender
{
    /// <summary>Emails a password-reset code (and, when known, a one-click reset link).</summary>
    Task SendResetCodeAsync(string email, string code, string? resetUrl, CancellationToken ct = default);
}

public sealed class ResendPasswordResetEmailSender(
    ResendEmailClient resend,
    IWebHostEnvironment environment,
    ILogger<ResendPasswordResetEmailSender> logger) : IPasswordResetEmailSender
{
    public async Task SendResetCodeAsync(string email, string code, string? resetUrl, CancellationToken ct = default)
    {
        if (!resend.IsConfigured)
        {
            if (environment.IsDevelopment())
            {
                logger.LogWarning(
                    "[Auth] Password reset OTP for {Email}: {Code} (link: {Url}). Configure Email:Resend to send mail.",
                    email, code, resetUrl ?? "n/a");
                return;
            }
            throw new InvalidOperationException("Password reset email (Email:Resend) is not configured.");
        }

        var text = new StringBuilder()
            .AppendLine("We received a request to reset your not-spotify password.")
            .AppendLine()
            .AppendLine($"Your password reset code is {code}.")
            .AppendLine()
            .AppendLine("This code expires in 10 minutes and can only be used once.");
        if (!string.IsNullOrWhiteSpace(resetUrl))
            text.AppendLine().AppendLine($"Or reset it directly: {resetUrl}");
        text.AppendLine().AppendLine("If you didn't request this, you can safely ignore this email.");

        var intro = "We received a request to reset your not-spotify password. Use the code below to continue.";
        var footerParts = new StringBuilder("This code expires in 10 minutes and can only be used once.");
        if (!string.IsNullOrWhiteSpace(resetUrl))
        {
            var safeUrl = System.Net.WebUtility.HtmlEncode(resetUrl);
            footerParts.Append($"<br><br>Or reset it directly: <a href=\"{safeUrl}\">{safeUrl}</a>");
        }
        footerParts.Append("<br><br>If you didn't request this, you can safely ignore this email.");
        var html = EmailTemplates.OtpCode("Reset your password", intro, code, footerParts.ToString());

        await resend.SendAsync(email, "Reset your not-spotify password", html, text.ToString(), ct);
    }
}

/// <summary>The outcome of issuing a reset code — carries the plaintext code so the
/// controller can surface it in Development only.</summary>
public sealed record PasswordResetIssue(string Code, DateTime ExpiresAt);

/// <summary>
/// Generates, emails, and validates the single-use password-reset OTP. The
/// plaintext code is emailed to the user and never persisted; only an HMAC hash
/// is stored, so the flow is safe against a database leak.
/// </summary>
public sealed class PasswordResetService(
    AppDbContext db,
    JwtOptions jwt,
    IPasswordResetEmailSender emailSender)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Issues a fresh reset code for <paramref name="email"/> and emails it. Returns
    /// <c>null</c> when a code was issued within the resend cooldown (the caller should
    /// still respond generically so the cooldown isn't observable to an attacker).
    /// </summary>
    /// <param name="resetUrlBase">Absolute "/reset-password" URL used to build a one-click
    /// link, or <c>null</c> to email only the code.</param>
    public async Task<PasswordResetIssue?> IssueAsync(
        string email,
        string? resetUrlBase,
        DateTime now,
        CancellationToken ct = default)
    {
        var normalized = Normalize(email);

        // Rate-limit: at most one code per email per cooldown window. Don't send another.
        var withinCooldown = await db.PasswordResetOtps
            .AnyAsync(o => o.Email == normalized && !o.IsUsed && o.SentAt > now - ResendCooldown, ct);
        if (withinCooldown)
            return null;

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var expiresAt = now.Add(Lifetime);
        db.PasswordResetOtps.Add(new PasswordResetOtp
        {
            Id = Guid.NewGuid(),
            Email = normalized,
            CodeHash = Hash(normalized, code),
            ExpiresAt = expiresAt,
            SentAt = now,
            IsUsed = false,
        });
        await db.SaveChangesAsync(ct);

        string? resetUrl = null;
        if (!string.IsNullOrWhiteSpace(resetUrlBase))
        {
            var separator = resetUrlBase.Contains('?') ? '&' : '?';
            resetUrl = $"{resetUrlBase}{separator}email={Uri.EscapeDataString(normalized)}&code={code}";
        }

        await emailSender.SendResetCodeAsync(normalized, code, resetUrl, ct);
        return new PasswordResetIssue(code, expiresAt);
    }

    /// <summary>
    /// Validates <paramref name="code"/> for <paramref name="email"/> and, on success,
    /// marks it consumed so it can't be replayed. Returns <c>false</c> for an unknown,
    /// expired, or already-used code.
    /// </summary>
    public async Task<bool> TryConsumeAsync(string email, string code, DateTime now, CancellationToken ct = default)
    {
        var normalized = Normalize(email);
        var hash = Hash(normalized, code);
        var otp = await db.PasswordResetOtps
            .Where(o => o.Email == normalized && o.CodeHash == hash && !o.IsUsed && o.ExpiresAt > now)
            .FirstOrDefaultAsync(ct);
        if (otp is null)
            return false;

        otp.IsUsed = true;
        await db.SaveChangesAsync(ct);
        return true;
    }

    private static string Normalize(string email) => email.Trim().ToLowerInvariant();

    private string Hash(string email, string code)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(jwt.SigningKey));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{email}:{code}")));
    }
}
