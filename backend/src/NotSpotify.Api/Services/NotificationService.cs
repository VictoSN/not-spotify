using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
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
    private readonly WebPushService _push;

    public NotificationService(AppDbContext db, IHubContext<PresenceHub> hub, ILogger<NotificationService> logger, WebPushService push)
    {
        _db = db;
        _hub = hub;
        _logger = logger;
        _push = push;
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

            // Real OS-level push (fires even when the tab/app is closed). The
            // payload format mirrors what /public/sw.js expects to render.
            await _push.SendToUserAsync(userId, title, body ?? string.Empty, linkUrl, imageUrl, tag: type, ct: ct);
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

            _db.Notifications.AddRange(followerIds.Select(fid => new Notification
            {
                UserId = fid,
                Type = "repost",
                Title = $"{user.Name} reposted {description}",
                LinkUrl = link,
                ImageUrl = user.AvatarUrl,
            }));

            await _db.SaveChangesAsync(ct);

            foreach (var fid in followerIds)
            {
                await _hub.Clients.Group($"user-{fid}").SendAsync("NotificationReceived", ct);
                await _push.SendToUserAsync(fid, $"{user.Name} reposted {description}", "", link, user.AvatarUrl, tag: "repost", ct: ct);
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

            _db.Notifications.AddRange(followerIds.Select(userId => new Notification
            {
                UserId = userId,
                Type = "new_release",
                Title = title,
                Body = body,
                LinkUrl = linkUrl,
                ImageUrl = imageUrl,
            }));

            await _db.SaveChangesAsync(ct);

            foreach (var userId in followerIds)
            {
                await _hub.Clients.Group($"user-{userId}").SendAsync("NotificationReceived", ct);
                await _push.SendToUserAsync(userId, title, body, linkUrl, imageUrl, tag: "new_release", ct: ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create new-release notifications for artist {ArtistId}", artistId);
        }
    }
}
