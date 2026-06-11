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

    public UsersController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
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

        if (me.HasValue && me.Value != userId)
        {
            var myFriendIds = await FriendIdsOf(me.Value).ToListAsync(ct);
            var theirFriendIds = await FriendIdsOf(userId).ToListAsync(ct);
            mutual = myFriendIds.Intersect(theirFriendIds).Count();
        }

        return Ok(new PublicUserProfileDto(
            user.Id.ToString(),
            user.Name,
            _mapper.ToRef(user).AvatarUrl,
            user.CreatedAt,
            mutual
        ));
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
