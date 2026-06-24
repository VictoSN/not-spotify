using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Ranking correctness + empty/guest fallbacks for the discovery endpoints on
/// TracksController. Each test builds a tiny catalogue + play history in an
/// InMemory db and asserts the produced order, never touching the network or the
/// shared Postgres. (LyricsService/AudioDownloadService are passed but unused
/// here; the lyrics service is an offline double so an accidental fetch throws.)
/// </summary>
public class RecommendationEndpointsTests
{
    private static TracksController Controller(NotSpotify.Api.Data.AppDbContext db)
        => new(db, TestHelpers.NewMapper(), TestHelpers.NewOfflineLyrics(), TestHelpers.NewAudioDownloads());

    private static List<TrackDto> Ok(ActionResult<IEnumerable<TrackDto>> action)
    {
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        return Assert.IsAssignableFrom<IEnumerable<TrackDto>>(ok.Value).ToList();
    }

    // ── Charts ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Charts_RanksByWeeklyPlays_ThenPadsWithAllTimeTopAtZero()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var listener = db.AddUser(Guid.NewGuid(), "listener");
        var hot = db.AddTrack("Hot", artist, album, playCount: 5);
        var warm = db.AddTrack("Warm", artist, album, playCount: 5);
        var cold = db.AddTrack("Cold", artist, album, playCount: 999); // big all-time, no recent
        db.AddPlay(listener, hot, daysAgo: 1);
        db.AddPlay(listener, hot, daysAgo: 2);
        db.AddPlay(listener, hot, daysAgo: 3);
        db.AddPlay(listener, warm, daysAgo: 1);
        await db.SaveChangesAsync();

        var action = await Controller(db).Charts();
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var entries = Assert.IsAssignableFrom<IEnumerable<ChartEntryDto>>(ok.Value).ToList();

        Assert.Equal(3, entries.Count);
        Assert.Equal(hot.Id, entries[0].Track.Id);
        Assert.Equal(3, entries[0].PlaysThisWeek);
        Assert.Equal(1, entries[0].Rank);
        Assert.Equal(warm.Id, entries[1].Track.Id);
        Assert.Equal(1, entries[1].PlaysThisWeek);
        // Padded with the all-time top track that had no plays this week.
        Assert.Equal(cold.Id, entries[2].Track.Id);
        Assert.Equal(0, entries[2].PlaysThisWeek);
        Assert.Equal(3, entries[2].Rank);
    }

    // ── Trending ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Trending_WeightsRecentPlaysOverAllTimeAndExcludesUnapproved()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var listener = db.AddUser(Guid.NewGuid(), "listener");
        var viral = db.AddTrack("Viral", artist, album, playCount: 10);      // 5×3 + 10×0.01 = 15.1
        var classic = db.AddTrack("Classic", artist, album, playCount: 1000); // 0 + 1000×0.01 = 10
        var hidden = db.AddTrack("Hidden", artist, album, playCount: 99999, status: "pending");
        for (var i = 0; i < 5; i++) db.AddPlay(listener, viral, daysAgo: 1);
        await db.SaveChangesAsync();

        var dtos = Ok(await Controller(db).Trending());

        Assert.Equal(viral.Id, dtos[0].Id);
        Assert.Equal(classic.Id, dtos[1].Id);
        Assert.DoesNotContain(dtos, d => d.Id == hidden.Id); // pending never surfaces
    }

    // ── Most liked ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task MostLiked_RanksByConfidenceWeightedScore_AndExcludesUnderTwoRatings()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var crowd = db.AddTrack("Crowd favourite", artist, album, ratingCount: 100, ratingSum: 480); // 4.8 × log2(101)
        var niche = db.AddTrack("Niche", artist, album, ratingCount: 2, ratingSum: 10);              // 5.0 × log2(3)
        var single = db.AddTrack("Single vote", artist, album, ratingCount: 1, ratingSum: 5);        // excluded (<2)
        await db.SaveChangesAsync();

        var dtos = Ok(await Controller(db).MostLiked());

        Assert.Equal(2, dtos.Count);
        Assert.Equal(crowd.Id, dtos[0].Id); // confidence correction beats a perfect 2-vote average
        Assert.Equal(niche.Id, dtos[1].Id);
        Assert.DoesNotContain(dtos, d => d.Id == single.Id);
    }

    // ── New music ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task NewMusic_OrdersByCreatedAtDescending()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var newest = db.AddTrack("Newest", artist, album, daysOld: 1);
        var middle = db.AddTrack("Middle", artist, album, daysOld: 5);
        var oldest = db.AddTrack("Oldest", artist, album, daysOld: 30);
        await db.SaveChangesAsync();

        var dtos = Ok(await Controller(db).NewMusic());

        Assert.Equal(new[] { newest.Id, middle.Id, oldest.Id }, dtos.Select(d => d.Id).ToArray());
    }

    // ── For You ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ForYou_Guest_FallsBackToTrending()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var top = db.AddTrack("Top", artist, album, playCount: 500);
        await db.SaveChangesAsync();

        // Guest (anonymous principal) → fallback path.
        var dtos = Ok(await Controller(db).AsGuest().ForYou());

        Assert.Contains(dtos, d => d.Id == top.Id);
    }

    [Fact]
    public async Task ForYou_WithHistory_RecommendsSharedGenre_ExcludesRecentlyPlayed()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var rock = db.AddGenre("Rock", "rock");
        var pop = db.AddGenre("Pop", "pop");
        var me = db.AddUser(Guid.NewGuid(), "me");

        var seed = db.AddTrack("Seed (played)", artist, album, playCount: 1);
        var rockMatch = db.AddTrack("Rock match", artist, album, playCount: 10);
        var popOther = db.AddTrack("Pop other", artist, album, playCount: 999);
        db.Tag(seed, rock);
        db.Tag(rockMatch, rock);
        db.Tag(popOther, pop);
        db.AddPlay(me, seed, daysAgo: 1);
        await db.SaveChangesAsync();

        var controller = Controller(db).AsUser(me.Id);
        var dtos = Ok(await controller.ForYou());

        var single = Assert.Single(dtos);
        Assert.Equal(rockMatch.Id, single.Id); // shares the user's genre
        Assert.DoesNotContain(dtos, d => d.Id == seed.Id);    // recently played excluded
        Assert.DoesNotContain(dtos, d => d.Id == popOther.Id); // unshared genre excluded
    }

    [Fact]
    public async Task ForYou_AuthenticatedButNoHistory_FallsBackToTrending()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var me = db.AddUser(Guid.NewGuid(), "me");
        var top = db.AddTrack("Top", artist, album, playCount: 500);
        await db.SaveChangesAsync();

        var controller = Controller(db).AsUser(me.Id);
        var dtos = Ok(await controller.ForYou());

        Assert.Contains(dtos, d => d.Id == top.Id);
    }

    // ── Popular in country ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Popular_RanksByInCountryPlays_ThenPadsWithMarketThenGlobal()
    {
        await using var db = TestHelpers.NewDb();
        var (gbArtist, gbAlbum) = db.AddArtistAlbum("Brit", country: "GB");
        var (usArtist, usAlbum) = db.AddArtistAlbum("Yank", country: "US");
        var gbUser = db.AddUser(Guid.NewGuid(), "gb");
        gbUser.Country = "GB";

        var played = db.AddTrack("Played in GB", usArtist, usAlbum, playCount: 1);
        var gbTagged = db.AddTrack("GB tagged, unplayed", gbArtist, gbAlbum, playCount: 1);
        var global = db.AddTrack("Global filler", usArtist, usAlbum, playCount: 9999);
        db.AddPlay(gbUser, played, daysAgo: 1);
        db.AddPlay(gbUser, played, daysAgo: 2);
        await db.SaveChangesAsync();

        var dtos = Ok(await Controller(db).Popular(country: "gb")); // lower-case → normalised

        Assert.Equal(played.Id, dtos[0].Id);    // most GB plays
        Assert.Equal(gbTagged.Id, dtos[1].Id);  // padded from the GB market next
        Assert.Equal(global.Id, dtos[2].Id);    // global top last
    }

    [Fact]
    public async Task Popular_MarketBoost_BreaksTieAheadOfEqualPlayCount()
    {
        await using var db = TestHelpers.NewDb();
        var (gbArtist, gbAlbum) = db.AddArtistAlbum("Brit", country: "GB");
        var (usArtist, usAlbum) = db.AddArtistAlbum("Yank", country: "US");
        var gbUser = db.AddUser(Guid.NewGuid(), "gb");
        gbUser.Country = "GB";

        var boosted = db.AddTrack("GB-tagged", gbArtist, gbAlbum, playCount: 1);  // 2 plays + 0.5 boost
        var plain = db.AddTrack("Untagged", usArtist, usAlbum, playCount: 1);     // 2 plays, no boost
        db.AddPlay(gbUser, boosted, daysAgo: 1);
        db.AddPlay(gbUser, boosted, daysAgo: 2);
        db.AddPlay(gbUser, plain, daysAgo: 1);
        db.AddPlay(gbUser, plain, daysAgo: 2);
        await db.SaveChangesAsync();

        var dtos = Ok(await Controller(db).Popular(country: "GB"));

        Assert.Equal(boosted.Id, dtos[0].Id);
    }

    [Fact]
    public async Task Popular_Guest_DefaultsToUsMarket()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum("Yank", country: "US");
        var usUser = db.AddUser(Guid.NewGuid(), "us");
        usUser.Country = "US";
        var track = db.AddTrack("US hit", artist, album, playCount: 1);
        db.AddPlay(usUser, track, daysAgo: 1);
        await db.SaveChangesAsync();

        // No country param and no caller → defaults to US.
        var dtos = Ok(await Controller(db).AsGuest().Popular());

        Assert.Equal(track.Id, dtos[0].Id);
    }

    [Fact]
    public async Task Popular_NoCountryParam_RanksByTheAuthenticatedCallersCountry()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var frUser = db.AddUser(Guid.NewGuid(), "fr");
        frUser.Country = "FR";
        var frHit = db.AddTrack("FR hit", artist, album, playCount: 1);
        var globalHit = db.AddTrack("Global", artist, album, playCount: 9999);
        db.AddPlay(frUser, frHit, daysAgo: 1);
        db.AddPlay(frUser, frHit, daysAgo: 2);
        await db.SaveChangesAsync();

        // No country param → the endpoint resolves the caller's own country (FR).
        var dtos = Ok(await Controller(db).AsUser(frUser.Id).Popular());

        Assert.Equal(frHit.Id, dtos[0].Id); // FR plays win over the higher global play count
    }

    // ── Song radio ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Radio_UnknownSeed_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var action = await Controller(db).Radio(Guid.NewGuid());
        Assert.IsType<NotFoundResult>(action.Result);
    }

    [Fact]
    public async Task Radio_ReturnsSeedFirst_AndStaysInTheGenreBubble()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum("Main");
        var (other, otherAlbum) = db.AddArtistAlbum("Other");
        var rock = db.AddGenre("Rock", "rock");
        var pop = db.AddGenre("Pop", "pop");

        var seed = db.AddTrack("Seed", artist, album, playCount: 1);
        var sameArtist = db.AddTrack("Same artist", artist, album, playCount: 1);
        var sameGenre = db.AddTrack("Same genre", other, otherAlbum, playCount: 1);
        var unrelated = db.AddTrack("Unrelated", other, otherAlbum, playCount: 999); // huge plays, wrong genre
        db.Tag(seed, rock);
        db.Tag(sameGenre, rock);
        db.Tag(unrelated, pop);
        await db.SaveChangesAsync();

        var dtos = Ok(await Controller(db).Radio(seed.Id));

        Assert.Equal(seed.Id, dtos[0].Id); // station always starts with the seed
        var ids = dtos.Select(d => d.Id).ToList();
        Assert.Contains(sameGenre.Id, ids);  // shares the seed's genre
        Assert.Contains(sameArtist.Id, ids); // same artist is the same bubble
        // A different-genre track never jumps into the bubble — even with 999 plays.
        Assert.DoesNotContain(dtos, d => d.Id == unrelated.Id);
        Assert.True(ids.IndexOf(sameGenre.Id) < ids.IndexOf(sameArtist.Id)); // genre match beats genre-less same-artist
    }

    [Fact]
    public async Task Radio_WithinGenre_RanksCoListenedAboveGenreOnly()
    {
        await using var db = TestHelpers.NewDb();
        var (a1, al1) = db.AddArtistAlbum("Seed artist");
        var (a2, al2) = db.AddArtistAlbum("Other artist");
        var g1 = db.AddGenre("G1", "g1");
        var u1 = db.AddUser(Guid.NewGuid(), "u1");
        var u2 = db.AddUser(Guid.NewGuid(), "u2");

        var seed = db.AddTrack("Seed", a1, al1);
        var coListened = db.AddTrack("Co-listened", a2, al2); // same genre AND co-played
        var genreOnly = db.AddTrack("Genre only", a2, al2);   // same genre, never co-played
        db.Tag(seed, g1);
        db.Tag(coListened, g1);
        db.Tag(genreOnly, g1);
        // Everyone who played the seed also played the co-listened track.
        db.AddPlay(u1, seed); db.AddPlay(u1, coListened);
        db.AddPlay(u2, seed); db.AddPlay(u2, coListened);
        await db.SaveChangesAsync();

        var dtos = Ok(await Controller(db).Radio(seed.Id));

        Assert.Equal(seed.Id, dtos[0].Id);
        var ids = dtos.Select(d => d.Id).ToList();
        // Both sit in the seed's genre bubble; the co-listened one ("listeners like
        // you also played") ranks higher within it.
        Assert.True(ids.IndexOf(coListened.Id) < ids.IndexOf(genreOnly.Id));
    }

    // ── Daily mixes ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DailyMixes_Guest_FallsBackToBiggestCatalogueGenres()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var rock = db.AddGenre("Rock", "rock");
        var pop = db.AddGenre("Pop", "pop");
        var r1 = db.AddTrack("R1", artist, album);
        var r2 = db.AddTrack("R2", artist, album);
        var p1 = db.AddTrack("P1", artist, album);
        db.Tag(r1, rock);
        db.Tag(r2, rock);
        db.Tag(p1, pop);
        await db.SaveChangesAsync();

        var action = await Controller(db).AsGuest().DailyMixes();
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var mixes = Assert.IsAssignableFrom<IEnumerable<DailyMixDto>>(ok.Value).ToList();

        var rockMix = Assert.Single(mixes, m => m.Id == "rock");
        Assert.Equal(2, rockMix.Tracks.Count());
        Assert.Contains(mixes, m => m.Id == "pop");
    }

    [Fact]
    public async Task DailyMixes_WithHistory_BuildsMixesFromTheUsersTopGenres()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var rock = db.AddGenre("Rock", "rock");
        var pop = db.AddGenre("Pop", "pop");
        var me = db.AddUser(Guid.NewGuid(), "me");
        var rockTrack = db.AddTrack("Rock", artist, album);
        var popTrack = db.AddTrack("Pop", artist, album);
        db.Tag(rockTrack, rock);
        db.Tag(popTrack, pop);
        db.AddPlay(me, rockTrack, daysAgo: 1); // only rock in history
        await db.SaveChangesAsync();

        var controller = Controller(db).AsUser(me.Id);
        var action = await controller.DailyMixes();
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var mixes = Assert.IsAssignableFrom<IEnumerable<DailyMixDto>>(ok.Value).ToList();

        var mix = Assert.Single(mixes);
        Assert.Equal("rock", mix.Id);
        Assert.All(mix.Tracks, t => Assert.Equal(rockTrack.Id, t.Id));
    }

    // ── Discover Weekly ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DiscoverWeekly_Guest_FallsBackToTrending()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var top = db.AddTrack("Top", artist, album, playCount: 500);
        await db.SaveChangesAsync();

        var dtos = Ok(await Controller(db).AsGuest().DiscoverWeekly());

        Assert.Contains(dtos, d => d.Id == top.Id);
    }

    [Fact]
    public async Task DiscoverWeekly_RanksOverlappingPeersPicksFirst()
    {
        await using var db = TestHelpers.NewDb();
        var (artist, album) = db.AddArtistAlbum();
        var me = db.AddUser(Guid.NewGuid(), "me");
        var peer = db.AddUser(Guid.NewGuid(), "peer");

        var shared = db.AddTrack("Shared", artist, album, playCount: 1);
        var recommendation = db.AddTrack("Peer pick", artist, album, playCount: 1);
        db.AddPlay(me, shared, daysAgo: 2);
        db.AddPlay(peer, shared, daysAgo: 2);     // overlap → peer counts
        db.AddPlay(peer, recommendation, daysAgo: 2); // new to me
        await db.SaveChangesAsync();

        var controller = Controller(db).AsUser(me.Id);
        var dtos = Ok(await controller.DiscoverWeekly());

        // The collaborative candidate (a peer's pick I haven't heard) ranks first.
        // ("shared" can still reappear lower down via the trending padding that
        // fills a short list, but it is never a collaborative recommendation.)
        Assert.Equal(recommendation.Id, dtos[0].Id);
        var ids = dtos.Select(d => d.Id).ToList();
        var sharedIdx = ids.IndexOf(shared.Id);
        Assert.True(sharedIdx == -1 || sharedIdx > ids.IndexOf(recommendation.Id));
    }
}
