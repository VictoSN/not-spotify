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

public record CreateAlbumRequest(
    [Required, MinLength(1)] string Title,
    Guid ArtistId,
    string Type = "album",
    DateOnly? ReleaseDate = null,
    string? Label = null,
    string? Copyright = null
);

public record UpdateAlbumRequest(
    string? Title,
    Guid? ArtistId,
    string? Type,
    DateOnly? ReleaseDate,
    string? Label,
    string? Copyright
);

public class AlbumCoverUploadRequest
{
    [Required]
    public IFormFile File { get; set; } = null!;
}

public record CreateTrackRequest(
    [Required, MinLength(1)] string Title,
    Guid AlbumId,
    Guid ArtistId,
    long DurationMs,
    int TrackNumber = 1,
    int DiscNumber = 1,
    bool Explicit = false
);

public record UpdateTrackRequest(
    string? Title,
    Guid? AlbumId,
    Guid? ArtistId,
    long? DurationMs,
    int? TrackNumber,
    int? DiscNumber,
    bool? Explicit
);

public class TrackAudioUploadRequest
{
    [Required]
    public IFormFile File { get; set; } = null!;
}

