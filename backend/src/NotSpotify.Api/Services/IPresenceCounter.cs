using System.Collections.Concurrent;
using StackExchange.Redis;

namespace NotSpotify.Api.Services;

/// <summary>
/// Tracks how many live SignalR connections each user currently holds, so the
/// "first tab in → online, last tab out → offline" transition fires exactly once.
///
/// The in-memory implementation is correct for a single backend process. When the
/// app runs as multiple instances (e.g. two machines sharing one RDS + the Redis
/// SignalR backplane), the count must be shared too — otherwise each instance
/// counts only its own connections and presence flickers. The Redis implementation
/// keeps one authoritative counter per user across every instance.
/// </summary>
public interface IPresenceCounter
{
    /// <summary>Record a new connection for the user; returns the resulting total.</summary>
    Task<int> IncrementAsync(Guid userId);

    /// <summary>Record a dropped connection for the user; returns the resulting total (never below 0).</summary>
    Task<int> DecrementAsync(Guid userId);
}

/// <summary>Single-process counter — used when no Redis backplane is configured.</summary>
public sealed class InMemoryPresenceCounter : IPresenceCounter
{
    private readonly ConcurrentDictionary<Guid, int> _counts = new();

    public Task<int> IncrementAsync(Guid userId)
        => Task.FromResult(_counts.AddOrUpdate(userId, 1, (_, c) => c + 1));

    public Task<int> DecrementAsync(Guid userId)
    {
        var next = _counts.AddOrUpdate(userId, 0, (_, c) => Math.Max(0, c - 1));
        if (next == 0) _counts.TryRemove(userId, out _);
        return Task.FromResult(next);
    }
}

/// <summary>
/// Cross-instance counter backed by Redis (atomic INCR/DECR). Shares the same
/// Redis the SignalR backplane uses, so presence is consistent across instances.
/// </summary>
public sealed class RedisPresenceCounter : IPresenceCounter
{
    private readonly IConnectionMultiplexer _redis;

    public RedisPresenceCounter(IConnectionMultiplexer redis) => _redis = redis;

    private static RedisKey Key(Guid userId) => $"presence:count:{userId}";

    public async Task<int> IncrementAsync(Guid userId)
    {
        var count = await _redis.GetDatabase().StringIncrementAsync(Key(userId));
        return (int)count;
    }

    public async Task<int> DecrementAsync(Guid userId)
    {
        var db = _redis.GetDatabase();
        var count = await db.StringDecrementAsync(Key(userId));
        if (count <= 0)
        {
            // Clamp at zero and drop the key so it doesn't linger as "-1".
            await db.KeyDeleteAsync(Key(userId));
            return 0;
        }
        return (int)count;
    }
}
