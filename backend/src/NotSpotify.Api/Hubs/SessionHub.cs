using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace NotSpotify.Api.Hubs;

/// <summary>
/// "Jam" / listen-along hub. A host opens a session keyed by their own user id;
/// friends join the group <c>jam-{hostId}</c> and mirror the host's playback.
/// The hub is a thin relay + participant tracker — no DB, all in-memory
/// (single-server / dev; swap for a backplane to scale out).
///
/// Client → server: StartSession, EndSession, Sync(payload), JoinSession(hostId),
///                   LeaveSession(hostId)
/// Server → client: "JamSync" (payload), "JamParticipants" (count),
///                   "JamEnded", "JamJoined" (to the host, so it re-broadcasts state)
/// </summary>
[Authorize]
public class SessionHub : Hub
{
    // hostId → set of participant connection ids (host + guests).
    private static readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, byte>> _sessions = new();
    // connectionId → hostId it's currently joined to (for cleanup on disconnect).
    private static readonly ConcurrentDictionary<string, Guid> _joinedHost = new();

    private Guid? CurrentUserId()
    {
        var id = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? Context.User?.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    private static string Group(Guid hostId) => $"jam-{hostId}";

    private async Task AnnounceParticipants(Guid hostId)
    {
        var count = _sessions.TryGetValue(hostId, out var set) ? set.Count : 0;
        await Clients.Group(Group(hostId)).SendAsync("JamParticipants", count);
    }

    /// <summary>Host opens (or re-opens) their jam and joins its group.</summary>
    public async Task StartSession()
    {
        var me = CurrentUserId();
        if (me is null) return;
        var set = _sessions.GetOrAdd(me.Value, _ => new ConcurrentDictionary<string, byte>());
        set[Context.ConnectionId] = 1;
        _joinedHost[Context.ConnectionId] = me.Value;
        await Groups.AddToGroupAsync(Context.ConnectionId, Group(me.Value));
        await AnnounceParticipants(me.Value);
    }

    /// <summary>A guest joins the host's jam.</summary>
    public async Task JoinSession(Guid hostId)
    {
        if (!_sessions.TryGetValue(hostId, out var set))
        {
            await Clients.Caller.SendAsync("JamEnded");
            return;
        }
        set[Context.ConnectionId] = 1;
        _joinedHost[Context.ConnectionId] = hostId;
        await Groups.AddToGroupAsync(Context.ConnectionId, Group(hostId));
        await AnnounceParticipants(hostId);
        // Nudge the host to push current state so the new joiner syncs immediately.
        await Clients.Group(Group(hostId)).SendAsync("JamJoined");
    }

    /// <summary>Host pushes current playback state to everyone else in the jam.</summary>
    public async Task Sync(object payload)
    {
        var me = CurrentUserId();
        if (me is null || !_sessions.ContainsKey(me.Value)) return;
        await Clients.OthersInGroup(Group(me.Value)).SendAsync("JamSync", payload);
    }

    public async Task LeaveSession(Guid hostId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, Group(hostId));
        if (_sessions.TryGetValue(hostId, out var set))
        {
            set.TryRemove(Context.ConnectionId, out _);
            await AnnounceParticipants(hostId);
        }
        _joinedHost.TryRemove(Context.ConnectionId, out _);
    }

    /// <summary>Host ends the jam for everyone.</summary>
    public async Task EndSession()
    {
        var me = CurrentUserId();
        if (me is null) return;
        await Clients.Group(Group(me.Value)).SendAsync("JamEnded");
        _sessions.TryRemove(me.Value, out _);
        _joinedHost.TryRemove(Context.ConnectionId, out _);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_joinedHost.TryRemove(Context.ConnectionId, out var hostId))
        {
            if (_sessions.TryGetValue(hostId, out var set))
            {
                set.TryRemove(Context.ConnectionId, out _);
                // If the host's own connection dropped and no one promoted, end it.
                if (hostId == CurrentUserId() && set.IsEmpty)
                    _sessions.TryRemove(hostId, out _);
                await AnnounceParticipants(hostId);
            }
        }
        await base.OnDisconnectedAsync(exception);
    }
}
