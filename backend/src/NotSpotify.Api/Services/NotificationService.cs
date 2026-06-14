using Microsoft.AspNetCore.SignalR;
using NotSpotify.Api.Data;
using NotSpotify.Api.Hubs;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

/// <summary>
/// Creates in-app notifications and nudges the recipient's live connections
/// (via PresenceHub groups) so the bell updates without waiting for a poll.
/// Best-effort: a notification failure must never break the action that
/// triggered it.
/// </summary>
public class NotificationService
{
    private readonly AppDbContext _db;
    private readonly IHubContext<PresenceHub> _hub;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(AppDbContext db, IHubContext<PresenceHub> hub, ILogger<NotificationService> logger)
    {
        _db = db;
        _hub = hub;
        _logger = logger;
    }

    public async Task NotifyAsync(
        Guid userId,
        string type,
        string title,
        string? body = null,
        string? linkUrl = null,
        string? imageUrl = null,
        CancellationToken ct = default)
    {
        try
        {
            _db.Notifications.Add(new Notification
            {
                UserId = userId,
                Type = type,
                Title = title,
                Body = body,
                LinkUrl = linkUrl,
                ImageUrl = imageUrl,
            });
            await _db.SaveChangesAsync(ct);

            // Live nudge — the client refetches the list/badge on this event.
            await _hub.Clients.Group($"user-{userId}").SendAsync("NotificationReceived", ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create notification for {UserId}", userId);
        }
    }
}
