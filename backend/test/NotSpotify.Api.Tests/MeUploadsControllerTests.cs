using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Personal uploads locker — every action is scoped to the calling user, so a
/// user can only ever see or delete their own uploads. Storage is mocked.
/// </summary>
public class MeUploadsControllerTests
{
    private static (MeUploadsController controller, Mock<IStorageService> storage) NewController(
        NotSpotify.Api.Data.AppDbContext db, Guid me)
    {
        var storage = new Mock<IStorageService>();
        storage.Setup(s => s.GetAudioUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync<string, CancellationToken, IStorageService, string>((k, _) => $"https://cdn.test/{k}");
        var controller = new MeUploadsController(db, storage.Object).AsUser(me);
        return (controller, storage);
    }

    private static UserUpload Upload(Guid owner, string title) => new()
    {
        UserId = owner,
        Title = title,
        AudioKey = $"uploads/{owner}/{Guid.NewGuid()}.mp3",
        DurationMs = 1000,
    };

    [Fact]
    public async Task List_NoAuth_ReturnsUnauthorized()
    {
        await using var db = TestHelpers.NewDb();
        // No AsUser → no NameIdentifier claim.
        var controller = new MeUploadsController(db, new Mock<IStorageService>().Object);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.List();

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task List_ReturnsOnlyCallersUploads()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        db.UserUploads.AddRange(Upload(me, "mine-1"), Upload(me, "mine-2"), Upload(other, "theirs"));
        await db.SaveChangesAsync();
        var (controller, _) = NewController(db, me);

        var ok = Assert.IsType<OkObjectResult>((await controller.List()).Result);
        var dtos = Assert.IsAssignableFrom<IEnumerable<UserUploadDto>>(ok.Value);
        var titles = dtos.Select(d => d.Title).ToHashSet();
        Assert.Equal(new[] { "mine-1", "mine-2" }.ToHashSet(), titles);
    }

    [Fact]
    public async Task Delete_OthersUpload_ReturnsNotFound_AndDoesNotTouchStorage()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        var theirs = Upload(other, "theirs");
        db.UserUploads.Add(theirs);
        await db.SaveChangesAsync();
        var (controller, storage) = NewController(db, me);

        var result = await controller.Delete(theirs.Id);

        Assert.IsType<NotFoundResult>(result);
        Assert.Single(db.UserUploads); // still there
        storage.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Delete_OwnUpload_RemovesRowAndDeletesObject()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var mine = Upload(me, "mine");
        db.UserUploads.Add(mine);
        await db.SaveChangesAsync();
        var (controller, storage) = NewController(db, me);

        var result = await controller.Delete(mine.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.UserUploads);
        storage.Verify(s => s.DeleteAsync(mine.AudioKey!, It.IsAny<CancellationToken>()), Times.Once);
    }

}
