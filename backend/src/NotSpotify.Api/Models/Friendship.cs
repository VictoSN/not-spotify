namespace NotSpotify.Api.Models;

public enum FriendshipStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2,
}

/// <summary>
/// Directed friendship edge in the social graph.
/// RequesterID sent the invite; AddresseeId received it.
/// When Status = Accepted, both users are friends — queries must check both directions.
/// </summary>
public class Friendship
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RequesterId { get; set; }
    public ApplicationUser Requester { get; set; } = null!;

    public Guid AddresseeId { get; set; }
    public ApplicationUser Addressee { get; set; } = null!;

    public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
