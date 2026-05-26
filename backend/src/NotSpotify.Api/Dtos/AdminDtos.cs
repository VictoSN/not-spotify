using System.ComponentModel.DataAnnotations;

namespace NotSpotify.Api.Dtos;

public record CreateArtistRequest(
    [Required, MinLength(1)] string Name,
    string? Bio,
    string? Instagram,
    string? Twitter,
    string? Website,
    bool Verified = false
);

public record UpdateArtistRequest(
    string? Name,
    string? Bio,
    string? Instagram,
    string? Twitter,
    string? Website,
    bool? Verified
);
