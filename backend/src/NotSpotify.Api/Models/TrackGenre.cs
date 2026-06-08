namespace NotSpotify.Api.Models;

public class TrackGenre
{
    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;

    public Guid GenreId { get; set; }
    public Genre Genre { get; set; } = null!;
}
