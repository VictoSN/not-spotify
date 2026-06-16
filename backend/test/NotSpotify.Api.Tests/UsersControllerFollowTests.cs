using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

public class UsersControllerFollowTests
{
    private static UsersController Controller(AppDbContext db) =>
        new(db, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db));

    [Fact]
    public async Task Follow_Self_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();

        var result = await Controller(db).AsUser(me).Follow(me);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.UserFollows);
    }

    [Fact]
    public async Task Follow_NonexistentTarget_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();

        var result = await Controller(db).AsUser(me).Follow(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
        Assert.Empty(db.UserFollows);
    }

    [Fact]
    public async Task Follow_NewTarget_PersistsEdgeAndReturnsNoContent()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        db.AddUser(me, "me");
        db.AddUser(target, "target");
        await db.SaveChangesAsync();

        var result = await Controller(db).AsUser(me).Follow(target);

        Assert.IsType<NoContentResult>(result);
        var edge = Assert.Single(db.UserFollows);
        Assert.Equal(me, edge.FollowerId);
        Assert.Equal(target, edge.FolloweeId);
    }

    [Fact]
    public async Task Follow_AlreadyFollowing_IsIdempotent()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        db.AddUser(me, "me");
        db.AddUser(target, "target");
        db.UserFollows.Add(new UserFollow { FollowerId = me, FolloweeId = target });
        await db.SaveChangesAsync();

        var result = await Controller(db).AsUser(me).Follow(target);

        Assert.IsType<NoContentResult>(result);
        Assert.Single(db.UserFollows); // no duplicate edge
    }

    [Fact]
    public async Task Unfollow_Existing_RemovesEdge()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        db.AddUser(me, "me");
        db.AddUser(target, "target");
        db.UserFollows.Add(new UserFollow { FollowerId = me, FolloweeId = target });
        await db.SaveChangesAsync();

        var result = await Controller(db).AsUser(me).Unfollow(target);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.UserFollows);
    }

    [Fact]
    public async Task Unfollow_NotFollowing_IsIdempotent()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        db.AddUser(me, "me");
        db.AddUser(target, "target");
        await db.SaveChangesAsync();

        var result = await Controller(db).AsUser(me).Unfollow(target);

        Assert.IsType<NoContentResult>(result);
    }
}
