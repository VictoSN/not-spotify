using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class MeExportControllerTests
{
    private static MeController NewController(NotSpotify.Api.Data.AppDbContext db, ApplicationUser me)
    {
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.GetRolesAsync(It.Is<ApplicationUser>(x => x.Id == me.Id)))
            .ReturnsAsync(new List<string> { "Listener" });

        var storage = TestHelpers.NewStorageMock();
        var lyrics = TestHelpers.NewOfflineLyrics();
        var waveforms = new AudioWaveformService(storage.Object, NullLogger<AudioWaveformService>.Instance);

        return new MeController(db, new MediaMapper(storage.Object), users.Object,
            storage.Object, lyrics, NullLogger<MeController>.Instance, waveforms,
            TestHelpers.NewNotifications(db), new ConfigurationBuilder().Build())
            .AsUser(me.Id);
    }

    [Fact]
    public async Task Export_ReturnsOnlyCallerScopedData()
    {
        await using var db = TestHelpers.NewDb();
        var me = db.AddUser(Guid.NewGuid(), "me");
        me.Email = "me@test";
        var other = db.AddUser(Guid.NewGuid(), "other");
        other.Email = "other@test";
        var (artist, album) = db.AddArtistAlbum("Export Artist");
        var mineTrack = db.AddTrack("Mine Track", artist, album);
        var otherTrack = db.AddTrack("Other Track", artist, album);
        var minePlaylist = db.AddPlaylist(me.Id, name: "Mine List");
        _ = db.AddPlaylist(other.Id, name: "Other List");

        db.PlaylistTracks.Add(new PlaylistTrack
        {
            Playlist = minePlaylist,
            PlaylistId = minePlaylist.Id,
            Track = mineTrack,
            TrackId = mineTrack.Id,
            AddedByUserId = me.Id,
        });
        db.UserSavedTracks.AddRange(
            new UserSavedTrack { User = me, UserId = me.Id, Track = mineTrack, TrackId = mineTrack.Id },
            new UserSavedTrack { User = other, UserId = other.Id, Track = otherTrack, TrackId = otherTrack.Id });
        db.PlayHistories.AddRange(
            new PlayHistory { User = me, UserId = me.Id, Track = mineTrack, TrackId = mineTrack.Id },
            new PlayHistory { User = other, UserId = other.Id, Track = otherTrack, TrackId = otherTrack.Id });
        db.RecentSearches.AddRange(
            new RecentSearch { User = me, UserId = me.Id, Term = "mine query" },
            new RecentSearch { User = other, UserId = other.Id, Term = "other query" });
        db.UserUploads.AddRange(
            new UserUpload { User = me, UserId = me.Id, Title = "Mine Upload", DurationMs = 1000 },
            new UserUpload { User = other, UserId = other.Id, Title = "Other Upload", DurationMs = 1000 });
        db.Notifications.AddRange(
            new Notification { User = me, UserId = me.Id, Title = "Mine Notification" },
            new Notification { User = other, UserId = other.Id, Title = "Other Notification" });
        db.PlanMemberships.Add(new PlanMembership
        {
            Owner = me,
            OwnerId = me.Id,
            Member = other,
            MemberId = other.Id,
            InvitedEmail = other.Email!,
            Status = "active",
        });
        await db.SaveChangesAsync();

        var ok = Assert.IsType<OkObjectResult>(await NewController(db, me).Export());
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value));
        var root = doc.RootElement;

        Assert.Equal("me@test", root.GetProperty("Account").GetProperty("Email").GetString());

        var savedTrackTitles = root.GetProperty("Library").GetProperty("SavedTracks")
            .EnumerateArray()
            .Select(x => x.GetProperty("Track").GetProperty("Title").GetString())
            .ToList();
        Assert.Equal(new[] { "Mine Track" }, savedTrackTitles);

        var ownedPlaylistNames = root.GetProperty("Library").GetProperty("OwnedPlaylists")
            .EnumerateArray()
            .Select(x => x.GetProperty("Name").GetString())
            .ToList();
        Assert.Equal(new[] { "Mine List" }, ownedPlaylistNames);

        var historyTitles = root.GetProperty("ListeningHistory")
            .EnumerateArray()
            .Select(x => x.GetProperty("Track").GetProperty("Title").GetString())
            .ToList();
        Assert.Equal(new[] { "Mine Track" }, historyTitles);

        var searchTerms = root.GetProperty("RecentSearches")
            .EnumerateArray()
            .Select(x => x.GetProperty("Term").GetString())
            .ToList();
        Assert.Equal(new[] { "mine query" }, searchTerms);

        var uploadTitles = root.GetProperty("Library").GetProperty("Uploads")
            .EnumerateArray()
            .Select(x => x.GetProperty("Title").GetString())
            .ToList();
        Assert.Equal(new[] { "Mine Upload" }, uploadTitles);

        var notificationTitles = root.GetProperty("Notifications")
            .EnumerateArray()
            .Select(x => x.GetProperty("Title").GetString())
            .ToList();
        Assert.Equal(new[] { "Mine Notification" }, notificationTitles);
    }
}
