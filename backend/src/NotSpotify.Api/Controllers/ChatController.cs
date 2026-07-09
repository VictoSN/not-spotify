using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

/// <summary>
/// Direct-message HISTORY over REST — conversation list and thread backlog only.
///
/// Sending messages and delivery/read receipts do NOT live here: they are
/// WhatsApp-style and travel over the PresenceHub WebSocket (SendMessage /
/// MarkDelivered / MarkRead). This controller is purely for loading old history,
/// the same way WhatsApp fetches backlog over HTTP but sends live traffic over
/// its socket.
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
    private const int DefaultPageSize = 50;

    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public ChatController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    private Guid CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : throw new UnauthorizedAccessException();
    }

    private static ChatMessageDto ToDto(ChatMessage m) => new(
        m.Id.ToString(),
        m.SenderId.ToString(),
        m.RecipientId.ToString(),
        m.Body,
        m.SentAt,
        m.DeliveredAt,
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
    /// GET /chat/with/{userId}?before=&amp;limit= — messages exchanged with another user,
    /// newest page first (client reverses for display). `before` pages backwards.
    ///
    /// History is intentionally NOT friend-gated (bug 28): after unfriending you can
    /// still read the old conversation, and re-friending lets you pick up where you
    /// left off. There is no privacy leak — the query only ever returns messages that
    /// were actually exchanged between the two of you. Sending, however, stays
    /// friend-gated (see Send below).
    /// </summary>
    [HttpGet("with/{userId:guid}")]
    public async Task<ActionResult<IEnumerable<ChatMessageDto>>> GetThread(
        Guid userId,
        [FromQuery] DateTime? before = null,
        [FromQuery] int limit = DefaultPageSize,
        CancellationToken ct = default)
    {
        var me = CurrentUserId();

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
}
