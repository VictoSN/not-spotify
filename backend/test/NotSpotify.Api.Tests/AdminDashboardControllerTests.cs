using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers.Admin;
using NotSpotify.Api.Dtos;
using Xunit;

namespace NotSpotify.Api.Tests;

public class AdminDashboardControllerTests
{
    private static AdminDashboardController Controller(NotSpotify.Api.Data.AppDbContext db)
        => new(db, TestHelpers.NewMapper());

    private static AdminDashboardStatsDto Ok(ActionResult<AdminDashboardStatsDto> action)
    {
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        return Assert.IsType<AdminDashboardStatsDto>(ok.Value);
    }

    [Fact]
    public async Task TopTracks_ReturnsAllTimeAndThirtyDayCounts_OrderedByThirtyDayPlays()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var listenerA = db.AddUser(Guid.NewGuid(), "listener-a");
        var listenerB = db.AddUser(Guid.NewGuid(), "listener-b");

        var recentHit = db.AddTrack("Recent hit", artist, album, playCount: 1000);
        var classic = db.AddTrack("Classic", artist, album, playCount: 5000);

        db.AddPlay(listenerA, recentHit, daysAgo: 1);
        db.AddPlay(listenerB, recentHit, daysAgo: 2);
        db.AddPlay(listenerA, recentHit, daysAgo: 3);
        db.AddPlay(listenerA, classic, daysAgo: 1);
        db.AddPlay(listenerB, classic, daysAgo: 45);
        db.AddPlay(listenerB, classic, daysAgo: 60);
        await db.SaveChangesAsync();

        var stats = Ok(await Controller(db).AsUser(Guid.NewGuid(), "Admin").Get());
        var topTracks = stats.TopTracks.ToList();

        Assert.Equal(2, topTracks.Count);
        Assert.Equal(recentHit.Id, topTracks[0].Id);
        Assert.Equal(1000, topTracks[0].PlayCount);
        Assert.Equal(3, topTracks[0].PlaysInWindow);
        Assert.Equal(2, topTracks[0].UniqueListeners);

        Assert.Equal(classic.Id, topTracks[1].Id);
        Assert.Equal(5000, topTracks[1].PlayCount);
        Assert.Equal(1, topTracks[1].PlaysInWindow);
        Assert.Equal(1, topTracks[1].UniqueListeners);
    }
}
