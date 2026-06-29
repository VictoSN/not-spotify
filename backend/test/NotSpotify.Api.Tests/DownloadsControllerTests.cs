using Microsoft.AspNetCore.Hosting;
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
        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.ContentRootPath).Returns(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N")));
        env.Setup(e => e.WebRootPath).Returns(string.Empty);
        var controller = CreateController(storage.Object, env.Object);

        var result = await controller.GetInstaller("not-spotify-windows-x64-setup.exe");

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/vnd.microsoft.portable-executable", file.ContentType);
        Assert.Equal("not-spotify-windows-x64-setup.exe", file.FileDownloadName);
        Assert.Equal(new byte[] { 1, 2, 3 }, file.FileContents);
    }

    [Fact]
    public async Task GetInstaller_RejectsUnknownFileNames()
    {
        var storage = new Mock<IStorageService>();
        var env = new Mock<IWebHostEnvironment>();
        var controller = CreateController(storage.Object, env.Object);

        var result = await controller.GetInstaller("../secret.txt");

        Assert.IsType<NotFoundResult>(result);
        storage.Verify(s => s.ReadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static DownloadsController CreateController(IStorageService storage, IWebHostEnvironment env) =>
        new(storage, env)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            },
        };
}
