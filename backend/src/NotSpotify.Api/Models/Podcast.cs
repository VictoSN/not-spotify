namespace NotSpotify.Api.Models;

/// <summary>
/// A podcast show. Episodes reuse the same audio storage + player as tracks;
/// the catalogue lives at /podcasts. Created by admins (or, later, the
/// artist-upload/review flow — same shape as <see cref="Track"/>).
/// </summary>
public class Podcast
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>Free-text category ("Music", "Talk", "Comedy", …) for browse grouping.</summary>
    public string? Category { get; set; }

    public string? ImageUrl { get; set; }
    public string? ImageKey { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Episode> Episodes { get; set; } = new List<Episode>();
}
