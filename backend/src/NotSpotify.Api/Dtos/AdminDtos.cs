using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

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

public class ArtistImageUploadRequest
{
    [Required]
    public IFormFile File { get; set; } = null!;
}

