using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Reposts: create (idempotent, polymorphic target validation), author-only
/// delete, own-reposts list, and the followed-users feed.
/// </summary>
public class RepostsControllerTests
{
    private static RepostsController New(NotSpotify.Api.Data.AppDbContext db, Guid me) =>
        new RepostsController(db, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db)).AsUser(me);

    [Fact]
    public async Task Create_WithNoTarget_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();

        var result = await New(db, me).Create(new CreateRepostRequest(null, null, null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(db.Reposts);
    }

    [Fact]
    public async Task Create_TrackRepost_PersistsAndReturnsDto()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        var track = db.SeedTrack();
        await db.SaveChangesAsync();

        var result = await New(db, me).Create(new CreateRepostRequest(track.Id, null, null));

        var dto = Assert.IsType<RepostDto>(Assert.IsType<CreatedAtActionResult>(result.Result).Value);
        Assert.Equal(track.Id, dto.TrackId);
        Assert.NotNull(dto.Track);
        var row = Assert.Single(db.Reposts);
        Assert.Equal(me, row.UserId);
        Assert.Equal(track.Id, row.TrackId);
    }

    [Fact]
    public async Task Create_IsIdempotent_PerTarget()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        var track = db.SeedTrack();
        await db.SaveChangesAsync();

        var first = await New(db, me).Create(new CreateRepostRequest(track.Id, null, null));
        var firstDto = Assert.IsType<RepostDto>(Assert.IsType<CreatedAtActionResult>(first.Result).Value);

        var second = await New(db, me).Create(new CreateRepostRequest(track.Id, null, null));
        var secondDto = Assert.IsType<RepostDto>(Assert.IsType<OkObjectResult>(second.Result).Value);

        Assert.Equal(firstDto.Id, secondDto.Id);
        Assert.Single(db.Reposts); // no duplicate row
    }

    [Fact]
    public async Task Delete_ByAuthor_Removes_ByOtherNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var author = Guid.NewGuid();
        var other = Guid.NewGuid();
        var track = db.SeedTrack();
        var repost = new Repost { UserId = author, TrackId = track.Id };
        db.AddUser(author, "author");
        db.Reposts.Add(repost);
        await db.SaveChangesAsync();

        var byOther = await New(db, other).Delete(repost.Id);
        Assert.IsType<NotFoundResult>(byOther);
        Assert.Single(db.Reposts);

        var byAuthor = await New(db, author).Delete(repost.Id);
        Assert.IsType<NoContentResult>(byAuthor);
        Assert.Empty(db.Reposts);
    }

    [Fact]
    public async Task GetFeed_EmptyWhenFollowingNobody()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();

        var result = await New(db, me).GetFeed();

        var feed = Assert.IsAssignableFrom<IEnumerable<RepostDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Empty(feed);
    }

    [Fact]
    public async Task GetFeed_ReturnsRepostsFromFollowedUsersOnly()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var followed = Guid.NewGuid();
        var notFollowed = Guid.NewGuid();
        db.AddUser(me, "me");
        db.AddUser(followed, "followed");
        db.AddUser(notFollowed, "stranger");
        var track = db.SeedTrack();
        db.AddFollow(me, followed);
        db.Reposts.Add(new Repost { UserId = followed, TrackId = track.Id });
        db.Reposts.Add(new Repost { UserId = notFollowed, TrackId = track.Id });
        await db.SaveChangesAsync();

        var result = await New(db, me).GetFeed();

        var feed = Assert.IsAssignableFrom<IEnumerable<RepostDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var single = Assert.Single(feed);
        Assert.Equal(followed, single.User.Id);
    }
}
