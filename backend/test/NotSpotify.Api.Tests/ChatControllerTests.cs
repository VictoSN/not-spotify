using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using Xunit;

namespace NotSpotify.Api.Tests;

public class ChatControllerTests
{
    [Fact]
    public async Task Send_ToSelf_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var (hub, _) = TestHelpers.NewHub();
        var me = Guid.NewGuid();
        var controller = new ChatController(db, TestHelpers.NewMapper(), hub, TestHelpers.NewNotifications(db)).AsUser(me);

        var action = await controller.Send(me, new SendChatMessageDto("hello"));

        Assert.IsType<BadRequestObjectResult>(action.Result);
        Assert.Empty(db.ChatMessages);
    }

    [Fact]
    public async Task Send_EmptyBody_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var (hub, _) = TestHelpers.NewHub();
        var me = Guid.NewGuid();
        var friend = Guid.NewGuid();
        db.AddFriendship(me, friend);
        await db.SaveChangesAsync();
        var controller = new ChatController(db, TestHelpers.NewMapper(), hub, TestHelpers.NewNotifications(db)).AsUser(me);

        var action = await controller.Send(friend, new SendChatMessageDto("   "));

        Assert.IsType<BadRequestObjectResult>(action.Result);
        Assert.Empty(db.ChatMessages);
    }

    [Fact]
    public async Task Send_ToNonFriend_ReturnsForbid()
    {
        await using var db = TestHelpers.NewDb();
        var (hub, proxy) = TestHelpers.NewHub();
        var me = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        var controller = new ChatController(db, TestHelpers.NewMapper(), hub, TestHelpers.NewNotifications(db)).AsUser(me);

        var action = await controller.Send(stranger, new SendChatMessageDto("hi"));

        Assert.IsType<ForbidResult>(action.Result);
        Assert.Empty(db.ChatMessages);
        proxy.Verify(
            p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Send_ToFriend_PersistsMessageAndPushesRealtime()
    {
        await using var db = TestHelpers.NewDb();
        var (hub, proxy) = TestHelpers.NewHub();
        var me = Guid.NewGuid();
        var friend = Guid.NewGuid();
        db.AddFriendship(me, friend);
        await db.SaveChangesAsync();
        var controller = new ChatController(db, TestHelpers.NewMapper(), hub, TestHelpers.NewNotifications(db)).AsUser(me);

        var action = await controller.Send(friend, new SendChatMessageDto("  hey there  "));

        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var dto = Assert.IsType<ChatMessageDto>(ok.Value);
        Assert.Equal("hey there", dto.Body); // trimmed
        Assert.Equal(me.ToString(), dto.SenderId);
        Assert.Equal(friend.ToString(), dto.RecipientId);

        var stored = Assert.Single(db.ChatMessages);
        Assert.Equal("hey there", stored.Body);
        Assert.Null(stored.ReadAt);

        var notification = Assert.Single(db.Notifications);
        Assert.Equal(friend, notification.UserId);
        Assert.Equal("chat_message", notification.Type);
        Assert.Equal("Someone sent you a message", notification.Title);
        Assert.Equal("hey there", notification.Body);
        Assert.Equal($"/messages?u={me}", notification.LinkUrl);

        // A "ChatMessage" push went to both the recipient and the sender's own group.
        proxy.Verify(
            p => p.SendCoreAsync("ChatMessage", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Fact]
    public async Task GetThread_NonFriend_ReturnsForbid()
    {
        await using var db = TestHelpers.NewDb();
        var (hub, _) = TestHelpers.NewHub();
        var me = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        var controller = new ChatController(db, TestHelpers.NewMapper(), hub, TestHelpers.NewNotifications(db)).AsUser(me);

        var action = await controller.GetThread(stranger);

        Assert.IsType<ForbidResult>(action.Result);
    }
}
