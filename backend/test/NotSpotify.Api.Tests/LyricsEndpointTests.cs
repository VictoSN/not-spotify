using System.Net;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// TracksController.GetLyrics caching + synced-lyrics sentinel behaviour. Tracks
/// already carrying lyrics short-circuit the network; the "__none__" sentinel and
/// the null/"" markers control whether LRCLIB is (re)probed and the result cached.
/// </summary>
public class LyricsEndpointTests
{
    private const string SyncedLrc = "[00:01.00]hello\n[00:02.00]world";

    // Raw string literal → the backslash-n stays literal, i.e. a valid JSON \n escape
    // that deserializes back to SyncedLrc (a real newline).
    private const string LrclibSyncedJson =
        """[{"plainLyrics":"stale","syncedLyrics":"[00:01.00]hello\n[00:02.00]world","instrumental":false,"duration":180}]""";

    private static HttpResponseMessage Json(string body)
        => new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static TracksController Controller(NotSpotify.Api.Data.AppDbContext db, LyricsService lyrics)
        => new(db, TestHelpers.NewMapper(), lyrics, TestHelpers.NewAudioDownloads());

    private static LyricsService LrclibReturning(string json)
        => TestHelpers.NewLyrics(req => req.RequestUri!.Host.Contains("lrclib")
            ? Json(json)
            : throw new InvalidOperationException("should not reach Lyrics.ovh"));

    [Fact]
    public async Task GetLyrics_MissingOrUnapproved_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        db.AddTrack("Pending", artist, album, status: "pending");
        await db.SaveChangesAsync();
        var controller = Controller(db, TestHelpers.NewOfflineLyrics());

        Assert.IsType<NotFoundResult>((await controller.GetLyrics(Guid.NewGuid())).Result);
        var pendingId = db.Tracks.Single().Id;
        Assert.IsType<NotFoundResult>((await controller.GetLyrics(pendingId)).Result);
    }

    [Fact]
    public async Task GetLyrics_StoredPlainWithSentinelSynced_ReturnsStoredAndSkipsNetwork()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var track = db.AddTrack("Cached", artist, album);
        track.Lyrics = "cached plain lyrics";
        track.SyncedLyrics = "__none__"; // looked-up-and-missed sentinel
        await db.SaveChangesAsync();

        // Offline service throws if the sentinel fails to suppress the re-probe.
        var controller = Controller(db, TestHelpers.NewOfflineLyrics());
        var ok = Assert.IsType<OkObjectResult>((await controller.GetLyrics(track.Id)).Result);
        var dto = Assert.IsType<LyricsDto>(ok.Value);

        Assert.Equal("cached plain lyrics", dto.Lyrics);
        Assert.Null(dto.SyncedLyrics); // the sentinel maps to "no synced lyrics"
        Assert.Equal("stored", dto.Source);
    }

    [Fact]
    public async Task GetLyrics_StoredPlainNeverLookedUp_ProbesSyncedAndCachesIt()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var track = db.AddTrack("Legacy", artist, album);
        track.Lyrics = "legacy plain";
        track.SyncedLyrics = null; // never looked up
        await db.SaveChangesAsync();

        var controller = Controller(db, LrclibReturning(LrclibSyncedJson));

        var ok = Assert.IsType<OkObjectResult>((await controller.GetLyrics(track.Id)).Result);
        var dto = Assert.IsType<LyricsDto>(ok.Value);

        Assert.Equal(SyncedLrc, dto.SyncedLyrics);
        Assert.Equal("hello\nworld", dto.Lyrics); // re-derived from the synced text
        Assert.Equal("stored", dto.Source);

        var reloaded = await db.Tracks.AsNoTracking().FirstAsync(t => t.Id == track.Id);
        Assert.Equal(SyncedLrc, reloaded.SyncedLyrics); // cached for next time
        Assert.Equal("hello\nworld", reloaded.Lyrics);
    }

    [Fact]
    public async Task GetLyrics_LegacyEmptyMiss_ReprobesAndCachesNewlyFoundSynced()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var track = db.AddTrack("Recheck", artist, album);
        track.Lyrics = "plain";
        track.SyncedLyrics = ""; // legacy "looked up & missed" marker → re-probe once with the new scoring
        await db.SaveChangesAsync();

        var controller = Controller(db, LrclibReturning(LrclibSyncedJson));
        var ok = Assert.IsType<OkObjectResult>((await controller.GetLyrics(track.Id)).Result);
        var dto = Assert.IsType<LyricsDto>(ok.Value);

        Assert.Equal(SyncedLrc, dto.SyncedLyrics);
        var reloaded = await db.Tracks.AsNoTracking().FirstAsync(t => t.Id == track.Id);
        Assert.Equal(SyncedLrc, reloaded.SyncedLyrics); // upgraded from "" to the real synced text
    }

    [Fact]
    public async Task GetLyrics_CjkTitleWithRomanizedSynced_ReprobesForScriptMatch()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var track = db.AddTrack("ありがとう", artist, album); // CJK title
        track.Lyrics = "arigatou (romaji)";
        track.SyncedLyrics = "[00:01.00]arigatou"; // poisoned: romanized synced for a CJK title
        await db.SaveChangesAsync();

        // The re-probe returns a script-matching (original-script) synced version.
        var controller = Controller(db, LrclibReturning(
            """[{"plainLyrics":"ありがとう","syncedLyrics":"[00:01.00]ありがとう","instrumental":false,"duration":1}]"""));
        var ok = Assert.IsType<OkObjectResult>((await controller.GetLyrics(track.Id)).Result);
        var dto = Assert.IsType<LyricsDto>(ok.Value);

        Assert.NotNull(dto.SyncedLyrics);
        Assert.True(LyricsService.ContainsCjk(dto.SyncedLyrics!)); // replaced the romanized duplicate
        var reloaded = await db.Tracks.AsNoTracking().FirstAsync(t => t.Id == track.Id);
        Assert.True(LyricsService.ContainsCjk(reloaded.SyncedLyrics!));
    }

    [Fact]
    public async Task GetLyrics_StoredPlainNeverLookedUp_NoSyncedFound_WritesSentinel()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var track = db.AddTrack("Legacy", artist, album);
        track.Lyrics = "legacy plain";
        track.SyncedLyrics = null;
        await db.SaveChangesAsync();

        // Both providers miss (LRCLIB empty, Lyrics.ovh blank).
        var controller = Controller(db, TestHelpers.NewLyrics(req => req.RequestUri!.Host.Contains("lrclib")
            ? Json("[]")
            : Json("""{"lyrics":""}""")));

        var ok = Assert.IsType<OkObjectResult>((await controller.GetLyrics(track.Id)).Result);
        var dto = Assert.IsType<LyricsDto>(ok.Value);

        Assert.Null(dto.SyncedLyrics);
        Assert.Equal("legacy plain", dto.Lyrics); // kept the stored plain text

        var reloaded = await db.Tracks.AsNoTracking().FirstAsync(t => t.Id == track.Id);
        Assert.Equal("__none__", reloaded.SyncedLyrics); // sentinel so we don't re-probe forever
    }

    [Fact]
    public async Task GetLyrics_NoStoredLyrics_FetchesAndCachesBoth()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var track = db.AddTrack("Fresh", artist, album);
        track.Lyrics = null;
        track.SyncedLyrics = null;
        await db.SaveChangesAsync();

        var controller = Controller(db, LrclibReturning(LrclibSyncedJson));

        var ok = Assert.IsType<OkObjectResult>((await controller.GetLyrics(track.Id)).Result);
        var dto = Assert.IsType<LyricsDto>(ok.Value);

        Assert.Equal("lrclib", dto.Source);
        Assert.Equal(SyncedLrc, dto.SyncedLyrics);

        var reloaded = await db.Tracks.AsNoTracking().FirstAsync(t => t.Id == track.Id);
        Assert.False(string.IsNullOrWhiteSpace(reloaded.Lyrics)); // cached
        Assert.Equal(SyncedLrc, reloaded.SyncedLyrics);
    }

    [Fact]
    public async Task GetLyrics_NoStoredLyrics_ProviderMiss_ReturnsNotFoundDto()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var track = db.AddTrack("Obscure", artist, album);
        track.Lyrics = null;
        track.SyncedLyrics = null;
        await db.SaveChangesAsync();

        var controller = Controller(db, TestHelpers.NewLyrics(req => req.RequestUri!.Host.Contains("lrclib")
            ? Json("[]")
            : Json("""{"lyrics":""}""")));

        var ok = Assert.IsType<OkObjectResult>((await controller.GetLyrics(track.Id)).Result);
        var dto = Assert.IsType<LyricsDto>(ok.Value);

        Assert.Null(dto.Lyrics);
        Assert.Null(dto.SyncedLyrics);
        Assert.Equal("not_found", dto.Source);
    }
}
