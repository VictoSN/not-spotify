using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// <see cref="NotificationService"/> producers over the InMemory db + a no-op
/// SignalR hub (the proxy mock verifies a live push was attempted). All producers
/// are best-effort — they create rows and nudge the recipient's group.
/// </summary>
public class NotificationServiceTests
{
    private static (NotificationService svc, Mock<IClientProxy> proxy) NewService(NotSpotify.Api.Data.AppDbContext db)
    {
        var (hub, proxy) = TestHelpers.NewHub();
        return (new NotificationService(db, hub, NullLogger<NotificationService>.Instance), proxy);
    }

    [Fact]
    public async Task NotifyAsync_CreatesRow_AndPushesToUserGroup()
    {
        await using var db = TestHelpers.NewDb();
        var uid = Guid.NewGuid();
        var (svc, proxy) = NewService(db);

        await svc.NotifyAsync(uid, "admin", "Hello", body: "world", linkUrl: "/x");

        var row = Assert.Single(db.Notifications);
        Assert.Equal(uid, row.UserId);
        Assert.Equal("admin", row.Type);
        Assert.Equal("Hello", row.Title);
        proxy.Verify(p => p.SendCoreAsync("NotificationReceived", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NotifyFollowersOfRepost_NotifiesEveryFollower_WithTrackLink()
    {
        await using var db = TestHelpers.NewDb();
        var reposter = Guid.NewGuid();
        var f1 = Guid.NewGuid();
        var f2 = Guid.NewGuid();
        db.Users.Add(new ApplicationUser { Id = reposter, Name = "Reposter", AvatarUrl = "a.png" });
        db.UserFollows.Add(new UserFollow { FollowerId = f1, FolloweeId = reposter });
        db.UserFollows.Add(new UserFollow { FollowerId = f2, FolloweeId = reposter });
        await db.SaveChangesAsync();
        var (svc, proxy) = NewService(db);

        var trackId = Guid.NewGuid();
        await svc.NotifyFollowersOfRepostAsync(reposter, new Repost { UserId = reposter, TrackId = trackId });

        var notes = db.Notifications.ToList();
        Assert.Equal(2, notes.Count);
        Assert.All(notes, n =>
        {
            Assert.Equal("repost", n.Type);
            Assert.Equal("Reposter reposted a track", n.Title);
            Assert.Equal($"/track/{trackId}", n.LinkUrl);
            Assert.Equal("a.png", n.ImageUrl);
        });
        Assert.Equal(new[] { f1, f2 }.ToHashSet(), notes.Select(n => n.UserId).ToHashSet());
        proxy.Verify(p => p.SendCoreAsync("NotificationReceived", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task NotifyFollowersOfRepost_NoFollowers_CreatesNothing()
    {
        await using var db = TestHelpers.NewDb();
        var reposter = Guid.NewGuid();
        db.Users.Add(new ApplicationUser { Id = reposter, Name = "Lonely" });
        await db.SaveChangesAsync();
        var (svc, proxy) = NewService(db);

        await svc.NotifyFollowersOfRepostAsync(reposter, new Repost { UserId = reposter, PlaylistId = Guid.NewGuid() });

        Assert.Empty(db.Notifications);
        proxy.Verify(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task NotifyArtistFollowersOfRelease_NotifiesFollowers_ExcludesArtistAccounts()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        var artistAccount = Guid.NewGuid();       // the artist's own login
        var fan = Guid.NewGuid();                 // a real follower
        var selfFollower = Guid.NewGuid();        // another artist account that also follows — must be excluded

        db.Users.Add(new ApplicationUser { Id = artistAccount, Name = "Artist", ArtistId = artistId });
        db.Users.Add(new ApplicationUser { Id = selfFollower, Name = "Artist Alt", ArtistId = artistId });
        db.UserFollows.Add(new UserFollow { FollowerId = fan, FolloweeId = artistAccount });
        db.UserFollows.Add(new UserFollow { FollowerId = selfFollower, FolloweeId = artistAccount });
        await db.SaveChangesAsync();
        var (svc, _) = NewService(db);

        await svc.NotifyArtistFollowersOfReleaseAsync(
            artistId, "Artist", "New Song", "track", "/track/123");

        var note = Assert.Single(db.Notifications);  // only the fan, not the artist's own accounts
        Assert.Equal(fan, note.UserId);
        Assert.Equal("new_release", note.Type);
        Assert.Equal("Artist released \"New Song\"", note.Title);
        Assert.Equal("/track/123", note.LinkUrl);
    }

    [Fact]
    public async Task NotifyArtistFollowersOfRelease_NoFollowers_CreatesNothing()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        db.Users.Add(new ApplicationUser { Id = Guid.NewGuid(), Name = "Artist", ArtistId = artistId });
        await db.SaveChangesAsync();
        var (svc, _) = NewService(db);

        await svc.NotifyArtistFollowersOfReleaseAsync(artistId, "Artist", "Album", "album", "/album/1");

        Assert.Empty(db.Notifications);
    }
}
