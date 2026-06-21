using System.Net;
using System.Text;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// LyricsService is exercised through a faked IHttpClientFactory so the provider
/// chain (LRCLIB search → Lyrics.ovh), candidate scoring, and the synced/plain
/// derivation are tested without any real network calls.
/// </summary>
public class LyricsServiceTests
{
    private static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK)
        => new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static bool IsLrclib(HttpRequestMessage req) => req.RequestUri!.Host.Contains("lrclib");

    // ── Pure helpers ────────────────────────────────────────────────────────────────

    [Fact]
    public void StripLrcTimestamps_RemovesTimedPrefixes_AndTrims()
    {
        var lrc = "[00:01.00]hello\n[00:02.50]world\n[01:00.123] end ";
        Assert.Equal("hello\nworld\nend", LyricsService.StripLrcTimestamps(lrc));
    }

    [Theory]
    [InlineData("ありがとう", true)]   // hiragana
    [InlineData("感謝", true)]         // CJK ideographs
    [InlineData("감사합니다", true)]    // hangul
    [InlineData("Thank you", false)]   // latin
    public void ContainsCjk_DetectsAsianScripts(string text, bool expected)
        => Assert.Equal(expected, LyricsService.ContainsCjk(text));

    // ── Provider chain ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task TryFetch_BlankArtistOrTitle_ReturnsNullWithoutNetwork()
    {
        var svc = TestHelpers.NewOfflineLyrics(); // throws if the network is touched
        Assert.Null(await svc.TryFetchAsync("", "Song", 1000));
        Assert.Null(await svc.TryFetchAsync("Artist", "  ", 1000));
    }

    [Fact]
    public async Task TryFetch_LrclibSynced_PrefersTimedVersionAndDerivesPlain()
    {
        var svc = TestHelpers.NewLyrics(req => IsLrclib(req)
            ? Json("""[{"plainLyrics":"stale plain","syncedLyrics":"[00:01.00]hello\n[00:02.00]world","instrumental":false,"duration":180}]""")
            : throw new InvalidOperationException("should not reach Lyrics.ovh"));

        var result = await svc.TryFetchAsync("Artist", "Song", 180_000);

        Assert.NotNull(result);
        Assert.Equal("lrclib", result!.Source);
        Assert.Equal("[00:01.00]hello\n[00:02.00]world", result.SyncedLyrics);
        Assert.Equal("hello\nworld", result.Lyrics); // derived from the synced text, not "stale plain"
    }

    [Fact]
    public async Task TryFetch_LrclibPlainOnly_ReturnsPlainWithNullSynced()
    {
        var svc = TestHelpers.NewLyrics(req => IsLrclib(req)
            ? Json("""[{"plainLyrics":"just the words","syncedLyrics":null,"instrumental":false,"duration":180}]""")
            : throw new InvalidOperationException("should not reach Lyrics.ovh"));

        var result = await svc.TryFetchAsync("Artist", "Song", 180_000);

        Assert.NotNull(result);
        Assert.Equal("lrclib", result!.Source);
        Assert.Null(result.SyncedLyrics);
        Assert.Equal("just the words", result.Lyrics);
    }

    [Fact]
    public async Task TryFetch_LrclibInstrumental_FallsBackToLyricsOvh()
    {
        var svc = TestHelpers.NewLyrics(req => IsLrclib(req)
            ? Json("""[{"plainLyrics":null,"syncedLyrics":null,"instrumental":true,"duration":180}]""")
            : Json("""{"lyrics":"ovh fallback words"}"""));

        var result = await svc.TryFetchAsync("Artist", "Song", 180_000);

        Assert.NotNull(result);
        Assert.Equal("lyrics_ovh", result!.Source);
        Assert.Null(result.SyncedLyrics);
        Assert.Equal("ovh fallback words", result.Lyrics);
    }

    [Fact]
    public async Task TryFetch_LrclibEmptyList_FallsBackToLyricsOvh()
    {
        var svc = TestHelpers.NewLyrics(req => IsLrclib(req)
            ? Json("[]")
            : Json("""{"lyrics":"ovh words"}"""));

        var result = await svc.TryFetchAsync("Artist", "Song", 180_000);

        Assert.Equal("lyrics_ovh", result!.Source);
    }

    [Fact]
    public async Task TryFetch_BothProvidersMiss_ReturnsNull()
    {
        var svc = TestHelpers.NewLyrics(req => IsLrclib(req)
            ? Json("[]")
            : Json("""{"lyrics":""}"""));

        Assert.Null(await svc.TryFetchAsync("Artist", "Song", 180_000));
    }

    [Fact]
    public async Task TryFetch_NetworkError_IsSwallowedAsAMiss()
    {
        var svc = TestHelpers.NewLyrics(_ => throw new HttpRequestException("boom"));
        Assert.Null(await svc.TryFetchAsync("Artist", "Song", 180_000));
    }

    [Fact]
    public async Task TryFetch_CjkTitle_PrefersScriptMatchOverCloserDuration()
    {
        // Two LRCLIB candidates for a Japanese title: a romanized plain version whose
        // duration matches exactly, and a script-matching synced version that is off
        // by 30s. Script match (+3) + synced (+4) must outrank the duration bonus (+2).
        var svc = TestHelpers.NewLyrics(req => IsLrclib(req)
            ? Json("""
                [
                  {"plainLyrics":"arigatou romanized","syncedLyrics":null,"instrumental":false,"duration":180},
                  {"plainLyrics":"ありがとう plain","syncedLyrics":"[00:01.00]ありがとう","instrumental":false,"duration":210}
                ]
                """)
            : throw new InvalidOperationException("should not reach Lyrics.ovh"));

        var result = await svc.TryFetchAsync("Artist", "ありがとう", 180_000);

        Assert.NotNull(result);
        Assert.Equal("lrclib", result!.Source);
        Assert.True(LyricsService.ContainsCjk(result.Lyrics)); // picked the original-script entry
        Assert.NotNull(result.SyncedLyrics);
    }
}
