namespace NotSpotify.Api.Models;

public class Album
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Match-only search blob (normalized title + artist name + romanization aliases).
    /// Built by <see cref="Services.SearchTextBuilder"/>; never displayed. Null until backfilled.
    /// </summary>
    public string? SearchText { get; set; }

    public string Type { get; set; } = "album";
    public string CoverUrl { get; set; } = string.Empty;
    public string? CoverKey { get; set; }
    public DateOnly ReleaseDate { get; set; }
    public int TotalTracks { get; set; }
    public long DurationMs { get; set; }
    public string? Label { get; set; }
    public string? Copyright { get; set; }
    public int Popularity { get; set; }
    /// <summary>ISO-3166 alpha-2 market code (e.g. "US"). Null = inherit/unspecified.</summary>
    public string? Country { get; set; }

    public string Status { get; set; } = "approved"; // approved | pending | rejected
    public string? ReviewNote { get; set; }
    public Guid? SubmittedByUserId { get; set; }
    public ApplicationUser? SubmittedBy { get; set; }

    public Guid ArtistId { get; set; }
    public Artist Artist { get; set; } = null!;

    public ICollection<Track> Tracks { get; set; } = new List<Track>();
}
