using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace NotSpotify.Api.Services;

public class SmtpPasswordResetEmailSender : IPasswordResetEmailSender
{
    private readonly PasswordResetEmailOptions _options;
    private readonly ILogger<SmtpPasswordResetEmailSender> _logger;

    public SmtpPasswordResetEmailSender(
        IOptions<PasswordResetEmailOptions> options,
        ILogger<SmtpPasswordResetEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.Host)
        && !string.IsNullOrWhiteSpace(_options.From);

    public async Task SendPasswordResetAsync(
        string email,
        string code,
        string resetUrl,
        DateTime expiresAt,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            _logger.LogWarning(
                "[Auth] Password reset email is not configured. Reset code for {Email}: {Code}. Link: {ResetUrl}",
                email,
                code,
                resetUrl);
            return;
        }

        using var message = new MailMessage
        {
            From = new MailAddress(_options.From!, _options.FromName),
            Subject = "Reset your NotSpotify password",
            Body = $"""
                   Use this code to reset your NotSpotify password:

                   {code}

                   Or open this link:
                   {resetUrl}

                   This code expires at {expiresAt:yyyy-MM-dd HH:mm} UTC.
                   If you did not request this, you can ignore this email.
                   """,
        };
        message.To.Add(email);

        using var smtp = new SmtpClient(_options.Host!, _options.Port)
        {
            EnableSsl = _options.EnableSsl,
        };

        if (!string.IsNullOrWhiteSpace(_options.Username))
        {
            smtp.Credentials = new NetworkCredential(_options.Username, _options.Password);
        }

        await smtp.SendMailAsync(message, cancellationToken);
    }
}
