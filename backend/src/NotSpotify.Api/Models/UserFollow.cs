namespace NotSpotify.Api.Models;

/// <summary>
/// Directed follow edge: <see cref="FollowerId"/> follows <see cref="FolloweeId"/>.
/// Asymmetric — unlike <see cref="Friendship"/> there is no acceptance step and no
/// reciprocity requirement. A follows B does not imply B follows A.
/// </summary>
public class UserFollow
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid FollowerId { get; set; }
    public ApplicationUser Follower { get; set; } = null!;

    public Guid FolloweeId { get; set; }
    public ApplicationUser Followee { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
