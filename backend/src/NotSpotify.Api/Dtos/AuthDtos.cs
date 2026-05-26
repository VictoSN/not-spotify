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

public record AuthResponse(string AccessToken, UserDto User);

public record AccessTokenResponse(string AccessToken);

public record UserDto(
    Guid Id,
    string Name,
    string Email,
    string? AvatarUrl,
    string Plan,
    string Country,
    DateTime CreatedAt,
    IEnumerable<string> Roles
);
