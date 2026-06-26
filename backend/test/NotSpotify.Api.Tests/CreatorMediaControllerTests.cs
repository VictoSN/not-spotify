using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class CreatorMediaControllerTests
{
    private static (MeCreatorMediaController controller, Mock<IStorageService> storage) NewController(
        AppDbContext db,
        ApplicationUser user,
        params string[] roles)
    {
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByIdAsync(user.Id.ToString())).ReturnsAsync(user);

        var storage = TestHelpers.NewStorageMock();
        storage.Setup(s => s.UploadAsync(
                It.IsAny<string>(),
                It.IsAny<Stream>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        storage.Setup(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var mapper = new MediaMapper(storage.Object);
        var controller = new MeCreatorMediaController(
                db,
                users.Object,
                storage.Object,
                mapper,
                NullLogger<MeCreatorMediaController>.Instance)
            .AsUser(user.Id, roles);
        return (controller, storage);
    }

    private static IFormFile UploadFile(string fileName, string contentType, byte[]? bytes = null)
    {
        var data = bytes ?? new byte[] { 1, 2, 3, 4 };
        var stream = new MemoryStream(data);
        return new FormFile(stream, 0, stream.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType,
        };
    }

    private static (Artist artist, ApplicationUser user) ArtistUser(string artistName = "Creator")
    {
        var artist = new Artist { Id = Guid.NewGuid(), Name = artistName };
        var user = new ApplicationUser { Id = Guid.NewGuid(), Name = $"{artistName} User", UserName = $"{artistName}@test", ArtistId = artist.Id };
        return (artist, user);
    }

    private static Track TrackFor(Artist artist, string title = "Track")
    {
        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = $"{title} Album",
            ArtistId = artist.Id,
            Artist = artist,
            CoverUrl = "",
            ReleaseDate = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        return new Track
        {
            Id = Guid.NewGuid(),
            Title = title,
            ArtistId = artist.Id,
            Artist = artist,
            AlbumId = album.Id,
            Album = album,
            DurationMs = 120_000,
            AudioUrl = "",
            Status = "approved",
        };
    }

    [Fact]
    public async Task GetArtistPodcasts_WhenUserHasNoArtist_ReturnsForbid()
    {
        await using var db = TestHelpers.NewDb();
        var user = new ApplicationUser { Id = Guid.NewGuid(), Name = "Listener", UserName = "listener@test" };
        var (controller, _) = NewController(db, user, "Artist");

        var result = await controller.GetArtistPodcasts();

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task UploadArtistEpisode_CreatesPublicEpisodeAndUploadsMedia()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, user) = ArtistUser();
        var podcast = new Podcast
        {
            Id = Guid.NewGuid(),
            ArtistId = artist.Id,
            Artist = artist,
            Title = "Studio Notes",
            Author = artist.Name,
            CreatedAt = DateTime.UtcNow,
        };
        db.AddRange(artist, podcast);
        await db.SaveChangesAsync();

        var (controller, storage) = NewController(db, user, "Artist");
        var form = new ArtistEpisodeUploadForm
        {
            Title = "Pilot",
            Description = "Behind the track.",
            DurationMs = 42_000,
            EpisodeNumber = 7,
            Explicit = true,
            File = UploadFile("pilot.mp3", "audio/mpeg"),
            Image = UploadFile("cover.png", "image/png"),
        };

        var ok = Assert.IsType<OkObjectResult>((await controller.UploadArtistEpisode(podcast.Id, form)).Result);
        var dto = Assert.IsType<EpisodeDto>(ok.Value);

        Assert.Equal("Pilot", dto.Title);
        Assert.True(dto.Explicit);
        Assert.Contains("/audio/", dto.AudioUrl);
        Assert.Contains("/covers/", dto.ImageUrl);
        storage.Verify(s => s.UploadAsync(
            It.Is<string>(k => k.StartsWith("audio/") && k.EndsWith(".mp3")),
            It.IsAny<Stream>(),
            "audio/mpeg",
            It.IsAny<CancellationToken>()), Times.Once);
        storage.Verify(s => s.UploadAsync(
            It.Is<string>(k => k.StartsWith("covers/") && k.EndsWith(".png")),
            It.IsAny<Stream>(),
            "image/png",
            It.IsAny<CancellationToken>()), Times.Once);

        var publicController = new PodcastsController(db, new MediaMapper(storage.Object));
        var publicOk = Assert.IsType<OkObjectResult>((await publicController.Get(podcast.Id)).Result);
        var publicDto = Assert.IsType<PodcastDto>(publicOk.Value);
        Assert.Single(publicDto.Episodes);
        Assert.Equal("Pilot", publicDto.Episodes.Single().Title);
    }

    [Fact]
    public async Task UploadArtistVideo_RejectsForeignLinkedTrack()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, user) = ArtistUser();
        var otherArtist = new Artist { Id = Guid.NewGuid(), Name = "Other" };
        var foreignTrack = TrackFor(otherArtist, "Not Mine");
        db.AddRange(artist, otherArtist, foreignTrack.Album, foreignTrack);
        await db.SaveChangesAsync();

        var (controller, storage) = NewController(db, user, "Artist");
        var form = new ArtistMusicVideoUploadForm
        {
            Title = "Video",
            TrackId = foreignTrack.Id,
            DurationMs = 1000,
            Video = UploadFile("video.mp4", "video/mp4"),
        };

        var bad = Assert.IsType<BadRequestObjectResult>((await controller.UploadArtistVideo(form)).Result);

        Assert.Contains("Linked track", bad.Value!.ToString());
        storage.Verify(s => s.UploadAsync(It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UploadArtistVideo_CreatesPublicVideoAndUploadsMedia()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, user) = ArtistUser();
        var track = TrackFor(artist, "Single");
        db.AddRange(artist, track.Album, track);
        await db.SaveChangesAsync();

        var (controller, storage) = NewController(db, user, "Artist");
        var form = new ArtistMusicVideoUploadForm
        {
            Title = "Single Video",
            Description = "Official visual.",
            TrackId = track.Id,
            DurationMs = 90_000,
            Video = UploadFile("single.webm", "video/webm"),
            Thumbnail = UploadFile("thumb.webp", "image/webp"),
        };

        var ok = Assert.IsType<OkObjectResult>((await controller.UploadArtistVideo(form)).Result);
        var dto = Assert.IsType<MusicVideoDto>(ok.Value);

        Assert.Equal("Single Video", dto.Title);
        Assert.Equal("Official visual.", dto.Description);
        Assert.Contains("/videos/", dto.VideoUrl);
        Assert.Contains("/covers/", dto.ThumbnailUrl);
        storage.Verify(s => s.UploadAsync(
            It.Is<string>(k => k.StartsWith("videos/") && k.EndsWith(".webm")),
            It.IsAny<Stream>(),
            "video/webm",
            It.IsAny<CancellationToken>()), Times.Once);
        storage.Verify(s => s.UploadAsync(
            It.Is<string>(k => k.StartsWith("covers/") && k.EndsWith(".webp")),
            It.IsAny<Stream>(),
            "image/webp",
            It.IsAny<CancellationToken>()), Times.Once);

        var publicController = new MusicVideosController(db, new MediaMapper(storage.Object));
        var publicOk = Assert.IsType<OkObjectResult>((await publicController.GetByTrack(track.Id)).Result);
        var publicDto = Assert.IsType<MusicVideoDto>(publicOk.Value);
        Assert.Equal("Single Video", publicDto.Title);
        Assert.Equal(track.Id, publicDto.TrackId);
    }

    [Fact]
    public async Task DeleteArtistVideo_OwnedVideo_RemovesRowAndDeletesObjects()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, user) = ArtistUser();
        var video = new MusicVideo
        {
            Id = Guid.NewGuid(),
            Title = "Delete Me",
            ArtistId = artist.Id,
            Artist = artist,
            VideoKey = "videos/delete-me.mp4",
            ThumbnailKey = "covers/delete-me.jpg",
            VideoUrl = "",
            DurationMs = 1000,
        };
        db.AddRange(artist, video);
        await db.SaveChangesAsync();

        var (controller, storage) = NewController(db, user, "Artist");

        var result = await controller.DeleteArtistVideo(video.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.MusicVideos);
        storage.Verify(s => s.DeleteAsync("videos/delete-me.mp4", It.IsAny<CancellationToken>()), Times.Once);
        storage.Verify(s => s.DeleteAsync("covers/delete-me.jpg", It.IsAny<CancellationToken>()), Times.Once);
    }
}
