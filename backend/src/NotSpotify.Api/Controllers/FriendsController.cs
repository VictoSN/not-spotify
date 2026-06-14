using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("friends")]
[Authorize]
public class FriendsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly NotificationService _notifications;

    public FriendsController(AppDbContext db, MediaMapper mapper, NotificationService notifications)
    {
        _db = db;
        _mapper = mapper;
        _notifications = notifications;
    }

    private Guid CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : throw new UnauthorizedAccessException();
    }

    /// <summary>
    /// Returns an IQueryable of the IDs of all accepted friends of a given user.
    /// This is the core graph adjacency query — reused for mutual friends and suggestions.
    /// </summary>
    private IQueryable<Guid> FriendIdsOf(Guid userId) =>
        _db.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted &&
                        (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId);

    // ── List accepted friends ────────────────────────────────────────────────

    /// <summary>GET /friends — accepted friends with mutual-friend count relative to me.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<FriendDto>>> GetFriends(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        var myFriendIds = await FriendIdsOf(me).ToListAsync(ct);

        var friends = await _db.Users
            .Where(u => myFriendIds.Contains(u.Id))
            .ToListAsync(ct);

        // For each friend, count how many of their friends are also my friends (mutual count).
        var result = new List<FriendDto>(friends.Count);
        foreach (var f in friends)
        {
            var theirFriendIds = await FriendIdsOf(f.Id).ToListAsync(ct);
            var mutualCount = myFriendIds.Intersect(theirFriendIds).Count(id => id != f.Id);
            result.Add(new FriendDto(
                f.Id.ToString(),
                f.Name,
                _mapper.ToRef(f).AvatarUrl,
                mutualCount
            ));
        }

        return Ok(result);
    }

    // ── Friend requests ──────────────────────────────────────────────────────

    /// <summary>GET /friends/requests — incoming pending requests addressed to me.</summary>
    [HttpGet("requests")]
    public async Task<ActionResult<IEnumerable<FriendRequestDto>>> GetRequests(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        var requests = await _db.Friendships
            .Where(f => f.AddresseeId == me && f.Status == FriendshipStatus.Pending)
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync(ct);

        return Ok(requests.Select(f => new FriendRequestDto(
            f.Id.ToString(),
            new UserRefDto(f.Requester.Id, f.Requester.Name, _mapper.ToRef(f.Requester).AvatarUrl),
            new UserRefDto(f.Addressee.Id, f.Addressee.Name, _mapper.ToRef(f.Addressee).AvatarUrl),
            f.Status.ToString().ToLowerInvariant(),
            f.CreatedAt
        )));
    }

    /// <summary>POST /friends/requests — send a friend request.</summary>
    [HttpPost("requests")]
    public async Task<IActionResult> SendRequest([FromBody] SendFriendRequestDto dto, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (dto.UserId == me)
            return BadRequest(new { message = "You cannot add yourself as a friend." });

        // Check for any existing relationship in either direction.
        var existing = await _db.Friendships
            .FirstOrDefaultAsync(f =>
                (f.RequesterId == me && f.AddresseeId == dto.UserId) ||
                (f.RequesterId == dto.UserId && f.AddresseeId == me),
                ct);

        if (existing is not null)
        {
            if (existing.Status == FriendshipStatus.Accepted)
                return Conflict(new { message = "Already friends." });
            if (existing.Status == FriendshipStatus.Pending)
                return Conflict(new { message = "Friend request already pending." });

            // Declined — allow re-sending by resetting to pending.
            existing.Status = FriendshipStatus.Pending;
            existing.RequesterId = me;
            existing.AddresseeId = dto.UserId;
            existing.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await NotifyFriendRequest(me, dto.UserId, ct);
            return NoContent();
        }

        _db.Friendships.Add(new Friendship
        {
            RequesterId = me,
            AddresseeId = dto.UserId,
        });
        await _db.SaveChangesAsync(ct);
        await NotifyFriendRequest(me, dto.UserId, ct);
        return NoContent();
    }

    /// <summary>Tells the addressee that <paramref name="requesterId"/> sent them a friend request.</summary>
    private async Task NotifyFriendRequest(Guid requesterId, Guid addresseeId, CancellationToken ct)
    {
        var requester = await _db.Users.FindAsync(new object[] { requesterId }, ct);
        if (requester is null) return;
        await _notifications.NotifyAsync(
            addresseeId,
            "friend_request",
            $"{requester.Name} sent you a friend request",
            body: "Open Friends to accept or decline.",
            linkUrl: $"/user/{requesterId}",
            imageUrl: _mapper.ToRef(requester).AvatarUrl,
            ct: ct);
    }

    /// <summary>PATCH /friends/requests/{id} — accept or decline a pending request.</summary>
    [HttpPatch("requests/{id:guid}")]
    public async Task<IActionResult> RespondToRequest(Guid id, [FromBody] RespondToRequestDto dto, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        var friendship = await _db.Friendships
            .FirstOrDefaultAsync(f => f.Id == id && f.AddresseeId == me && f.Status == FriendshipStatus.Pending, ct);

        if (friendship is null)
            return NotFound();

        friendship.Status = dto.Action.Equals("accept", StringComparison.OrdinalIgnoreCase)
            ? FriendshipStatus.Accepted
            : FriendshipStatus.Declined;
        friendship.UpdatedAt = DateTime.UtcNow;

        // Update the sender's LastSeenAt on accept so they show as "online" when the new friend sees them.
        if (friendship.Status == FriendshipStatus.Accepted)
        {
            var requester = await _db.Users.FindAsync(new object[] { friendship.RequesterId }, ct);
            if (requester is not null)
                requester.LastSeenAt ??= DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        // Tell the original requester their request was accepted.
        if (friendship.Status == FriendshipStatus.Accepted)
        {
            var accepter = await _db.Users.FindAsync(new object[] { me }, ct);
            if (accepter is not null)
                await _notifications.NotifyAsync(
                    friendship.RequesterId,
                    "friend_accepted",
                    $"{accepter.Name} accepted your friend request",
                    body: "You're now friends.",
                    linkUrl: $"/user/{me}",
                    imageUrl: _mapper.ToRef(accepter).AvatarUrl,
                    ct: ct);
        }

        return NoContent();
    }

    /// <summary>DELETE /friends/{userId} — unfriend.</summary>
    [HttpDelete("{userId:guid}")]
    public async Task<IActionResult> Unfriend(Guid userId, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        var friendship = await _db.Friendships
            .FirstOrDefaultAsync(f =>
                f.Status == FriendshipStatus.Accepted &&
                ((f.RequesterId == me && f.AddresseeId == userId) ||
                 (f.RequesterId == userId && f.AddresseeId == me)),
                ct);

        if (friendship is null)
            return NotFound();

        _db.Friendships.Remove(friendship);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Graph queries ────────────────────────────────────────────────────────

    /// <summary>
    /// GET /friends/mutual/{userId} — mutual friends between me and another user.
    /// Returns the intersection of both friend sets.
    /// </summary>
    [HttpGet("mutual/{userId:guid}")]
    public async Task<ActionResult<IEnumerable<MutualFriendDto>>> GetMutualFriends(Guid userId, CancellationToken ct = default)
    {
        var me = CurrentUserId();

        var myFriendIds = await FriendIdsOf(me).ToListAsync(ct);
        var theirFriendIds = await FriendIdsOf(userId).ToListAsync(ct);

        // Intersection of the two adjacency lists.
        var mutualIds = myFriendIds.Intersect(theirFriendIds).ToList();

        var mutuals = await _db.Users
            .Where(u => mutualIds.Contains(u.Id))
            .ToListAsync(ct);

        return Ok(mutuals.Select(u => new MutualFriendDto(
            u.Id.ToString(),
            u.Name,
            _mapper.ToRef(u).AvatarUrl
        )));
    }

    /// <summary>
    /// GET /friends/suggestions — 2nd-degree connections ("people you may know").
    /// Returns friends-of-friends not yet connected to me, ranked by mutual-friend count.
    /// </summary>
    [HttpGet("suggestions")]
    public async Task<ActionResult<IEnumerable<FriendSuggestionDto>>> GetSuggestions(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        var myFriendIds = await FriendIdsOf(me).ToListAsync(ct);

        // All pending request IDs (either direction) — exclude them from suggestions too.
        var pendingIds = await _db.Friendships
            .Where(f => f.Status == FriendshipStatus.Pending &&
                        (f.RequesterId == me || f.AddresseeId == me))
            .Select(f => f.RequesterId == me ? f.AddresseeId : f.RequesterId)
            .ToListAsync(ct);

        var excluded = myFriendIds.Concat(pendingIds).Append(me).ToHashSet();

        // For every friend, get their friends that I don't already know.
        // Flatten and count how many of MY friends each candidate shares.
        var candidateScores = new Dictionary<Guid, int>();

        foreach (var friendId in myFriendIds)
        {
            var foafIds = await FriendIdsOf(friendId)
                .Where(id => !excluded.Contains(id))
                .ToListAsync(ct);

            foreach (var candidate in foafIds)
            {
                candidateScores.TryGetValue(candidate, out var current);
                candidateScores[candidate] = current + 1;
            }
        }

        if (candidateScores.Count == 0)
            return Ok(Array.Empty<FriendSuggestionDto>());

        var topCandidateIds = candidateScores
            .OrderByDescending(kv => kv.Value)
            .Take(10)
            .Select(kv => kv.Key)
            .ToList();

        var users = await _db.Users
            .Where(u => topCandidateIds.Contains(u.Id))
            .ToListAsync(ct);

        var result = users
            .Select(u => new FriendSuggestionDto(
                u.Id.ToString(),
                u.Name,
                _mapper.ToRef(u).AvatarUrl,
                candidateScores.TryGetValue(u.Id, out var score) ? score : 0
            ))
            .OrderByDescending(s => s.MutualFriendsCount)
            .ToList();

        return Ok(result);
    }

    // ── Activity (online + now-playing) ──────────────────────────────────────

    /// <summary>
    /// GET /friends/activity — online status and currently-playing track per friend.
    /// Also updates the caller's LastSeenAt (serves as a heartbeat).
    /// </summary>
    [HttpGet("activity")]
    public async Task<ActionResult<IEnumerable<FriendActivityDto>>> GetActivity(CancellationToken ct = default)
    {
        var me = CurrentUserId();

        // Heartbeat: update caller's LastSeenAt.
        var caller = await _db.Users.FindAsync(new object[] { me }, ct);
        if (caller is not null)
        {
            caller.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        var myFriendIds = await FriendIdsOf(me).ToListAsync(ct);
        if (myFriendIds.Count == 0)
            return Ok(Array.Empty<FriendActivityDto>());

        // 1-minute window: frontend sends a heartbeat every 10 s when the tab is
        // visible, so a 1-minute gap means the tab was genuinely closed/hidden.
        var onlineThreshold = DateTime.UtcNow.AddMinutes(-1);
        // Playback heartbeats arrive every 30 s while a track plays, so a session
        // touched within 90 s means the friend is actively listening right now.
        var listeningThreshold = DateTime.UtcNow.AddSeconds(-90);
        // "Recently played" history shown up to a week back.
        var historyThreshold = DateTime.UtcNow.AddDays(-7);

        // Load friend users (for online status).
        var friendUsers = await _db.Users
            .Where(u => myFriendIds.Contains(u.Id))
            .ToListAsync(ct);

        // Live playback sessions — one row per user, refreshed by playback-heartbeat.
        var liveSessions = await _db.ActivePlaybackSessions
            .Where(s => myFriendIds.Contains(s.UserId) && s.LastSeenAt > listeningThreshold)
            .ToListAsync(ct);
        var liveByUser = liveSessions.ToDictionary(s => s.UserId);

        // Latest history row per friend = the play with no later play by the same user.
        var latestPlays = await _db.PlayHistories
            .Where(ph => myFriendIds.Contains(ph.UserId) && ph.PlayedAt > historyThreshold)
            .Where(ph => !_db.PlayHistories.Any(p2 => p2.UserId == ph.UserId && p2.PlayedAt > ph.PlayedAt))
            .ToListAsync(ct);
        var latestPlayByUser = latestPlays
            .GroupBy(ph => ph.UserId) // PlayedAt ties can return two rows — keep one
            .ToDictionary(g => g.Key, g => g.First());

        // One batched track load for both live + recent activity.
        var trackIds = liveByUser.Values.Select(s => s.TrackId)
            .Concat(latestPlayByUser.Values.Select(ph => ph.TrackId))
            .Distinct()
            .ToList();
        var trackById = await _db.Tracks
            .Where(t => trackIds.Contains(t.Id))
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres)
                .ThenInclude(tg => tg.Genre)
            .ToDictionaryAsync(t => t.Id, ct);

        var result = new List<FriendActivityDto>(friendUsers.Count);
        foreach (var f in friendUsers)
        {
            var isOnline = f.LastSeenAt.HasValue && f.LastSeenAt.Value > onlineThreshold;
            TrackDto? trackDto = null;
            DateTime? playedAt = null;
            var isListeningNow = false;

            if (liveByUser.TryGetValue(f.Id, out var session) &&
                trackById.TryGetValue(session.TrackId, out var liveTrack))
            {
                trackDto = await _mapper.ToDtoAsync(liveTrack, ct);
                playedAt = session.LastSeenAt;
                isListeningNow = true;
            }
            else if (latestPlayByUser.TryGetValue(f.Id, out var ph) &&
                     trackById.TryGetValue(ph.TrackId, out var recentTrack))
            {
                trackDto = await _mapper.ToDtoAsync(recentTrack, ct);
                playedAt = ph.PlayedAt;
            }

            result.Add(new FriendActivityDto(f.Id.ToString(), isOnline, trackDto, playedAt, isListeningNow));
        }

        return Ok(result);
    }

    // ── Heartbeat ─────────────────────────────────────────────────────────────

    /// <summary>POST /me/heartbeat — update LastSeenAt without full activity fetch.</summary>
    [HttpPost("/me/heartbeat")]
    public async Task<IActionResult> Heartbeat(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        var user = await _db.Users.FindAsync(new object[] { me }, ct);
        if (user is not null)
        {
            user.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        return NoContent();
    }
}
