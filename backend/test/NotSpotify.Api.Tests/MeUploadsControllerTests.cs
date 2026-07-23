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

    // ---------------------------------------------------------------- Complete
    // POST /me/uploads/complete registers an object the browser uploaded straight to S3
    // with a presigned URL. The client names the key, so these cover what stops a caller
    // from naming one that isn't theirs.

    /// <summary>Controller whose storage reports the given size for any key (null = missing).</summary>
    private static (MeUploadsController controller, Mock<IStorageService> storage) NewControllerWithSize(
        NotSpotify.Api.Data.AppDbContext db, Guid me, long? size)
    {
        var (controller, storage) = NewController(db, me);
        storage.Setup(s => s.GetSizeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync(size);
        return (controller, storage);
    }

    [Fact]
    public async Task Complete_ValidKey_CreatesRow()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var (controller, _) = NewControllerWithSize(db, me, 4_200_000);
        var key = $"uploads/{me}/{Guid.NewGuid()}.mp3";

        var ok = Assert.IsType<OkObjectResult>(
            (await controller.Complete(new CompleteUploadRequest(key, "My Demo", "Me", 61_000))).Result);

        var dto = Assert.IsType<UserUploadDto>(ok.Value);
        Assert.Equal("My Demo", dto.Title);
        var stored = Assert.Single(db.UserUploads);
        Assert.Equal(key, stored.AudioKey);
        Assert.Equal(me, stored.UserId);
    }

    [Fact]
    public async Task Complete_NoTitle_FallsBackToFileName()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var (controller, _) = NewControllerWithSize(db, me, 1000);

        var ok = Assert.IsType<OkObjectResult>(
            (await controller.Complete(new CompleteUploadRequest($"uploads/{me}/late-night-take.mp3", null, null, null))).Result);

        Assert.Equal("late-night-take", Assert.IsType<UserUploadDto>(ok.Value).Title);
    }

    [Fact]
    public async Task Complete_AnotherUsersPrefix_IsForbidden()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        var (controller, storage) = NewControllerWithSize(db, me, 1000);

        var result = await controller.Complete(new CompleteUploadRequest($"uploads/{other}/theirs.mp3", null, null, null));

        Assert.Equal(403, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        Assert.Empty(db.UserUploads);
        storage.Verify(s => s.GetSizeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Complete_TraversalOutOfOwnPrefix_IsRejected()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        var (controller, _) = NewControllerWithSize(db, me, 1000);

        // Starts with the caller's prefix, so the prefix check alone would pass it.
        var result = await controller.Complete(
            new CompleteUploadRequest($"uploads/{me}/../{other}/theirs.mp3", null, null, null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(db.UserUploads);
    }

    [Fact]
    public async Task Complete_UnsupportedExtension_IsRejected()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var (controller, _) = NewControllerWithSize(db, me, 1000);

        var result = await controller.Complete(new CompleteUploadRequest($"uploads/{me}/payload.exe", null, null, null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(db.UserUploads);
    }

    [Fact]
    public async Task Complete_ObjectMissingFromStorage_IsRejected()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var (controller, _) = NewControllerWithSize(db, me, null);

        var result = await controller.Complete(new CompleteUploadRequest($"uploads/{me}/never-uploaded.mp3", null, null, null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(db.UserUploads);
    }

    [Fact]
    public async Task Complete_OversizedObject_IsRejectedAndDeleted()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var (controller, storage) = NewControllerWithSize(db, me, 500L * 1024 * 1024);
        var key = $"uploads/{me}/huge.wav";

        var result = await controller.Complete(new CompleteUploadRequest(key, null, null, null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(db.UserUploads);
        storage.Verify(s => s.DeleteAsync(key, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Complete_SameKeyTwice_ReturnsConflict()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        var (controller, _) = NewControllerWithSize(db, me, 1000);
        var key = $"uploads/{me}/{Guid.NewGuid()}.mp3";

        await controller.Complete(new CompleteUploadRequest(key, null, null, null));
        var second = await controller.Complete(new CompleteUploadRequest(key, null, null, null));

        Assert.IsType<ConflictObjectResult>(second.Result);
        Assert.Single(db.UserUploads);
    }

    [Fact]
    public async Task Complete_NoAuth_ReturnsUnauthorized()
    {
        await using var db = TestHelpers.NewDb();
        var controller = new MeUploadsController(db, new Mock<IStorageService>().Object);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.Complete(new CompleteUploadRequest("uploads/x/y.mp3", null, null, null));

        Assert.IsType<UnauthorizedResult>(result.Result);
    }
}
