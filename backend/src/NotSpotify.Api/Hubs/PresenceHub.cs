using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Hubs;

/// <summary>
/// Real-time presence hub. Each authenticated browser tab opens one connection.
/// We count connections per user so that:
///   - The first tab connecting  → broadcasts FriendOnline  to all friends.
///   - The last tab disconnecting → broadcasts FriendOffline to all friends.
/// Multiple tabs on the same account are handled transparently.
/// </summary>
[Authorize]
public class PresenceHub : Hub
{
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

    public PresenceHub(AppDbContext db) => _db = db;

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
}
