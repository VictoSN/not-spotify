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

// ── Artist applications ───────────────────────────────────────────────────────

public record ArtistApplicationDto(
    Guid Id,
    Guid UserId,
    string UserName,
    string UserEmail,
    string DisplayName,
    string Bio,
    string? SampleWorkUrl,
    string Status,
    DateTime SubmittedAt,
    DateTime? ReviewedAt,
    string? ReviewNote
);

public record SubmitArtistApplicationRequest(
    [Required, StringLength(120, MinimumLength = 1)] string DisplayName,
    [StringLength(500)] string Bio = "",
    string? SampleWorkUrl = null
);

public record ReviewApplicationRequest(string? Note);

public record RevokeArtistRequest(string? Note);

public record ArtistUpdateProfileRequest(
    string? Name,
    string? Bio,
    string? Instagram,
    string? Twitter,
    string? Website,
    string? Country = null
);

public record ResubmitRequest(string? Note);

// ── Artist — album submission ─────────────────────────────────────────────────

public record ArtistSubmitAlbumRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Title,
    string Type = "album",   // album | single | ep
    DateOnly? ReleaseDate = null,
    string? Label = null,
    string? Copyright = null,
    string? Country = null
);

// ── Artist — album update (pending only) ─────────────────────────────────────

public record ArtistUpdateAlbumRequest(
    string? Title,
    string? Type,
    DateOnly? ReleaseDate,
    string? Label,
    string? Copyright,
    string? Country = null
);

// ── Artist — track update (track number / title / explicit) ──────────────────

public record ArtistUpdateTrackRequest(
    int? TrackNumber,
    string? Title,
    bool? Explicit,
    string? Lyrics,
    // When non-null, replaces the track's genres (must contain at least one valid id).
    IReadOnlyList<Guid>? GenreIds = null
);

// ── Artist — track submission ─────────────────────────────────────────────────

public record ArtistSubmitTrackRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Title,
    [Required] Guid AlbumId,
    [Required, Range(1, long.MaxValue)] long DurationMs,
    int TrackNumber = 1,
    int DiscNumber = 1,
    bool Explicit = false,
    string? Lyrics = null,
    // At least one valid genre id is required so the track is discoverable.
    IReadOnlyList<Guid>? GenreIds = null
);

