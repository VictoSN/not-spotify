using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// The friend graph beyond basic requests: mutual-friend intersection,
/// 2nd-degree suggestions (ranked, exclusions), and the listening "Blend".
/// </summary>
public class FriendsGraphTests
{
    private static FriendsController New(AppDbContext db, Guid me) =>
        new FriendsController(db, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db)).AsUser(me);

    [Fact]
    public async Task GetMutualFriends_ReturnsIntersectionOfFriendSets()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        var shared = Guid.NewGuid();
        var mineOnly = Guid.NewGuid();
        var theirsOnly = Guid.NewGuid();
        db.AddUser(shared, "shared");
        db.AddFriendship(me, shared);
        db.AddFriendship(other, shared);
        db.AddFriendship(me, mineOnly);
        db.AddFriendship(other, theirsOnly);
        await db.SaveChangesAsync();

        var result = await New(db, me).GetMutualFriends(other);

        var mutuals = Assert.IsAssignableFrom<IEnumerable<MutualFriendDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(shared.ToString(), Assert.Single(mutuals).UserId);
    }

    [Fact]
    public async Task GetSuggestions_RanksFriendsOfFriends_ExcludingPendingAndExisting()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var friendA = Guid.NewGuid();
        var friendB = Guid.NewGuid();
        var candidate = Guid.NewGuid();  // friend-of-both → score 2
        var pending = Guid.NewGuid();     // foaf but I have a pending request → excluded
        db.AddUser(candidate, "candidate");
        db.AddUser(pending, "pending");

        db.AddFriendship(me, friendA);
        db.AddFriendship(me, friendB);
        db.AddFriendship(friendA, candidate);
        db.AddFriendship(friendB, candidate);
        db.AddFriendship(friendA, pending);
        db.Friendships.Add(new Friendship { RequesterId = me, AddresseeId = pending, Status = FriendshipStatus.Pending });
        await db.SaveChangesAsync();

        var result = await New(db, me).GetSuggestions();

        var suggestions = Assert.IsAssignableFrom<IEnumerable<FriendSuggestionDto>>(Assert.IsType<OkObjectResult>(result.Result).Value).ToList();
        var top = Assert.Single(suggestions);
        Assert.Equal(candidate.ToString(), top.Id);
        Assert.Equal(2, top.MutualFriendsCount);
        Assert.DoesNotContain(suggestions, s => s.Id == pending.ToString());
    }

    [Fact]
    public async Task Blend_WithSelf_BadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();

        var result = await New(db, me).Blend(me);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Blend_WithNonFriend_Forbidden()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var stranger = Guid.NewGuid();

        var result = await New(db, me).Blend(stranger);

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, obj.StatusCode);
    }

    [Fact]
    public async Task Blend_WithFriend_PutsSharedFavouritesFirst()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var friend = Guid.NewGuid();
        db.AddFriendship(me, friend);

        var shared = db.SeedTrack("Shared");
        var mineOnly = db.SeedTrack("Mine");
        var theirsOnly = db.SeedTrack("Theirs");
        var now = DateTime.UtcNow;
        void Play(Guid uid, Guid trackId) =>
            db.PlayHistories.Add(new PlayHistory { Id = Guid.NewGuid(), UserId = uid, TrackId = trackId, PlayedAt = now });
        Play(me, shared.Id);
        Play(me, mineOnly.Id);
        Play(friend, shared.Id);
        Play(friend, theirsOnly.Id);
        await db.SaveChangesAsync();

        var result = await New(db, me).Blend(friend);

        var tracks = Assert.IsAssignableFrom<IEnumerable<TrackDto>>(Assert.IsType<OkObjectResult>(result.Result).Value).ToList();
        Assert.Equal(shared.Id, tracks[0].Id); // shared favourite leads
        Assert.Contains(tracks, t => t.Id == mineOnly.Id);
        Assert.Contains(tracks, t => t.Id == theirsOnly.Id);
    }
}
