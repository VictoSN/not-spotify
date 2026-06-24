using System.ComponentModel.DataAnnotations;

namespace NotSpotify.Api.Dtos;

public record SignupRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    [Required] string Name,
    string? Country
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

/// <summary>Returned by /auth/forgot-password. <see cref="ResetUrl"/> is only populated
/// in Development (no mailer configured) so the flow stays testable without email.</summary>
public record ForgotPasswordResponse(string Message, string? ResetUrl);

public record ResetPasswordRequest(
    [Required, EmailAddress] string Email,
    [Required] string Token,
    [Required, MinLength(8)] string NewPassword
);

public record AuthResponse(string AccessToken, UserDto User);

public record AccessTokenResponse(string AccessToken);

/// <summary>Which external login providers are configured (button state on the client).</summary>
public record ExternalProvidersResponse(bool Google);

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
