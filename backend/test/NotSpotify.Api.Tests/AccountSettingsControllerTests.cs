using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class AccountSettingsControllerTests
{
    private static MeController NewMeController(NotSpotify.Api.Data.AppDbContext db, ApplicationUser me)
    {
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByIdAsync(me.Id.ToString())).ReturnsAsync(me);
        users.Setup(u => u.HasPasswordAsync(It.Is<ApplicationUser>(x => x.Id == me.Id))).ReturnsAsync(true);
        users.Setup(u => u.UpdateAsync(It.IsAny<ApplicationUser>())).ReturnsAsync(IdentityResult.Success);
        users.Setup(u => u.GetRolesAsync(It.Is<ApplicationUser>(x => x.Id == me.Id))).ReturnsAsync(new List<string>());

        var storage = TestHelpers.NewStorageMock();
        var lyrics = TestHelpers.NewOfflineLyrics();
        var waveforms = new AudioWaveformService(storage.Object, NullLogger<AudioWaveformService>.Instance);

        return new MeController(db, new MediaMapper(storage.Object), users.Object,
            storage.Object, lyrics, NullLogger<MeController>.Instance, waveforms,
            TestHelpers.NewNotifications(db), new ConfigurationBuilder().Build())
            .AsUser(me.Id);
    }

    [Fact]
    public async Task AccountPreferences_RoundTripAndAffectAdTargeting()
    {
        await using var db = TestHelpers.NewDb();
        var me = db.AddUser(Guid.NewGuid(), "me");
        var controller = NewMeController(db, me);

        var updated = await controller.UpdateAccountPreferences(new UpdateAccountPreferencesRequest(
            AllowPersonalizedAds: false,
            BlockAlcoholAds: true,
            BlockGamblingAds: false,
            EmailProductUpdates: false,
            EmailSecurityAlerts: true));
        var prefs = Assert.IsType<OkObjectResult>(updated.Result).Value as AccountPreferencesDto;
        Assert.NotNull(prefs);
        Assert.False(prefs!.AllowPersonalizedAds);
        Assert.True(prefs.BlockAlcoholAds);

        db.AdSettings.Add(new AdSettings { IsEnabled = true, AdsPerNTracks = 1 });
        db.Advertisements.Add(new Advertisement { Id = Guid.NewGuid(), Title = "US only", AudioUrl = "/us.mp3", Country = "US", IsActive = true });
        db.Advertisements.Add(new Advertisement { Id = Guid.NewGuid(), Title = "Untargeted", AudioUrl = "/any.mp3", Country = null, IsActive = true });
        await db.SaveChangesAsync();

        var ad = await new AdsController(db, TestHelpers.NewMapper()).AsUser(me.Id).Next(country: "US");
        var dto = Assert.IsType<OkObjectResult>(ad.Result).Value as AdDto;
        Assert.Equal("Untargeted", dto?.Title);
    }

    [Fact]
    public async Task Redeem_ValidTrialCode_UpgradesUser()
    {
        await using var db = TestHelpers.NewDb();
        var me = db.AddUser(Guid.NewGuid(), "me");
        var controller = NewMeController(db, me);

        var result = await controller.Redeem(new RedeemRequest("notspotify30"));
        var dto = Assert.IsType<OkObjectResult>(result.Result).Value as RedeemResultDto;

        Assert.NotNull(dto);
        Assert.Equal("PREMIUM", me.Plan.ToUpperInvariant());
        Assert.Equal("trialing", me.StripeSubscriptionStatus);
        Assert.NotNull(dto!.User);
    }

    [Fact]
    public async Task DeletedPlaylist_CanBeRestoredAfterDelete()
    {
        await using var db = TestHelpers.NewDb();
        var me = db.AddUser(Guid.NewGuid(), "me");
        var (artist, album) = db.AddArtistAlbum("Recovery Artist");
        var track = db.AddTrack("Recover Me", artist, album);
        var playlist = db.AddPlaylist(me.Id, name: "Recoverable");
        db.PlaylistTracks.Add(new PlaylistTrack
        {
            PlaylistId = playlist.Id,
            TrackId = track.Id,
            Position = 1,
            AddedByUserId = me.Id,
        });
        await db.SaveChangesAsync();

        var delete = await TestHelpers.NewPlaylistsController(db).AsUser(me.Id).Delete(playlist.Id);
        Assert.IsType<NoContentResult>(delete);
        Assert.Single(db.DeletedPlaylists);

        var meController = NewMeController(db, me);
        var list = await meController.DeletedPlaylists();
        var rows = Assert.IsType<OkObjectResult>(list.Result).Value as IEnumerable<DeletedPlaylistDto>;
        var deleted = Assert.Single(rows!);
        Assert.Equal("Recoverable", deleted.Name);
        Assert.Equal(1, deleted.TrackCount);

        var restore = await meController.RestoreDeletedPlaylist(deleted.Id);
        var restored = Assert.IsType<OkObjectResult>(restore.Result).Value as PlaylistDto;
        Assert.NotNull(restored);
        Assert.Equal("Recoverable", restored!.Name);
        Assert.Single(restored.Tracks);
        Assert.Empty(db.DeletedPlaylists);
    }
}
