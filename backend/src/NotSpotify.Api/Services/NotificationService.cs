using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
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
    private readonly WebPushService _push;

    public NotificationService(AppDbContext db, IHubContext<PresenceHub> hub, ILogger<NotificationService> logger, WebPushService push)
    {
        _db = db;
        _hub = hub;
        _logger = logger;
        _push = push;
    }

    private static NotificationDto ToDto(Notification notification) => new(
        notification.Id.ToString(),
        notification.Type,
        notification.Title,
        notification.Body,
        notification.LinkUrl,
        notification.ImageUrl,
        notification.IsRead,
        notification.CreatedAt);

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
            var notification = new Notification
            {
                UserId = userId,
                Type = type,
                Title = title,
                Body = body,
                LinkUrl = linkUrl,
                ImageUrl = imageUrl,
            };
            _db.Notifications.Add(notification);
            await _db.SaveChangesAsync(ct);

            // Live nudge — the client refetches the list/badge on this event.
            await _hub.Clients.Group($"user-{userId}").SendAsync(
                "NotificationReceived",
                ToDto(notification),
                ct);

            // Real OS-level push (fires even when the tab/app is closed). Skip it
            // when the user is online — the realtime "NotificationReceived" event
            // above already shows the OS banner, so pushing too would double it.
            // The payload format mirrors what /public/sw.js expects to render.
            if (PresenceHub.IsUserOnline(userId))
            {
                _logger.LogDebug("Web push skipped for {Type} to {UserId}: user online (realtime handles it)", type, userId);
                return;
            }

            var report = await _push.SendToUserAsync(userId, title, body ?? string.Empty, linkUrl, imageUrl, tag: type, ct: ct);
            if (!report.Configured)
            {
                _logger.LogDebug("Web push skipped for {Type} to {UserId}: not configured", type, userId);
            }
            else if (report.Subscriptions == 0)
            {
                _logger.LogInformation("Web push skipped for {Type} to {UserId}: no subscriptions", type, userId);
            }
            else if (report.Delivered == 0)
            {
                _logger.LogWarning(
                    "Web push did not deliver for {Type} to {UserId}: {Failed} failed, {Stale} stale removed",
                    type,
                    userId,
                    report.Failed,
                    report.StaleRemoved);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create notification for {UserId}", userId);
        }
    }

    /// <summary>
    /// Notifies followers that a user reposted something. Best-effort — never throws.
    /// </summary>
    public async Task NotifyFollowersOfRepostAsync(Guid userId, Models.Repost repost, CancellationToken ct = default)
    {
        try
        {
            // Load the user's name for the notification.
            var user = await _db.Users.FindAsync(new object[] { userId }, ct);
            if (user is null) return;

            var followerIds = await _db.UserFollows
                .Where(f => f.FolloweeId == userId)
                .Select(f => f.FollowerId)
                .ToListAsync(ct);

            if (followerIds.Count == 0) return;

            var description = repost.TrackId is not null ? "a track"
                : repost.AlbumId is not null ? "an album"
                : repost.PlaylistId is not null ? "a playlist"
                : "something";

            var link = repost.TrackId is not null ? $"/track/{repost.TrackId}"
                : repost.AlbumId is not null ? $"/album/{repost.AlbumId}"
                : repost.PlaylistId is not null ? $"/playlist/{repost.PlaylistId}"
                : null;

            var notifications = followerIds.Select(fid => new Notification
            {
                UserId = fid,
                Type = "repost",
                Title = $"{user.Name} reposted {description}",
                LinkUrl = link,
                ImageUrl = user.AvatarUrl,
            }).ToList();
            _db.Notifications.AddRange(notifications);

            await _db.SaveChangesAsync(ct);

            foreach (var notification in notifications)
            {
                await _hub.Clients.Group($"user-{notification.UserId}").SendAsync("NotificationReceived", ToDto(notification), ct);
                // Only push to followers who are offline — online ones get the realtime banner.
                if (!PresenceHub.IsUserOnline(notification.UserId))
                    await _push.SendToUserAsync(notification.UserId, $"{user.Name} reposted {description}", "", link, user.AvatarUrl, tag: "repost", ct: ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create repost notifications for user {UserId}", userId);
        }
    }

    public async Task NotifyArtistFollowersOfReleaseAsync(
        Guid artistId,
        string artistName,
        string releaseTitle,
        string releaseKind,
        string linkUrl,
        string? imageUrl = null,
        Guid? excludeUserId = null,
        CancellationToken ct = default)
    {
        try
        {
            var artistAccountIds = await _db.Users
                .Where(u => u.ArtistId == artistId)
                .Select(u => u.Id)
                .ToListAsync(ct);

            if (excludeUserId is Guid submitterId && !artistAccountIds.Contains(submitterId))
                artistAccountIds.Add(submitterId);

            if (artistAccountIds.Count == 0) return;

            var followerIds = await _db.UserFollows
                .Where(f => artistAccountIds.Contains(f.FolloweeId))
                .Select(f => f.FollowerId)
                .Distinct()
                .Where(id => !artistAccountIds.Contains(id))
                .ToListAsync(ct);

            if (followerIds.Count == 0) return;

            var kind = releaseKind.Trim().ToLowerInvariant() == "track" ? "track" : "release";
            var title = $"{artistName} released \"{releaseTitle}\"";
            var body = kind == "track"
                ? "New track from an artist you follow."
                : "New release from an artist you follow.";

            var notifications = followerIds.Select(userId => new Notification
            {
                UserId = userId,
                Type = "new_release",
                Title = title,
                Body = body,
                LinkUrl = linkUrl,
                ImageUrl = imageUrl,
            }).ToList();
            _db.Notifications.AddRange(notifications);

            await _db.SaveChangesAsync(ct);

            foreach (var notification in notifications)
            {
                await _hub.Clients.Group($"user-{notification.UserId}").SendAsync("NotificationReceived", ToDto(notification), ct);
                // Only push to followers who are offline — online ones get the realtime banner.
                if (!PresenceHub.IsUserOnline(notification.UserId))
                    await _push.SendToUserAsync(notification.UserId, title, body, linkUrl, imageUrl, tag: "new_release", ct: ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create new-release notifications for artist {ArtistId}", artistId);
        }
    }
}
