using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

public class FriendsControllerTests
{
    [Fact]
    public async Task SendRequest_ToSelf_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var controller = new FriendsController(db, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db)).AsUser(me);

        var result = await controller.SendRequest(new SendFriendRequestDto(me));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.Friendships);
    }

    [Fact]
    public async Task SendRequest_New_PersistsPendingAndReturnsNoContent()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var target = Guid.NewGuid();
        var controller = new FriendsController(db, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db)).AsUser(me);

        var result = await controller.SendRequest(new SendFriendRequestDto(target));

        Assert.IsType<NoContentResult>(result);
        var row = Assert.Single(db.Friendships);
        Assert.Equal(me, row.RequesterId);
        Assert.Equal(target, row.AddresseeId);
        Assert.Equal(FriendshipStatus.Pending, row.Status);
    }

    [Fact]
    public async Task SendRequest_WhenAlreadyFriends_ReturnsConflict()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var friend = Guid.NewGuid();
        db.AddFriendship(me, friend);
        await db.SaveChangesAsync();

        var controller = new FriendsController(db, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db)).AsUser(me);

        var result = await controller.SendRequest(new SendFriendRequestDto(friend));

        Assert.IsType<ConflictObjectResult>(result);
        Assert.Single(db.Friendships); // no duplicate created
    }

    [Fact]
    public async Task GetFriends_ReturnsAcceptedFriends_InEitherDirection()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var a = Guid.NewGuid(); // I requested them
        var b = Guid.NewGuid(); // they requested me
        db.AddUser(me, "me");
        db.AddUser(a, "alice");
        db.AddUser(b, "bob");
        db.AddFriendship(me, a);
        db.AddFriendship(b, me);
        await db.SaveChangesAsync();

        var controller = new FriendsController(db, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db)).AsUser(me);

        var action = await controller.GetFriends();

        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var friends = Assert.IsAssignableFrom<IEnumerable<FriendDto>>(ok.Value);
        var ids = friends.Select(f => f.UserId).ToHashSet();
        Assert.Equal(2, ids.Count);
        Assert.Contains(a.ToString(), ids);
        Assert.Contains(b.ToString(), ids);
    }
}
