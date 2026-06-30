using System.ComponentModel.DataAnnotations;

namespace NotSpotify.Api.Dtos;

public record SignupRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    [Required] string Name,
    string? Country
);

public record SignupStartResponse(
    string Message,
    string Email,
    DateTime ExpiresAt,
    string? DevelopmentCode
);

public record VerifySignupRequest(
    [Required, EmailAddress] string Email,
    [Required, RegularExpression("^[0-9]{6}$")] string Code
);

public record ResendSignupOtpRequest(
    [Required, EmailAddress] string Email
);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password
);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(8)] string NewPassword
);

public record ForgotPasswordRequest(
    [Required, EmailAddress] string Email
);

/// <summary>Returned by /auth/forgot-password. <see cref="Code"/> is the 6-digit OTP
/// (always returned so the flow works without a mailer). <see cref="ResetUrl"/> is
/// the old token-based link — only populated in Development for testability.</summary>
public record ForgotPasswordResponse(string Message, string Code, string? ResetUrl);

public record ResetPasswordRequest(
    [Required, EmailAddress] string Email,
    /// <summary>6-digit OTP from /auth/forgot-password.</summary>
    [Required] string Code,
    [Required, MinLength(8)] string NewPassword
);

public record AuthResponse(string AccessToken, UserDto User);

public record AccessTokenResponse(string AccessToken);

/// <summary>External login provider state. Available means visible/usable on the public auth pages.</summary>
public record ExternalAuthProviderDto(bool Enabled, bool Configured, bool Available);

public record ExternalProvidersResponse(
    ExternalAuthProviderDto Google,
    ExternalAuthProviderDto Facebook,
    ExternalAuthProviderDto Apple
);

public record UserCapabilitiesDto(
    bool UnlimitedPlayback,
    bool CustomPlaylistPictures
);

public record UserDto(
    Guid Id,
    string Name,
    string Email,
    string? AvatarUrl,
    string Plan,
    string Country,
    DateTime CreatedAt,
    IEnumerable<string> Roles,
    string? SubscriptionStatus,
    string? SubscriptionInterval,
    DateTime? SubscriptionCurrentPeriodEnd,
    bool SubscriptionCancelAtPeriodEnd,
    UserCapabilitiesDto Capabilities,
    Guid? ArtistId
);
