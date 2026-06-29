namespace NotSpotify.Api.Services;

public interface IPasswordResetEmailSender
{
    bool IsConfigured { get; }

    Task SendPasswordResetAsync(
        string email,
        string code,
        string resetUrl,
        DateTime expiresAt,
        CancellationToken cancellationToken = default);
}
