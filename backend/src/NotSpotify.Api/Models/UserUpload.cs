namespace NotSpotify.Api.Models;

/// <summary>
/// A track a user uploaded to their own private locker ("Personal uploads").
/// Demo-scale: audio goes through the same <c>IStorageService</c> as the
/// catalogue (key <c>uploads/{userId}/{guid}.ext</c>) and plays through the
/// unchanged audio engine. Visible only to its owner — never part of the
/// public catalogue, search, or recommendations.
/// </summary>
public class UserUpload
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string? Artist { get; set; }

    public string AudioUrl { get; set; } = string.Empty;
    public string? AudioKey { get; set; }

    public string? CoverKey { get; set; }

    public long DurationMs { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
