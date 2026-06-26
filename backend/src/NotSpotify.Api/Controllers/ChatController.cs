using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Hubs;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

/// <summary>
/// Direct messages between friends.
///
/// Persistence is REST (this controller); real-time delivery rides the existing
/// PresenceHub WebSocket: after saving, we push a "ChatMessage" event to the
/// recipient's (and sender's, for multi-tab sync) "user-{id}" SignalR group.
///
/// SECURITY NOTE — messages are stored in PLAINTEXT for now. The end-to-end
/// encryption design is sketched (commented out) in Models/ChatMessage.cs and
/// frontend src/utils/chatEncryption.ts for later implementation.
/// </summary>
[ApiController]
[Route("chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private const int MaxBodyLength = 4000;
    private const int DefaultPageSize = 50;

    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly IHubContext<PresenceHub> _hub;
    private readonly NotificationService _notifications;

    public ChatController(AppDbContext db, MediaMapper mapper, IHubContext<PresenceHub> hub, NotificationService notifications)
    {
        _db = db;
        _mapper = mapper;
        _hub = hub;
        _notifications = notifications;
    }

    private Guid CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : throw new UnauthorizedAccessException();
    }

    private Task<bool> AreFriends(Guid a, Guid b, CancellationToken ct) =>
        _db.Friendships.AnyAsync(f =>
            f.Status == FriendshipStatus.Accepted &&
            ((f.RequesterId == a && f.AddresseeId == b) ||
             (f.RequesterId == b && f.AddresseeId == a)),
            ct);

    private static ChatMessageDto ToDto(ChatMessage m) => new(
        m.Id.ToString(),
        m.SenderId.ToString(),
        m.RecipientId.ToString(),
        m.Body,
        m.SentAt,
        m.ReadAt
    );

    // ── Conversations list ───────────────────────────────────────────────────

    /// <summary>
    /// GET /chat/conversations — every friend I have messages with, newest first,
    /// each with the last message and my unread count.
    /// </summary>
    [HttpGet("conversations")]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations(CancellationToken ct = default)
    {
        var me = CurrentUserId();

        var messages = await _db.ChatMessages
            .Where(m => m.SenderId == me || m.RecipientId == me)
            .OrderByDescending(m => m.SentAt)
            .ToListAsync(ct);

        // Group by "the other participant".
        var byPartner = messages
            .GroupBy(m => m.SenderId == me ? m.RecipientId : m.SenderId)
            .ToDictionary(g => g.Key, g => g.ToList());

        if (byPartner.Count == 0)
            return Ok(Array.Empty<ConversationDto>());

        var partnerIds = byPartner.Keys.ToList();
        var partners = await _db.Users
            .Where(u => partnerIds.Contains(u.Id))
            .ToListAsync(ct);

        var result = partners
            .Select(p =>
            {
                var thread = byPartner[p.Id];
                var last = thread[0]; // already newest-first
                var unread = thread.Count(m => m.RecipientId == me && m.ReadAt == null);
                return new ConversationDto(
                    p.Id.ToString(),
                    p.Name,
                    _mapper.ToRef(p).AvatarUrl,
                    ToDto(last),
                    unread
                );
            })
            .OrderByDescending(c => c.LastMessage!.SentAt)
            .ToList();

        return Ok(result);
    }

    // ── Thread history ───────────────────────────────────────────────────────

    /// <summary>
    /// GET /chat/with/{userId}?before=&amp;limit= — messages between me and a friend,
    /// newest page first (client reverses for display). `before` pages backwards.
    /// </summary>
    [HttpGet("with/{userId:guid}")]
    public async Task<ActionResult<IEnumerable<ChatMessageDto>>> GetThread(
        Guid userId,
        [FromQuery] DateTime? before = null,
        [FromQuery] int limit = DefaultPageSize,
        CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (!await AreFriends(me, userId, ct))
            return Forbid();

        limit = Math.Clamp(limit, 1, 100);

        var query = _db.ChatMessages
            .Where(m => (m.SenderId == me && m.RecipientId == userId) ||
                        (m.SenderId == userId && m.RecipientId == me));

        if (before.HasValue)
            query = query.Where(m => m.SentAt < before.Value);

        var page = await query
            .OrderByDescending(m => m.SentAt)
            .Take(limit)
            .ToListAsync(ct);

        return Ok(page.Select(ToDto));
    }

    // ── Send ─────────────────────────────────────────────────────────────────

    /// <summary>POST /chat/with/{userId} — send a message to a friend.</summary>
    [HttpPost("with/{userId:guid}")]
    [EnableRateLimiting("chat-send")]
    public async Task<ActionResult<ChatMessageDto>> Send(
        Guid userId,
        [FromBody] SendChatMessageDto dto,
        CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (userId == me)
            return BadRequest(new { message = "You cannot message yourself." });

        var body = dto.Body?.Trim() ?? string.Empty;
        if (body.Length == 0)
            return BadRequest(new { message = "Message cannot be empty." });
        if (body.Length > MaxBodyLength)
            return BadRequest(new { message = $"Message is too long (max {MaxBodyLength} characters)." });

        if (!await AreFriends(me, userId, ct))
            return Forbid();

        // E2E note: with encryption enabled, `body` would arrive as ciphertext
        // and the server would store it without ever seeing the plaintext.
        var message = new ChatMessage
        {
            SenderId = me,
            RecipientId = userId,
            Body = body,
        };
        _db.ChatMessages.Add(message);
        await _db.SaveChangesAsync(ct);

        var payload = ToDto(message);

        // Real-time push over the existing presence WebSocket:
        //  - recipient gets the new message instantly (chat window + unread badge)
        //  - sender's *other* tabs stay in sync too
        await Task.WhenAll(
            _hub.Clients.Group($"user-{userId}").SendAsync("ChatMessage", payload, ct),
            _hub.Clients.Group($"user-{me}").SendAsync("ChatMessage", payload, ct)
        );

        // Persist a Notifications row so opt-in desktop alerts can fire from the
        // /notifications poll. Preview is body-truncated to keep it bell-sized.
        var sender = await _db.Users.FindAsync(new object[] { me }, ct);
        if (sender is not null)
        {
            var preview = body.Length > 80 ? body[..77] + "…" : body;
            await _notifications.NotifyAsync(
                userId,
                "chat_message",
                $"{sender.Name} sent you a message",
                body: preview,
                linkUrl: $"/messages/{me}",
                imageUrl: _mapper.ToRef(sender).AvatarUrl,
                ct: ct);
        }

        return Ok(payload);
    }

    // ── Read receipts ────────────────────────────────────────────────────────

    /// <summary>
    /// POST /chat/with/{userId}/read — mark every message from that friend as read.
    /// Pushes a "ChatRead" event to the sender so their ✓✓ ticks update live.
    /// </summary>
    [HttpPost("with/{userId:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid userId, CancellationToken ct = default)
    {
        var me = CurrentUserId();

        var now = DateTime.UtcNow;
        var updated = await _db.ChatMessages
            .Where(m => m.SenderId == userId && m.RecipientId == me && m.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.ReadAt, now), ct);

        if (updated > 0)
        {
            // Tell the original sender their messages were read (live read receipts),
            // and sync my own other tabs so their unread badges clear too.
            await Task.WhenAll(
                _hub.Clients.Group($"user-{userId}").SendAsync("ChatRead", me.ToString(), now, ct),
                _hub.Clients.Group($"user-{me}").SendAsync("ChatReadSelf", userId.ToString(), ct)
            );
        }

        return NoContent();
    }
}
