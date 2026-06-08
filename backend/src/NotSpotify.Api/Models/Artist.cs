namespace NotSpotify.Api.Models;

public class Artist
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public string? ImageUrl { get; set; }
    public string? ImageKey { get; set; }
    public string? HeaderImageUrl { get; set; }
    public string? HeaderImageKey { get; set; }
    public long MonthlyListeners { get; set; }
    public long FollowerCount { get; set; }
    public bool Verified { get; set; }
    public string? Instagram { get; set; }
    public string? Twitter { get; set; }
    public string? Website { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsRevoked { get; set; }
    public string? RevocationNote { get; set; }
    public DateTime? RevokedAt { get; set; }

    public ICollection<Album> Albums { get; set; } = new List<Album>();
    public ICollection<Track> Tracks { get; set; } = new List<Track>();
}
