using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Hubs;

/// <summary>
/// Real-time presence + chat hub. Each authenticated browser tab opens one
/// connection. We count connections per user so that:
///   - The first tab connecting  → broadcasts FriendOnline  to all friends.
///   - The last tab disconnecting → broadcasts FriendOffline to all friends.
/// Multiple tabs on the same account are handled transparently.
///
/// Direct messaging is WhatsApp-style: the message itself and the delivery/read
/// receipts travel over this WebSocket (client invokes SendMessage / MarkRead /
/// MarkDelivered), NOT over REST. HTTP is only used to load old history
/// (ChatController.GetConversations / GetThread), the same way WhatsApp fetches
/// backlog over HTTP but sends live traffic over its socket.
///
/// Client → server: SendMessage(recipientId, body), MarkDelivered(), MarkRead(userId)
/// Server → client: "ChatMessage" (dto)                — a new message,
///                   "ChatDelivered" (recipientId, at) — recipient's client got it,
///                   "ChatRead" (readerId, at)         — my messages were read,
///                   "ChatReadSelf" (partnerId)        — another of my tabs read it.
/// </summary>
[Authorize]
public class PresenceHub : Hub
{
    private const int MaxBodyLength = 4000;
    // In-memory connection count per user (works for single-server / dev).
    // If you scale to multiple server instances, replace with Redis or similar.
    private static readonly ConcurrentDictionary<Guid, int> _connectionCounts = new();

    /// <summary>
    /// True when the user has at least one live SignalR connection (any tab).
    /// Used to avoid double notifications: when a user is online the realtime
    /// "NotificationReceived" event already shows the OS banner, so the server
    /// skips the redundant Web Push (whose purpose is closed-app delivery).
    /// </summary>
    public static bool IsUserOnline(Guid userId) =>
        _connectionCounts.TryGetValue(userId, out var count) && count > 0;

    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly NotificationService _notifications;

    public PresenceHub(AppDbContext db, MediaMapper mapper, NotificationService notifications)
    {
        _db = db;
        _mapper = mapper;
        _notifications = notifications;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Guid? CurrentUserId()
    {
        var id = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? Context.User?.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    private IQueryable<Guid> FriendIdsOf(Guid userId) =>
        _db.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted &&
                        (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId);

    private Task<bool> AreFriends(Guid a, Guid b) =>
        _db.Friendships.AnyAsync(f =>
            f.Status == FriendshipStatus.Accepted &&
            ((f.RequesterId == a && f.AddresseeId == b) ||
             (f.RequesterId == b && f.AddresseeId == a)));

    private static ChatMessageDto ToDto(ChatMessage m) => new(
        m.Id.ToString(),
        m.SenderId.ToString(),
        m.RecipientId.ToString(),
        m.Body,
        m.SentAt,
        m.DeliveredAt,
        m.ReadAt
    );

    // ── Connect ───────────────────────────────────────────────────────────────

    public override async Task OnConnectedAsync()
    {
        var userId = CurrentUserId();
        if (userId is null)
        {
            await base.OnConnectedAsync();
            return;
        }

        // Join own group so friends can push messages to this user by ID.
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");

        var newCount = _connectionCounts.AddOrUpdate(userId.Value, 1, (_, c) => c + 1);

        // First connection — user just came online.
        if (newCount == 1)
        {
            var user = await _db.Users.FindAsync(userId.Value);
            if (user is not null)
            {
                user.LastSeenAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            // Push "online" to every friend currently connected.
            var friendIds = await FriendIdsOf(userId.Value).ToListAsync();
            var tasks = friendIds.Select(fid =>
                Clients.Group($"user-{fid}").SendAsync("FriendOnline", userId.Value.ToString()));
            await Task.WhenAll(tasks);
        }

        await base.OnConnectedAsync();
    }

    // ── Disconnect ────────────────────────────────────────────────────────────

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = CurrentUserId();
        if (userId is null)
        {
            await base.OnDisconnectedAsync(exception);
            return;
        }

        var newCount = _connectionCounts.AddOrUpdate(userId.Value, 0, (_, c) => Math.Max(0, c - 1));

        // Last connection closed — user is now offline.
        if (newCount == 0)
        {
            _connectionCounts.TryRemove(userId.Value, out _);

            var user = await _db.Users.FindAsync(userId.Value);
            if (user is not null)
            {
                user.LastSeenAt = null;
                await _db.SaveChangesAsync();
            }

            // Push "offline" to every friend currently connected.
            var friendIds = await FriendIdsOf(userId.Value).ToListAsync();
            var tasks = friendIds.Select(fid =>
                Clients.Group($"user-{fid}").SendAsync("FriendOffline", userId.Value.ToString()));
            await Task.WhenAll(tasks);
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ── Client-callable methods ───────────────────────────────────────────────

    /// <summary>
    /// Client calls this to keep LastSeenAt fresh (e.g. for now-playing updates).
    /// Online/offline state itself is handled by connect/disconnect — this is
    /// only needed to timestamp the user for "now playing" activity queries.
    /// </summary>
    public async Task Ping()
    {
        var userId = CurrentUserId();
        if (userId is null) return;

        var user = await _db.Users.FindAsync(userId.Value);
        if (user is not null)
        {
            user.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    // ── Chat (WhatsApp-style: messages ride the socket, not REST) ──────────────

    /// <summary>
    /// Send a direct message to a friend over the socket. Saves it, then pushes a
    /// "ChatMessage" event to the recipient (live delivery + unread badge) and to
    /// the sender's own group (multi-tab sync + echo). Returns the saved message so
    /// the caller can reconcile its optimistic bubble.
    /// Throws a HubException on invalid input so the client can surface the reason.
    /// </summary>
    public async Task<ChatMessageDto> SendMessage(string recipientId, string body)
    {
        var me = CurrentUserId() ?? throw new HubException("Not authenticated.");
        if (!Guid.TryParse(recipientId, out var userId))
            throw new HubException("Invalid recipient.");
        if (userId == me)
            throw new HubException("You cannot message yourself.");

        body = body?.Trim() ?? string.Empty;
        if (body.Length == 0)
            throw new HubException("Message cannot be empty.");
        if (body.Length > MaxBodyLength)
            throw new HubException($"Message is too long (max {MaxBodyLength} characters).");

        if (!await AreFriends(me, userId))
            throw new HubException("You can only message friends.");

        // E2E note: with encryption enabled, `body` would arrive as ciphertext
        // and the server would store it without ever seeing the plaintext.
        var message = new ChatMessage
        {
            SenderId = me,
            RecipientId = userId,
            Body = body,
        };
        _db.ChatMessages.Add(message);
        await _db.SaveChangesAsync();

        var payload = ToDto(message);

        // Live delivery over the socket:
        //  - recipient gets the new message instantly (chat window + unread badge)
        //  - sender's *other* tabs stay in sync too
        await Task.WhenAll(
            Clients.Group($"user-{userId}").SendAsync("ChatMessage", payload),
            Clients.Group($"user-{me}").SendAsync("ChatMessage", payload)
        );

        // Persist a Notifications row so opt-in desktop alerts can fire (and Web
        // Push can reach the recipient when their app is closed).
        var sender = await _db.Users.FindAsync(me);
        var senderName = sender?.Name ?? "Someone";
        var senderAvatar = sender is null ? null : _mapper.ToRef(sender).AvatarUrl;
        var preview = body.Length > 80 ? body[..77] + "…" : body;
        await _notifications.NotifyAsync(
            userId,
            "chat_message",
            $"{senderName} sent you a message",
            body: preview,
            linkUrl: $"/messages?u={me}",
            imageUrl: senderAvatar);

        return payload;
    }

    /// <summary>
    /// Acknowledge every message that has reached this recipient's client and push
    /// "ChatDelivered" receipts to their senders (one grey tick → two).
    /// </summary>
    public async Task MarkDelivered()
    {
        var me = CurrentUserId();
        if (me is null) return;

        var now = DateTime.UtcNow;
        var messages = await _db.ChatMessages
            .Where(m => m.RecipientId == me.Value && m.DeliveredAt == null)
            .ToListAsync();

        if (messages.Count == 0) return;

        foreach (var message in messages) message.DeliveredAt = now;
        await _db.SaveChangesAsync();

        var senders = messages.Select(m => m.SenderId).Distinct();
        await Task.WhenAll(senders.Select(senderId =>
            Clients.Group($"user-{senderId}")
                .SendAsync("ChatDelivered", me.Value.ToString(), now)));
    }

    /// <summary>
    /// Mark every message from <paramref name="partnerId"/> as read. Pushes
    /// "ChatRead" to the sender (their double ticks turn blue) and "ChatReadSelf"
    /// to my own other tabs so their unread badges clear.
    /// </summary>
    public async Task MarkRead(string partnerId)
    {
        var me = CurrentUserId();
        if (me is null || !Guid.TryParse(partnerId, out var userId)) return;

        var now = DateTime.UtcNow;
        var messages = await _db.ChatMessages
            .Where(m => m.SenderId == userId && m.RecipientId == me.Value && m.ReadAt == null)
            .ToListAsync();

        if (messages.Count == 0) return;

        foreach (var message in messages)
        {
            message.DeliveredAt ??= now;
            message.ReadAt = now;
        }
        await _db.SaveChangesAsync();

        await Task.WhenAll(
            Clients.Group($"user-{userId}").SendAsync("ChatRead", me.Value.ToString(), now),
            Clients.Group($"user-{me.Value}").SendAsync("ChatReadSelf", userId.ToString())
        );
    }
}
