using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// The asymmetric follow graph (UsersController): follow/unfollow idempotency,
/// self-403, follower/following lists (ordering + viewer flag), and the
/// follower/following counts surfaced on the public profile.
/// </summary>
public class FollowsControllerTests
{
    private static UsersController New(AppDbContext db, Guid me) =>
        new UsersController(db, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db)).AsUser(me);

    private static UsersController NewGuest(AppDbContext db) =>
        new UsersController(db, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db)).AsGuest();

    [Fact]
    public async Task Follow_Self_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();

        var result = await New(db, me).Follow(me);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.UserFollows);
    }

    [Fact]
    public async Task Follow_NonExistentUser_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();

        var result = await New(db, me).Follow(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
        Assert.Empty(db.UserFollows);
    }

    [Fact]
    public async Task Follow_New_PersistsEdge_AndIsIdempotent()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        db.AddUser(me, "me");
        db.AddUser(target, "target");
        await db.SaveChangesAsync();

        var first = await New(db, me).Follow(target);
        Assert.IsType<NoContentResult>(first);
        Assert.Single(db.UserFollows);

        var second = await New(db, me).Follow(target);
        Assert.IsType<NoContentResult>(second);
        Assert.Single(db.UserFollows); // no duplicate edge
    }

    [Fact]
    public async Task Unfollow_RemovesEdge_AndIsIdempotentWhenNotFollowing()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        db.AddUser(me, "me");
        db.AddUser(target, "target");
        db.AddFollow(me, target);
        await db.SaveChangesAsync();

        var first = await New(db, me).Unfollow(target);
        Assert.IsType<NoContentResult>(first);
        Assert.Empty(db.UserFollows);

        var again = await New(db, me).Unfollow(target);
        Assert.IsType<NoContentResult>(again); // idempotent — already gone
    }

    [Fact]
    public async Task GetProfile_ReportsFollowerAndFollowingCounts_AndIsFollowing()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        var fanA = Guid.NewGuid();
        var fanB = Guid.NewGuid();
        var idol = Guid.NewGuid();
        foreach (var (id, name) in new[] { (me, "me"), (target, "target"), (fanA, "a"), (fanB, "b"), (idol, "idol") })
            db.AddUser(id, name);
        // target is followed by me + fanA + fanB (3 followers); target follows idol (1 following).
        db.AddFollow(me, target);
        db.AddFollow(fanA, target);
        db.AddFollow(fanB, target);
        db.AddFollow(target, idol);
        await db.SaveChangesAsync();

        var result = await New(db, me).GetProfile(target);

        var dto = Assert.IsType<PublicUserProfileDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(3, dto.FollowerCount);
        Assert.Equal(1, dto.FollowingCount);
        Assert.True(dto.IsFollowing);
    }

    [Fact]
    public async Task GetProfile_OwnProfile_IsFollowingIsNull()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();

        var result = await New(db, me).GetProfile(me);

        var dto = Assert.IsType<PublicUserProfileDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Null(dto.IsFollowing);
    }

    [Fact]
    public async Task GetFollowers_And_GetFollowing_ReturnExpectedUsers()
    {
        await using var db = TestHelpers.NewDb();
        var hub = Guid.NewGuid();
        var fan = Guid.NewGuid();
        var idol = Guid.NewGuid();
        db.AddUser(hub, "hub");
        db.AddUser(fan, "fan");
        db.AddUser(idol, "idol");
        db.AddFollow(fan, hub);   // fan follows hub  → hub's follower
        db.AddFollow(hub, idol);  // hub follows idol → hub's following
        await db.SaveChangesAsync();

        var followers = await NewGuest(db).GetFollowers(hub);
        var fList = Assert.IsAssignableFrom<IEnumerable<FollowUserDto>>(Assert.IsType<OkObjectResult>(followers.Result).Value);
        Assert.Equal(fan.ToString(), Assert.Single(fList).Id);

        var following = await NewGuest(db).GetFollowing(hub);
        var gList = Assert.IsAssignableFrom<IEnumerable<FollowUserDto>>(Assert.IsType<OkObjectResult>(following.Result).Value);
        Assert.Equal(idol.ToString(), Assert.Single(gList).Id);
    }

    [Fact]
    public async Task GetFollowers_FlagsWhichTheViewerAlreadyFollows()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var hub = Guid.NewGuid();
        var sharedFan = Guid.NewGuid();
        db.AddUser(me, "me");
        db.AddUser(hub, "hub");
        db.AddUser(sharedFan, "sharedFan");
        db.AddFollow(sharedFan, hub); // sharedFan follows hub
        db.AddFollow(me, sharedFan);  // I follow sharedFan
        await db.SaveChangesAsync();

        var result = await New(db, me).GetFollowers(hub);

        var list = Assert.IsAssignableFrom<IEnumerable<FollowUserDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var entry = Assert.Single(list);
        Assert.Equal(sharedFan.ToString(), entry.Id);
        Assert.True(entry.IsFollowedByMe);
    }
}
