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
        Assert.Null(stored.DeliveredAt);
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
    public async Task MarkDelivered_SetsReceiptAndPushesRealtimeToSender()
    {
        await using var db = TestHelpers.NewDb();
        var (hub, proxy) = TestHelpers.NewHub();
        var sender = Guid.NewGuid();
        var me = Guid.NewGuid();
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage
        {
            SenderId = sender,
            RecipientId = me,
            Body = "delivered",
        });
        await db.SaveChangesAsync();
        var controller = new ChatController(db, TestHelpers.NewMapper(), hub, TestHelpers.NewNotifications(db)).AsUser(me);

        var result = await controller.MarkDelivered();

        Assert.IsType<NoContentResult>(result);
        Assert.NotNull(Assert.Single(db.ChatMessages).DeliveredAt);
        proxy.Verify(
            p => p.SendCoreAsync("ChatDelivered", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task MarkRead_AlsoMarksUndeliveredMessageDelivered()
    {
        await using var db = TestHelpers.NewDb();
        var (hub, proxy) = TestHelpers.NewHub();
        var sender = Guid.NewGuid();
        var me = Guid.NewGuid();
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage
        {
            SenderId = sender,
            RecipientId = me,
            Body = "read",
        });
        await db.SaveChangesAsync();
        var controller = new ChatController(db, TestHelpers.NewMapper(), hub, TestHelpers.NewNotifications(db)).AsUser(me);

        var result = await controller.MarkRead(sender);

        Assert.IsType<NoContentResult>(result);
        var stored = Assert.Single(db.ChatMessages);
        Assert.NotNull(stored.DeliveredAt);
        Assert.NotNull(stored.ReadAt);
        proxy.Verify(
            p => p.SendCoreAsync("ChatRead", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task GetThread_AfterUnfriend_StillReturnsHistory()
    {
        // Bug 28: history is NOT friend-gated. Two users with an existing
        // conversation but no current friendship (i.e. after unfriending) can
        // still read the old thread — only sending is blocked.
        await using var db = TestHelpers.NewDb();
        var (hub, _) = TestHelpers.NewHub();
        var me = Guid.NewGuid();
        var formerFriend = Guid.NewGuid();
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage { SenderId = me, RecipientId = formerFriend, Body = "old message" });
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage { SenderId = formerFriend, RecipientId = me, Body = "old reply" });
        await db.SaveChangesAsync();
        var controller = new ChatController(db, TestHelpers.NewMapper(), hub, TestHelpers.NewNotifications(db)).AsUser(me);

        var action = await controller.GetThread(formerFriend);

        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var messages = Assert.IsAssignableFrom<IEnumerable<ChatMessageDto>>(ok.Value);
        Assert.Equal(2, messages.Count());
    }

    [Fact]
    public async Task GetThread_ReturnsOnlyMessagesBetweenTheTwoUsers()
    {
        // No privacy leak: the thread only ever surfaces messages actually
        // exchanged between the caller and the target, never anyone else's.
        await using var db = TestHelpers.NewDb();
        var (hub, _) = TestHelpers.NewHub();
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        var unrelated = Guid.NewGuid();
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage { SenderId = me, RecipientId = other, Body = "ours" });
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage { SenderId = unrelated, RecipientId = me, Body = "someone else" });
        await db.SaveChangesAsync();
        var controller = new ChatController(db, TestHelpers.NewMapper(), hub, TestHelpers.NewNotifications(db)).AsUser(me);

        var action = await controller.GetThread(other);

        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var messages = Assert.IsAssignableFrom<IEnumerable<ChatMessageDto>>(ok.Value).ToList();
        Assert.Single(messages);
        Assert.Equal("ours", messages[0].Body);
    }
}
