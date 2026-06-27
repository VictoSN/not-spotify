using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Controllers.Admin;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Admin ad management CRUD: the create/list/update/delete path an admin uses to
/// manage the house ads that <see cref="Controllers.AdsController"/> serves to the
/// free tier, plus the global serving settings. (<c>Delete</c> uses
/// <c>ExecuteDeleteAsync</c>, unsupported by the EF InMemory provider, so it is not
/// unit-tested here — same carve-out as the impression counter.)
/// </summary>
public class AdminAdsControllerTests
{
    private static AdminAdsController NewController(AppDbContext db) =>
        new(db, TestHelpers.NewMapper());

    private static UpsertAdRequest ValidRequest(string title = "Summer sale") =>
        new(
            Title: title,
            Advertiser: "ACME",
            AudioUrl: "https://cdn.test/ads/spot.mp3",
            DurationMs: 30_000,
            Country: "us",
            Weight: 4,
            IsActive: true);

    [Fact]
    public async Task Create_PersistsAd_AndReturnsDto()
    {
        await using var db = TestHelpers.NewDb();
        var controller = NewController(db);

        var result = await controller.Create(ValidRequest());

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<AdAdminDto>(ok.Value);
        Assert.Equal("Summer sale", dto.Title);
        Assert.Equal("US", dto.Country);   // normalised to upper-case
        Assert.Equal(4, dto.Weight);

        var stored = Assert.Single(db.Advertisements);
        Assert.Equal("Summer sale", stored.Title);
        Assert.Equal("US", stored.Country);
    }

    [Fact]
    public async Task Create_WithoutTitle_IsRejected()
    {
        await using var db = TestHelpers.NewDb();
        var controller = NewController(db);

        var result = await controller.Create(ValidRequest(title: "   "));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(db.Advertisements);
    }

    [Fact]
    public async Task Create_WithoutAudio_IsRejected()
    {
        await using var db = TestHelpers.NewDb();
        var controller = NewController(db);

        var noAudio = ValidRequest() with { AudioUrl = "", AudioKey = null };
        var result = await controller.Create(noAudio);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(db.Advertisements);
    }

    [Fact]
    public async Task List_ReturnsAdsNewestFirst()
    {
        await using var db = TestHelpers.NewDb();
        db.Advertisements.AddRange(
            new Advertisement { Title = "Old", AudioKey = "a.mp3", CreatedAt = DateTime.UtcNow.AddDays(-1) },
            new Advertisement { Title = "New", AudioKey = "b.mp3", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var controller = NewController(db);

        var ok = Assert.IsType<OkObjectResult>((await controller.List()).Result);
        var dtos = Assert.IsAssignableFrom<IEnumerable<AdAdminDto>>(ok.Value).ToList();

        Assert.Equal(new[] { "New", "Old" }, dtos.Select(d => d.Title));
    }

    [Fact]
    public async Task Update_ChangesFields()
    {
        await using var db = TestHelpers.NewDb();
        var ad = new Advertisement { Title = "Before", AudioKey = "a.mp3", IsActive = true, Weight = 1 };
        db.Advertisements.Add(ad);
        await db.SaveChangesAsync();
        var controller = NewController(db);

        var req = ValidRequest(title: "After") with { IsActive = false, Weight = 9 };
        var result = await controller.Update(ad.Id, req);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<AdAdminDto>(ok.Value);
        Assert.Equal("After", dto.Title);
        Assert.False(dto.IsActive);
        Assert.Equal(9, dto.Weight);

        var stored = await db.Advertisements.FindAsync(ad.Id);
        Assert.Equal("After", stored!.Title);
        Assert.False(stored.IsActive);
    }

    [Fact]
    public async Task Update_MissingAd_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var controller = NewController(db);

        var result = await controller.Update(Guid.NewGuid(), ValidRequest());

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Settings_RoundTrip_PersistsCadenceAndToggle()
    {
        await using var db = TestHelpers.NewDb();
        var controller = NewController(db);

        var saved = Assert.IsType<OkObjectResult>(
            (await controller.UpdateSettings(new AdSettingsDto(7, false))).Result);
        var savedDto = Assert.IsType<AdSettingsDto>(saved.Value);
        Assert.Equal(7, savedDto.AdsPerNTracks);
        Assert.False(savedDto.IsEnabled);

        var read = Assert.IsType<OkObjectResult>((await controller.GetSettings()).Result);
        var readDto = Assert.IsType<AdSettingsDto>(read.Value);
        Assert.Equal(7, readDto.AdsPerNTracks);
        Assert.False(readDto.IsEnabled);
    }

    [Fact]
    public async Task Settings_FloorsCadenceToOne()
    {
        await using var db = TestHelpers.NewDb();
        var controller = NewController(db);

        var ok = Assert.IsType<OkObjectResult>(
            (await controller.UpdateSettings(new AdSettingsDto(0, true))).Result);
        var dto = Assert.IsType<AdSettingsDto>(ok.Value);
        Assert.Equal(1, dto.AdsPerNTracks);
    }
}
