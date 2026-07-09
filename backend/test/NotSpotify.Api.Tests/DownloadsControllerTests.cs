using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class DownloadsControllerTests
{
    [Fact]
    public async Task GetInstaller_ReadsKnownInstallerFromStorage()
    {
        var storage = new Mock<IStorageService>();
        storage
            .Setup(s => s.ReadAsync("downloads/not-spotify-windows-x64-setup.exe", It.IsAny<CancellationToken>()))
            .ReturnsAsync([1, 2, 3]);
        var controller = CreateController(storage.Object);

        var result = await controller.GetInstaller("not-spotify-windows-x64-setup.exe");

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/vnd.microsoft.portable-executable", file.ContentType);
        Assert.Equal("not-spotify-windows-x64-setup.exe", file.FileDownloadName);
        Assert.Equal(new byte[] { 1, 2, 3 }, file.FileContents);
    }

    [Fact]
    public async Task GetInstaller_VersionedSetupNameReadsStableStorageObject()
    {
        var storage = new Mock<IStorageService>();
        storage
            .Setup(s => s.ReadAsync("downloads/not-spotify-windows-x64-setup.exe", It.IsAny<CancellationToken>()))
            .ReturnsAsync([4, 5, 6]);
        var controller = CreateController(storage.Object);

        var result = await controller.GetInstaller("not-spotify_0.7.8_x64-setup.exe");

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/vnd.microsoft.portable-executable", file.ContentType);
        Assert.Equal("not-spotify_0.7.8_x64-setup.exe", file.FileDownloadName);
        Assert.Equal(new byte[] { 4, 5, 6 }, file.FileContents);
    }

    [Fact]
    public async Task GetInstaller_VersionedMsiNameReadsStableStorageObject()
    {
        var storage = new Mock<IStorageService>();
        storage
            .Setup(s => s.ReadAsync("downloads/not-spotify-windows-x64.msi", It.IsAny<CancellationToken>()))
            .ReturnsAsync([7, 8, 9]);
        var controller = CreateController(storage.Object);

        var result = await controller.GetInstaller("not-spotify_0.7.8_x64_en-US.msi");

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/x-msi", file.ContentType);
        Assert.Equal("not-spotify_0.7.8_x64_en-US.msi", file.FileDownloadName);
        Assert.Equal(new byte[] { 7, 8, 9 }, file.FileContents);
    }

    [Fact]
    public async Task GetInstaller_RejectsUnknownFileNames()
    {
        var storage = new Mock<IStorageService>();
        var controller = CreateController(storage.Object);

        var result = await controller.GetInstaller("../secret.txt");

        Assert.IsType<NotFoundResult>(result);
        storage.Verify(s => s.ReadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static DownloadsController CreateController(IStorageService storage) =>
        new(storage)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            },
        };
}
