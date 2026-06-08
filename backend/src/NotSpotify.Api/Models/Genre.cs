namespace NotSpotify.Api.Models;

public class Genre
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Color { get; set; } = "#888888";
    public string? ImageUrl { get; set; }

    public ICollection<TrackGenre> TrackGenres { get; set; } = new List<TrackGenre>();
}
