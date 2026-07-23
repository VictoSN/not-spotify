using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Chat tests. Sending + receipts are WhatsApp-style over the PresenceHub socket,
/// so those are exercised against the hub directly; history retrieval stays on the
/// REST ChatController.
/// </summary>
public class ChatControllerTests
{
    [Fact]
    public async Task SendMessage_ToSelf_Throws()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var (hub, proxy) = TestHelpers.NewPresenceHub(db, me);

        await Assert.ThrowsAsync<HubException>(() => hub.SendMessage(me.ToString(), "hello"));

        Assert.Empty(db.ChatMessages);
        proxy.Verify(
            p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SendMessage_EmptyBody_Throws()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var friend = Guid.NewGuid();
        db.AddFriendship(me, friend);
        await db.SaveChangesAsync();
        var (hub, _) = TestHelpers.NewPresenceHub(db, me);

        await Assert.ThrowsAsync<HubException>(() => hub.SendMessage(friend.ToString(), "   "));

        Assert.Empty(db.ChatMessages);
    }

    [Fact]
    public async Task SendMessage_ToNonFriend_ThrowsAndPushesNothing()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        var (hub, proxy) = TestHelpers.NewPresenceHub(db, me);

        await Assert.ThrowsAsync<HubException>(() => hub.SendMessage(stranger.ToString(), "hi"));

        Assert.Empty(db.ChatMessages);
        proxy.Verify(
            p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SendMessage_ToFriend_PersistsMessageAndPushesRealtime()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var friend = Guid.NewGuid();
        db.AddFriendship(me, friend);
        await db.SaveChangesAsync();
        var (hub, proxy) = TestHelpers.NewPresenceHub(db, me);

        var dto = await hub.SendMessage(friend.ToString(), "  hey there  ");

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
        Assert.Equal("Open Messages to read it.", notification.Body);
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
        var sender = Guid.NewGuid();
        var me = Guid.NewGuid();
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage
        {
            SenderId = sender,
            RecipientId = me,
            Body = "delivered",
        });
        await db.SaveChangesAsync();
        var (hub, proxy) = TestHelpers.NewPresenceHub(db, me);

        await hub.MarkDelivered();

        Assert.NotNull(Assert.Single(db.ChatMessages).DeliveredAt);
        proxy.Verify(
            p => p.SendCoreAsync("ChatDelivered", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task MarkRead_AlsoMarksUndeliveredMessageDelivered()
    {
        await using var db = TestHelpers.NewDb();
        var sender = Guid.NewGuid();
        var me = Guid.NewGuid();
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage
        {
            SenderId = sender,
            RecipientId = me,
            Body = "read",
        });
        await db.SaveChangesAsync();
        var (hub, proxy) = TestHelpers.NewPresenceHub(db, me);

        await hub.MarkRead(sender.ToString());

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
        var me = Guid.NewGuid();
        var formerFriend = Guid.NewGuid();
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage { SenderId = me, RecipientId = formerFriend, Body = "old message" });
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage { SenderId = formerFriend, RecipientId = me, Body = "old reply" });
        await db.SaveChangesAsync();
        var controller = new ChatController(db, TestHelpers.NewMapper()).AsUser(me);

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
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        var unrelated = Guid.NewGuid();
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage { SenderId = me, RecipientId = other, Body = "ours" });
        db.ChatMessages.Add(new NotSpotify.Api.Models.ChatMessage { SenderId = unrelated, RecipientId = me, Body = "someone else" });
        await db.SaveChangesAsync();
        var controller = new ChatController(db, TestHelpers.NewMapper()).AsUser(me);

        var action = await controller.GetThread(other);

        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var messages = Assert.IsAssignableFrom<IEnumerable<ChatMessageDto>>(ok.Value).ToList();
        Assert.Single(messages);
        Assert.Equal("ours", messages[0].Body);
    }
}
