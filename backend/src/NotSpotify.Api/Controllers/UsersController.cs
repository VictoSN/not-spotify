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
[Route("users")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly NotificationService _notifications;

    public UsersController(AppDbContext db, MediaMapper mapper, NotificationService notifications)
    {
        _db = db;
        _mapper = mapper;
        _notifications = notifications;
    }

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    /// <summary>
    /// Helper — same graph traversal as FriendsController without depending on it directly.
    /// </summary>
    private IQueryable<Guid> FriendIdsOf(Guid userId) =>
        _db.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted &&
                        (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId);

    /// <summary>IDs the given user follows (one-way follow graph).</summary>
    private IQueryable<Guid> FollowingIdsOf(Guid userId) =>
        _db.UserFollows.Where(f => f.FollowerId == userId).Select(f => f.FolloweeId);

    // ── Search ───────────────────────────────────────────────────────────────

    /// <summary>
    /// GET /users/search?q=alice — case-insensitive user search.
    /// Results include mutual-friend count when the caller is authenticated.
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<UserSearchResultDto>>> Search(
        [FromQuery] string q,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return BadRequest(new { message = "Query must be at least 2 characters." });

        var like = $"%{q.Trim()}%";
        var me = CurrentUserId();

        var users = await _db.Users
            .Where(u => EF.Functions.ILike(u.Name, like) || EF.Functions.ILike(u.Email!, like))
            .Take(20)
            .ToListAsync(ct);

        // Exclude the caller from their own search results.
        if (me.HasValue)
            users = users.Where(u => u.Id != me.Value).ToList();

        // Compute mutual friends per result (0 when unauthenticated).
        var myFriendIds = me.HasValue
            ? await FriendIdsOf(me.Value).ToListAsync(ct)
            : new List<Guid>();

        var result = new List<UserSearchResultDto>(users.Count);
        foreach (var u in users)
        {
            int mutual = 0;
            if (me.HasValue && myFriendIds.Count > 0)
            {
                var theirFriendIds = await FriendIdsOf(u.Id).ToListAsync(ct);
                mutual = myFriendIds.Intersect(theirFriendIds).Count();
            }

            result.Add(new UserSearchResultDto(
                u.Id.ToString(),
                u.Name,
                u.Email ?? string.Empty,
                _mapper.ToRef(u).AvatarUrl,
                mutual,
                u.ArtistId.HasValue
            ));
        }

        return Ok(result);
    }

    // ── Public profile ───────────────────────────────────────────────────────

    /// <summary>
    /// GET /users/{userId} — public profile of any user.
    /// Includes mutual-friend count when the caller is authenticated.
    /// </summary>
    [HttpGet("{userId:guid}")]
    public async Task<ActionResult<PublicUserProfileDto>> GetProfile(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user is null)
            return NotFound();

        var me = CurrentUserId();
        int mutual = 0;
        bool? isFollowing = null;

        if (me.HasValue && me.Value != userId)
        {
            var myFriendIds = await FriendIdsOf(me.Value).ToListAsync(ct);
            var theirFriendIds = await FriendIdsOf(userId).ToListAsync(ct);
            mutual = myFriendIds.Intersect(theirFriendIds).Count();

            isFollowing = await _db.UserFollows
                .AnyAsync(f => f.FollowerId == me.Value && f.FolloweeId == userId, ct);
        }

        var followerCount = await _db.UserFollows.CountAsync(f => f.FolloweeId == userId, ct);
        var followingCount = await _db.UserFollows.CountAsync(f => f.FollowerId == userId, ct);

        return Ok(new PublicUserProfileDto(
            user.Id.ToString(),
            user.Name,
            _mapper.ToRef(user).AvatarUrl,
            user.CreatedAt,
            mutual,
            followerCount,
            followingCount,
            isFollowing
        ));
    }

    // ── Follows (asymmetric, one-way) ──────────────────────────────────────────

    /// <summary>POST /users/{userId}/follow — start following a user.</summary>
    [HttpPost("{userId:guid}/follow")]
    [Authorize]
    public async Task<IActionResult> Follow(Guid userId, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        if (me.Value == userId)
            return BadRequest(new { message = "You cannot follow yourself." });

        var target = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (target is null) return NotFound();

        var already = await _db.UserFollows
            .AnyAsync(f => f.FollowerId == me.Value && f.FolloweeId == userId, ct);
        if (already) return NoContent(); // idempotent

        _db.UserFollows.Add(new UserFollow { FollowerId = me.Value, FolloweeId = userId });
        await _db.SaveChangesAsync(ct);

        // Tell the followee someone followed them.
        var follower = await _db.Users.FindAsync(new object[] { me.Value }, ct);
        if (follower is not null)
            await _notifications.NotifyAsync(
                userId,
                "new_follower",
                $"{follower.Name} started following you",
                body: "View their profile.",
                linkUrl: $"/user/{me.Value}",
                imageUrl: _mapper.ToRef(follower).AvatarUrl,
                ct: ct);

        return NoContent();
    }

    /// <summary>DELETE /users/{userId}/follow — stop following a user.</summary>
    [HttpDelete("{userId:guid}/follow")]
    [Authorize]
    public async Task<IActionResult> Unfollow(Guid userId, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        var edge = await _db.UserFollows
            .FirstOrDefaultAsync(f => f.FollowerId == me.Value && f.FolloweeId == userId, ct);
        if (edge is null) return NoContent(); // idempotent

        _db.UserFollows.Remove(edge);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>GET /users/{userId}/followers — users who follow this user.</summary>
    [HttpGet("{userId:guid}/followers")]
    public async Task<ActionResult<IEnumerable<FollowUserDto>>> GetFollowers(Guid userId, CancellationToken ct = default)
    {
        var followerIds = await _db.UserFollows
            .Where(f => f.FolloweeId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => f.FollowerId)
            .ToListAsync(ct);
        return Ok(await BuildFollowList(followerIds, ct));
    }

    /// <summary>GET /users/{userId}/following — users this user follows.</summary>
    [HttpGet("{userId:guid}/following")]
    public async Task<ActionResult<IEnumerable<FollowUserDto>>> GetFollowing(Guid userId, CancellationToken ct = default)
    {
        var followeeIds = await _db.UserFollows
            .Where(f => f.FollowerId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => f.FolloweeId)
            .ToListAsync(ct);
        return Ok(await BuildFollowList(followeeIds, ct));
    }

    /// <summary>Maps a (already-ordered) set of user IDs to DTOs, flagging which the caller follows.</summary>
    private async Task<List<FollowUserDto>> BuildFollowList(List<Guid> orderedIds, CancellationToken ct)
    {
        if (orderedIds.Count == 0) return new List<FollowUserDto>();

        var me = CurrentUserId();
        var myFollowing = me.HasValue
            ? (await FollowingIdsOf(me.Value).Where(id => orderedIds.Contains(id)).ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();

        var users = (await _db.Users
            .Where(u => orderedIds.Contains(u.Id))
            .ToListAsync(ct))
            .ToDictionary(u => u.Id);

        // Preserve the incoming order (newest-first); Contains() in the query loses it.
        return orderedIds
            .Where(users.ContainsKey)
            .Select(id => users[id])
            .Select(u => new FollowUserDto(
                u.Id.ToString(),
                u.Name,
                _mapper.ToRef(u).AvatarUrl,
                u.ArtistId.HasValue,
                u.ArtistId?.ToString(),
                myFollowing.Contains(u.Id)))
            .ToList();
    }

    /// <summary>
    /// GET /users/{userId}/top-tracks — the user's most-played tracks in the last
    /// <paramref name="days"/> days (default 30), ranked by their own play count.
    /// Public listening signal — shown on profile pages.
    /// </summary>
    [HttpGet("{userId:guid}/top-tracks")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> GetTopTracks(
        Guid userId,
        [FromQuery] int days = 30,
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        days = Math.Clamp(days, 1, 365);
        limit = Math.Clamp(limit, 1, 50);
        var since = DateTime.UtcNow.AddDays(-days);

        var ranked = await _db.PlayHistories
            .Where(h => h.UserId == userId && h.PlayedAt >= since)
            .GroupBy(h => h.TrackId)
            .Select(g => new { TrackId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(limit)
            .ToListAsync(ct);

        var orderedIds = ranked.Select(x => x.TrackId).ToList();
        if (orderedIds.Count == 0) return Ok(Array.Empty<TrackDto>());

        var tracks = await _db.Tracks
            .Where(t => orderedIds.Contains(t.Id) && t.Status == "approved")
            .Include(t => t.Artist).Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .ToListAsync(ct);

        // Preserve play-count order.
        var byId = tracks.ToDictionary(t => t.Id);
        var ordered = orderedIds.Where(byId.ContainsKey).Select(id => byId[id]).ToList();
        return Ok(await _mapper.ToDtoListAsync(ordered, ct));
    }

    // ── Public playlists ─────────────────────────────────────────────────────

    /// <summary>
    /// GET /users/{userId}/playlists — playlists visible to the caller.
    ///   • Unauthenticated → only IsPublic playlists
    ///   • Authenticated non-friend → only IsPublic playlists
    ///   • Authenticated friend → IsPublic + friends-visibility playlists
    ///   • Own profile → all playlists
    /// </summary>
    [HttpGet("{userId:guid}/playlists")]
    public async Task<ActionResult<IEnumerable<PlaylistDto>>> GetPlaylists(Guid userId, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        var isSelf = me.HasValue && me.Value == userId;

        var isFriend = false;
        if (me.HasValue && !isSelf)
        {
            var myFriendIds = await FriendIdsOf(me.Value).ToListAsync(ct);
            isFriend = myFriendIds.Contains(userId);
        }

        // Build the visibility filter.
        // Must mirror the includes used by LoadFullPlaylist in PlaylistsController so
        // MediaMapper.ToDtoAsync can access pt.Track, pt.AddedByUser, etc. without
        // lazy loading (which would throw because we're outside a tracking context).
        var query = _db.Playlists
            .Where(p => p.OwnerId == userId)
            .Include(p => p.Owner)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Artist)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.Album)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.Track).ThenInclude(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .Include(p => p.PlaylistTracks).ThenInclude(pt => pt.AddedByUser);

        List<Playlist> playlists;
        if (isSelf)
        {
            // Owner sees all their playlists.
            playlists = await query.ToListAsync(ct);
        }
        else if (isFriend)
        {
            // Friends see public + friends-only.
            playlists = await query
                .Where(p => p.IsPublic || p.Visibility == "friends")
                .ToListAsync(ct);
        }
        else
        {
            // Strangers and guests see only public.
            playlists = await query
                .Where(p => p.IsPublic)
                .ToListAsync(ct);
        }

        var result = new List<PlaylistDto>(playlists.Count);
        foreach (var p in playlists)
            result.Add(await _mapper.ToDtoAsync(p, ct, isOwner: isSelf, isSaved: false));

        return Ok(result);
    }
}
