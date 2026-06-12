namespace NotSpotify.Api.Models;

public class SiteVisit
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public ApplicationUser? User { get; set; }
    public string Path { get; set; } = "/";
    public string Method { get; set; } = "GET";
    public string? UserAgent { get; set; }
    public DateTime VisitedAt { get; set; } = DateTime.UtcNow;
}
