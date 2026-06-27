using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Artist follow/unfollow (ArtistsController): POST/DELETE /artists/{id}/follow
/// idempotency, the UserFollows edges behind them, and GET /artists/following.
/// </summary>
public class ArtistFollowTests
{
    private static ArtistsController New(AppDbContext db, Guid me) =>
        new ArtistsController(db, TestHelpers.NewMapper()).AsUser(me);

    private static ArtistsController NewGuest(AppDbContext db) =>
        new ArtistsController(db, TestHelpers.NewMapper()).AsGuest();

    /// <summary>
    /// Creates a user (id, name) that owns an artist (the user's ArtistId = artist.Id)
    /// and another user who will be the follower.
    /// Returns (ownerUser, artist, followerUser).
    /// </summary>
    private static async Task<(ApplicationUser, Artist, ApplicationUser)> SeedArtistWithOwner(
        AppDbContext db,
        string artistName = "Test Artist")
    {
        var artist = new Artist { Id = Guid.NewGuid(), Name = artistName };
        var owner = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Name = $"{artistName} Owner",
            UserName = $"{artistName}-owner@test",
            Email = $"{artistName}-owner@test",
            ArtistId = artist.Id,  // this user "is" the artist
        };
        var follower = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Name = "Follower",
            UserName = "follower@test",
            Email = "follower@test",
        };
        db.Artists.Add(artist);
        db.Users.AddRange(owner, follower);
        await db.SaveChangesAsync();
        return (owner, artist, follower);
    }

    // ── Guest / unauthorised ────────────────────────────────────────────────

    [Fact]
    public async Task Follow_AsGuest_ReturnsUnauthorized()
    {
        await using var db = TestHelpers.NewDb();
        var (_, artist, _) = await SeedArtistWithOwner(db);
        var result = await NewGuest(db).Follow(artist.Id);
        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task Unfollow_AsGuest_ReturnsUnauthorized()
    {
        await using var db = TestHelpers.NewDb();
        var (_, artist, _) = await SeedArtistWithOwner(db);
        var result = await NewGuest(db).Unfollow(artist.Id);
        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task Following_AsGuest_ReturnsUnauthorized()
    {
        await using var db = TestHelpers.NewDb();
        var result = await NewGuest(db).Following();
        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    // ── Not found ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Follow_NonExistentArtist_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();

        var result = await New(db, me).Follow(Guid.NewGuid());
        Assert.IsType<NotFoundResult>(result);
    }

    // ── No-op when artist has no owner user ───────────────────────────────────

    [Fact]
    public async Task Follow_ArtistWithNoOwner_ReturnsNoContent_AndCreatesNoEdges()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        var artist = new Artist { Id = Guid.NewGuid(), Name = "Indie Artist" };
        db.Artists.Add(artist);
        await db.SaveChangesAsync();

        var result = await New(db, me).Follow(artist.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.UserFollows);
    }

    // ── Follow / unfollow idempotency ────────────────────────────────────────

    [Fact]
    public async Task Follow_New_PersistsEdge_AndIsIdempotent()
    {
        await using var db = TestHelpers.NewDb();
        var (owner, artist, follower) = await SeedArtistWithOwner(db);

        // First follow: creates a UserFollows edge from follower → owner.
        var first = await New(db, follower.Id).Follow(artist.Id);
        Assert.IsType<NoContentResult>(first);
        Assert.Single(db.UserFollows);

        // Second follow: idempotent — no extra row.
        var second = await New(db, follower.Id).Follow(artist.Id);
        Assert.IsType<NoContentResult>(second);
        Assert.Single(db.UserFollows);
    }

    [Fact]
    public async Task Unfollow_RemovesEdge_AndIsIdempotentWhenNotFollowing()
    {
        await using var db = TestHelpers.NewDb();
        var (owner, artist, follower) = await SeedArtistWithOwner(db);

        // Follow first so there is an edge to remove.
        await New(db, follower.Id).Follow(artist.Id);
        Assert.Single(db.UserFollows);

        // Unfollow removes it.
        var first = await New(db, follower.Id).Unfollow(artist.Id);
        Assert.IsType<NoContentResult>(first);
        Assert.Empty(db.UserFollows);

        // Unfollow again: idempotent (already gone).
        var again = await New(db, follower.Id).Unfollow(artist.Id);
        Assert.IsType<NoContentResult>(again);
    }

    // ── GET /artists/following ───────────────────────────────────────────────

    [Fact]
    public async Task Following_ReturnsOnlyFollowedArtists()
    {
        await using var db = TestHelpers.NewDb();
        var (ownerA, artistA, follower) = await SeedArtistWithOwner(db, "Artist A");

        // Create a second artist+owner that the follower does NOT follow.
        var artistB = new Artist { Id = Guid.NewGuid(), Name = "Artist B" };
        var ownerB = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Name = "Artist B Owner",
            UserName = "artistb-owner@test",
            Email = "artistb-owner@test",
            ArtistId = artistB.Id,
        };
        db.Artists.Add(artistB);
        db.Users.Add(ownerB);
        await db.SaveChangesAsync();

        // Follow artist A only.
        await New(db, follower.Id).Follow(artistA.Id);

        var result = await New(db, follower.Id).Following();
        var list = Assert.IsAssignableFrom<IEnumerable<ArtistDto>>(
            Assert.IsType<OkObjectResult>(result.Result).Value);

        var ids = list.Select(a => a.Id.ToString()).ToHashSet();
        Assert.Contains(artistA.Id.ToString(), ids);
        Assert.DoesNotContain(artistB.Id.ToString(), ids);
    }

    [Fact]
    public async Task Following_Empty_ReturnsEmptyArray()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();

        var result = await New(db, me).Following();
        var list = Assert.IsAssignableFrom<IEnumerable<ArtistDto>>(
            Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Empty(list);
    }
}
