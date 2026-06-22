using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Public content-serve reads: the podcasts catalogue/detail and the music-video
/// catalogue. (The view-count increment on a single video uses
/// <c>ExecuteUpdateAsync</c>, unsupported by EF InMemory, so only the list is
/// covered here.)
/// </summary>
public class ContentServeTests
{
    [Fact]
    public async Task Podcasts_List_ReturnsShowsWithEpisodeCount()
    {
        await using var db = TestHelpers.NewDb();
        var show = new Podcast { Title = "Daily Tech", Author = "Host" };
        show.Episodes.Add(new Episode { Title = "Ep 1", EpisodeNumber = 1 });
        show.Episodes.Add(new Episode { Title = "Ep 2", EpisodeNumber = 2 });
        db.Podcasts.Add(show);
        await db.SaveChangesAsync();
        var controller = new PodcastsController(db, TestHelpers.NewMapper());

        var ok = Assert.IsType<OkObjectResult>((await controller.List()).Result);
        var dto = Assert.Single(Assert.IsAssignableFrom<IEnumerable<PodcastSummaryDto>>(ok.Value));
        Assert.Equal("Daily Tech", dto.Title);
        Assert.Equal(2, dto.EpisodeCount);
    }

    [Fact]
    public async Task Podcasts_Get_Unknown_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var controller = new PodcastsController(db, TestHelpers.NewMapper());

        var result = await controller.Get(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Podcasts_Get_ReturnsShowWithEpisodes()
    {
        await using var db = TestHelpers.NewDb();
        var show = new Podcast { Title = "Daily Tech", Author = "Host" };
        show.Episodes.Add(new Episode { Title = "Ep 1", EpisodeNumber = 1, AudioKey = "ep/1.mp3" });
        db.Podcasts.Add(show);
        await db.SaveChangesAsync();
        var controller = new PodcastsController(db, TestHelpers.NewMapper());

        var ok = Assert.IsType<OkObjectResult>((await controller.Get(show.Id)).Result);
        var dto = Assert.IsType<PodcastDto>(ok.Value);
        Assert.Equal("Daily Tech", dto.Title);
        Assert.Single(dto.Episodes);
    }

    [Fact]
    public async Task MusicVideos_List_ReturnsNewestFirst()
    {
        await using var db = TestHelpers.NewDb();
        var artist = new Artist { Id = Guid.NewGuid(), Name = "artist" };
        var older = new MusicVideo { Title = "Older", ArtistId = artist.Id, Artist = artist, CreatedAt = DateTime.UtcNow.AddDays(-2) };
        var newer = new MusicVideo { Title = "Newer", ArtistId = artist.Id, Artist = artist, CreatedAt = DateTime.UtcNow };
        db.Artists.Add(artist);
        db.MusicVideos.AddRange(older, newer);
        await db.SaveChangesAsync();
        var controller = new MusicVideosController(db, TestHelpers.NewMapper());

        var ok = Assert.IsType<OkObjectResult>((await controller.List()).Result);
        var list = Assert.IsAssignableFrom<IEnumerable<MusicVideoDto>>(ok.Value).ToList();
        Assert.Equal(new[] { "Newer", "Older" }, list.Select(v => v.Title).ToArray());
    }
}
