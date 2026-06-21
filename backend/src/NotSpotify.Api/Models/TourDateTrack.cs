namespace NotSpotify.Api.Models;

/// <summary>A song on a tour/concert date's setlist, ordered by <see cref="Position"/>.</summary>
public class TourDateTrack
{
    public Guid TourDateId { get; set; }
    public TourDate TourDate { get; set; } = null!;

    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;

    public int Position { get; set; }
}
