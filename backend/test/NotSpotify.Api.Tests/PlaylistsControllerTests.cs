using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using Xunit;

namespace NotSpotify.Api.Tests;

public class PlaylistsControllerTests
{
    private static PlaylistsController Controller(NotSpotify.Api.Data.AppDbContext db) =>
        new(db, TestHelpers.NewMapper(), TestHelpers.NewStorage(), TestHelpers.NewAudioDownloads());

    // ── Visibility / access-control matrix on GET /playlists/{id} ──────────────

    [Fact]
    public async Task Get_PublicPlaylist_AsGuest_Returns200()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var p = db.AddPlaylist(owner, "public");
        await db.SaveChangesAsync();

        var action = await Controller(db).AsGuest().Get(p.Id);

        Assert.IsType<OkObjectResult>(action.Result);
    }

    [Fact]
    public async Task Get_PrivatePlaylist_AsGuest_Returns403()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var p = db.AddPlaylist(owner, "private");
        await db.SaveChangesAsync();

        var action = await Controller(db).AsGuest().Get(p.Id);

        var sc = Assert.IsType<StatusCodeResult>(action.Result);
        Assert.Equal(403, sc.StatusCode);
    }

    [Fact]
    public async Task Get_PrivatePlaylist_AsStranger_Returns403()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        db.AddUser(owner, "owner");
        db.AddUser(stranger, "stranger");
        var p = db.AddPlaylist(owner, "private");
        await db.SaveChangesAsync();

        var action = await Controller(db).AsUser(stranger).Get(p.Id);

        var sc = Assert.IsType<StatusCodeResult>(action.Result);
        Assert.Equal(403, sc.StatusCode);
    }

    [Fact]
    public async Task Get_PrivatePlaylist_AsOwner_Returns200()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var p = db.AddPlaylist(owner, "private");
        await db.SaveChangesAsync();

        var action = await Controller(db).AsUser(owner).Get(p.Id);

        Assert.IsType<OkObjectResult>(action.Result);
    }

    [Fact]
    public async Task Get_FriendsPlaylist_AsNonFriend_Returns403()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        db.AddUser(owner, "owner");
        db.AddUser(stranger, "stranger");
        var p = db.AddPlaylist(owner, "friends");
        await db.SaveChangesAsync();

        var action = await Controller(db).AsUser(stranger).Get(p.Id);

        var sc = Assert.IsType<StatusCodeResult>(action.Result);
        Assert.Equal(403, sc.StatusCode);
    }

    [Fact]
    public async Task Get_FriendsPlaylist_AsAcceptedFriend_Returns200()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var friend = Guid.NewGuid();
        db.AddUser(owner, "owner");
        db.AddUser(friend, "friend");
        db.AddFriendship(owner, friend);
        var p = db.AddPlaylist(owner, "friends");
        await db.SaveChangesAsync();

        var action = await Controller(db).AsUser(friend).Get(p.Id);

        Assert.IsType<OkObjectResult>(action.Result);
    }

    [Fact]
    public async Task Get_MissingPlaylist_Returns404()
    {
        await using var db = TestHelpers.NewDb();
        var action = await Controller(db).AsGuest().Get(Guid.NewGuid());
        Assert.IsType<NotFoundResult>(action.Result);
    }

    // ── Premium gate on the ZIP download ───────────────────────────────────────

    [Fact]
    public async Task DownloadZip_FreeUser_IsForbidden()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "free"); // Plan defaults to "free"
        var p = db.AddPlaylist(me, "public");
        await db.SaveChangesAsync();

        var result = await Controller(db).AsUser(me).DownloadZip(p.Id);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, obj.StatusCode);
    }

    [Fact]
    public async Task DownloadZip_PremiumUser_IsAllowedThroughTheGate()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var user = db.AddUser(me, "premium");
        user.Plan = "premium";
        var p = db.AddPlaylist(me, "public"); // no tracks → empty zip, but the gate is what we assert
        await db.SaveChangesAsync();

        var result = await Controller(db).AsUser(me).DownloadZip(p.Id);

        // Premium passes the gate: anything other than the 403 ObjectResult means allowed.
        Assert.IsType<FileContentResult>(result);
    }
}
