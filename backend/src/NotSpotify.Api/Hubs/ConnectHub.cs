using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace NotSpotify.Api.Hubs;

/// <summary>
/// "Connect" hub — Spotify-Connect-style single-account, multi-device playback.
/// Every tab/app on an account registers a device; the hub tracks the set of
/// devices per user and which one is <b>active</b> (the only device that should
/// produce audio). Non-active devices are silent remote controls / mirrors.
/// Thin relay + registry, all in-memory (single-server / dev — swap the two
/// static dictionaries for a backplane, e.g. Redis, to scale out).
///
/// Client → server: RegisterDevice(deviceId, kind, name), TransferPlayback(deviceId),
///                   ReportState(state), SendCommand(command, payload)
/// Server → client: "ConnectDevices" (devices[], activeDeviceId) — the roster,
///                   "ConnectState"   (state)   — active device → mirrors,
///                   "ConnectCommand" (command, payload) — a mirror → active device
/// </summary>
[Authorize]
public class ConnectHub : Hub
{
    private sealed record DeviceInfo(string DeviceId, string Kind, string Name);

    // userId → (connectionId → device). One live connection ≈ one device (tab/app).
    private static readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, DeviceInfo>> _devices = new();
    // userId → the active device id (the only one allowed to play audio).
    private static readonly ConcurrentDictionary<Guid, string> _active = new();

    private Guid? CurrentUserId()
    {
        var id = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? Context.User?.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    private static string Group(Guid userId) => $"connect-{userId}";

    private async Task BroadcastDevices(Guid userId)
    {
        var map = _devices.TryGetValue(userId, out var d)
            ? d
            : new ConcurrentDictionary<string, DeviceInfo>();
        _active.TryGetValue(userId, out var activeId);

        // One device may briefly hold two connections while reconnecting; dedupe
        // by device id and project to the wire shape.
        var devices = map.Values
            .GroupBy(v => v.DeviceId)
            .Select(g => g.First())
            .Select(v => new
            {
                deviceId = v.DeviceId,
                kind = v.Kind,
                name = v.Name,
                isActive = v.DeviceId == activeId,
            })
            .ToList();

        await Clients.Group(Group(userId)).SendAsync("ConnectDevices", devices, activeId);
    }

    public override async Task OnConnectedAsync()
    {
        var userId = CurrentUserId();
        if (userId is not null)
            await Groups.AddToGroupAsync(Context.ConnectionId, Group(userId.Value));
        await base.OnConnectedAsync();
    }

    /// <summary>Announce this connection as a device on the account.</summary>
    public async Task RegisterDevice(string deviceId, string kind, string name)
    {
        var userId = CurrentUserId();
        if (userId is null || string.IsNullOrWhiteSpace(deviceId)) return;

        var map = _devices.GetOrAdd(userId.Value, _ => new ConcurrentDictionary<string, DeviceInfo>());
        map[Context.ConnectionId] = new DeviceInfo(
            deviceId,
            string.IsNullOrWhiteSpace(kind) ? "web" : kind,
            string.IsNullOrWhiteSpace(name) ? "Device" : name);

        // The first device on the account becomes active by default; later devices
        // join as remotes until the user explicitly transfers to them.
        _active.GetOrAdd(userId.Value, deviceId);

        await BroadcastDevices(userId.Value);
    }

    /// <summary>Make <paramref name="toDeviceId"/> the active (audio) device.</summary>
    public async Task TransferPlayback(string toDeviceId)
    {
        var userId = CurrentUserId();
        if (userId is null || string.IsNullOrWhiteSpace(toDeviceId)) return;
        if (!_devices.TryGetValue(userId.Value, out var map)) return;
        if (!map.Values.Any(v => v.DeviceId == toDeviceId)) return; // unknown device

        _active[userId.Value] = toDeviceId;
        await BroadcastDevices(userId.Value);
    }

    /// <summary>Active device pushes its playback state to the mirrors.</summary>
    public async Task ReportState(object state)
    {
        var userId = CurrentUserId();
        if (userId is null) return;
        if (!_devices.TryGetValue(userId.Value, out var map)) return;
        if (!map.TryGetValue(Context.ConnectionId, out var me)) return;
        // Only the active device's state is authoritative.
        if (!_active.TryGetValue(userId.Value, out var activeId) || activeId != me.DeviceId) return;

        await Clients.OthersInGroup(Group(userId.Value)).SendAsync("ConnectState", state);
    }

    /// <summary>A remote device asks the active device to do something.</summary>
    public async Task SendCommand(string command, object? payload)
    {
        var userId = CurrentUserId();
        if (userId is null) return;
        if (!_devices.TryGetValue(userId.Value, out var map)) return;
        if (!_active.TryGetValue(userId.Value, out var activeId)) return;

        var targets = map.Where(kv => kv.Value.DeviceId == activeId).Select(kv => kv.Key).ToList();
        if (targets.Count == 0) return;
        await Clients.Clients(targets).SendAsync("ConnectCommand", command, payload);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = CurrentUserId();
        if (userId is not null && _devices.TryGetValue(userId.Value, out var map))
        {
            map.TryRemove(Context.ConnectionId, out var gone);

            if (map.IsEmpty)
            {
                _devices.TryRemove(userId.Value, out _);
                _active.TryRemove(userId.Value, out _);
            }
            else
            {
                // If the active device's last connection dropped, promote another so
                // playback control isn't orphaned on the account.
                if (gone is not null
                    && _active.TryGetValue(userId.Value, out var activeId)
                    && activeId == gone.DeviceId
                    && !map.Values.Any(v => v.DeviceId == gone.DeviceId))
                {
                    _active[userId.Value] = map.Values.First().DeviceId;
                }
                await BroadcastDevices(userId.Value);
            }
        }
        await base.OnDisconnectedAsync(exception);
    }
}
