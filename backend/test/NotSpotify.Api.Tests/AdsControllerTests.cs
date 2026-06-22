using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Ads-engine serving: the cadence settings and the targeted/flight-windowed
/// "next ad" pick. Covers the deterministic candidate filtering in
/// <see cref="AdsController.Next"/> — the weighted random tie-break is left out
/// (non-deterministic by design). <c>Impression</c> is not unit-tested here
/// because it uses <c>ExecuteUpdateAsync</c>, which the EF InMemory provider
/// doesn't support.
/// </summary>
public class AdsControllerTests
{
    private static Advertisement ActiveAd(string? country = null, DateTime? startsAt = null, DateTime? endsAt = null)
        => new()
        {
            Title = "House ad",
            Advertiser = "not-spotify",
            AudioKey = "ads/house.mp3",
            IsActive = true,
            Country = country,
            StartsAt = startsAt,
            EndsAt = endsAt,
            Weight = 1,
        };

    [Fact]
    public async Task Settings_NoRow_ReturnsHonestDefaults()
    {
        await using var db = TestHelpers.NewDb();
        var controller = new AdsController(db, TestHelpers.NewMapper());

        var result = await controller.Settings();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<AdSettingsDto>(ok.Value);
        Assert.Equal(3, dto.AdsPerNTracks); // default cadence
        Assert.False(dto.IsEnabled);        // off until a row says otherwise
    }

    [Fact]
    public async Task Settings_WithRow_ReturnsStoredCadence()
    {
        await using var db = TestHelpers.NewDb();
        db.AdSettings.Add(new AdSettings { AdsPerNTracks = 5, IsEnabled = true });
        await db.SaveChangesAsync();
        var controller = new AdsController(db, TestHelpers.NewMapper());

        var ok = Assert.IsType<OkObjectResult>((await controller.Settings()).Result);
        var dto = Assert.IsType<AdSettingsDto>(ok.Value);
        Assert.Equal(5, dto.AdsPerNTracks);
        Assert.True(dto.IsEnabled);
    }

    [Fact]
    public async Task Next_WhenAdsDisabled_ReturnsNoContent()
    {
        await using var db = TestHelpers.NewDb();
        db.AdSettings.Add(new AdSettings { IsEnabled = false });
        db.Advertisements.Add(ActiveAd());
        await db.SaveChangesAsync();
        var controller = new AdsController(db, TestHelpers.NewMapper()).AsUser(Guid.NewGuid());

        var result = await controller.Next();

        Assert.IsType<NoContentResult>(result.Result);
    }

    [Fact]
    public async Task Next_NoCandidates_ReturnsNoContent()
    {
        await using var db = TestHelpers.NewDb();
        var controller = new AdsController(db, TestHelpers.NewMapper()).AsUser(Guid.NewGuid());

        var result = await controller.Next();

        Assert.IsType<NoContentResult>(result.Result);
    }

    [Fact]
    public async Task Next_ExcludesInactiveAndOutOfFlightWindowAds()
    {
        await using var db = TestHelpers.NewDb();
        var now = DateTime.UtcNow;
        var inactive = ActiveAd();
        inactive.IsActive = false;
        var future = ActiveAd(startsAt: now.AddDays(1));      // not started yet
        var expired = ActiveAd(endsAt: now.AddDays(-1));      // already ended
        db.Advertisements.AddRange(inactive, future, expired);
        await db.SaveChangesAsync();
        var controller = new AdsController(db, TestHelpers.NewMapper()).AsUser(Guid.NewGuid());

        var result = await controller.Next();

        Assert.IsType<NoContentResult>(result.Result);
    }

    [Fact]
    public async Task Next_InFlightWindow_ReturnsAd()
    {
        await using var db = TestHelpers.NewDb();
        var now = DateTime.UtcNow;
        db.Advertisements.Add(ActiveAd(startsAt: now.AddDays(-1), endsAt: now.AddDays(1)));
        await db.SaveChangesAsync();
        var controller = new AdsController(db, TestHelpers.NewMapper()).AsUser(Guid.NewGuid());

        var ok = Assert.IsType<OkObjectResult>((await controller.Next()).Result);
        Assert.IsType<AdDto>(ok.Value);
    }

    [Fact]
    public async Task Next_TargetsCallerMarket_AndIncludesUntargetedAds()
    {
        await using var db = TestHelpers.NewDb();
        db.Advertisements.Add(ActiveAd(country: "MY"));  // matches caller market
        db.Advertisements.Add(ActiveAd(country: null));  // serve everywhere
        await db.SaveChangesAsync();
        var controller = new AdsController(db, TestHelpers.NewMapper()).AsUser(Guid.NewGuid());

        var ok = Assert.IsType<OkObjectResult>((await controller.Next("my")).Result); // case-insensitive
        Assert.IsType<AdDto>(ok.Value);
    }

    [Fact]
    public async Task Next_ExcludesAdsTargetingAnotherMarket()
    {
        await using var db = TestHelpers.NewDb();
        db.Advertisements.Add(ActiveAd(country: "US")); // only ad, wrong market
        await db.SaveChangesAsync();
        var controller = new AdsController(db, TestHelpers.NewMapper()).AsUser(Guid.NewGuid());

        var result = await controller.Next("MY");

        Assert.IsType<NoContentResult>(result.Result);
    }
}
