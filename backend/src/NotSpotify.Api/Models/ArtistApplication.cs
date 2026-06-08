namespace NotSpotify.Api.Models;

public class ArtistApplication
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public string DisplayName { get; set; } = string.Empty;
    public string Bio { get; set; } = string.Empty;
    public string? SampleWorkUrl { get; set; }

    // pending | approved | rejected
    public string Status { get; set; } = "pending";
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public ApplicationUser? ReviewedBy { get; set; }
    public string? ReviewNote { get; set; }
}
