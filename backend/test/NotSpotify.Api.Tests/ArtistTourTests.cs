using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Artist self-management of tour dates + setlists (owner-scoped via the
/// artist's own <c>ArtistId</c>; a setlist may only contain the artist's own
/// tracks) and the public <c>GET /artists/{id}/tour</c> read.
/// </summary>
public class ArtistTourTests
{
    private static MeController NewMeController(NotSpotify.Api.Data.AppDbContext db, ApplicationUser me)
    {
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByIdAsync(me.Id.ToString())).ReturnsAsync(me);

        var lyrics = new LyricsService(new Mock<IHttpClientFactory>().Object, NullLogger<LyricsService>.Instance);
        var waveforms = new AudioWaveformService(new Mock<IStorageService>().Object, NullLogger<AudioWaveformService>.Instance);

        return new MeController(db, TestHelpers.NewMapper(), users.Object,
            new Mock<IStorageService>().Object, lyrics, NullLogger<MeController>.Instance, waveforms)
            .AsUser(me.Id, "Artist");
    }

    private static ApplicationUser Artist(Guid userId, Guid artistId)
        => new() { Id = userId, Name = "artist", Email = "artist@test", UserName = "artist@test", ArtistId = artistId };

    private static Track OwnTrack(Guid artistId, Artist artist, string title)
        => new() { Id = Guid.NewGuid(), Title = title, ArtistId = artistId, Artist = artist, DurationMs = 1000 };

    [Fact]
    public async Task GetArtistTour_WhenNotAnArtist_ReturnsForbid()
    {
        await using var db = TestHelpers.NewDb();
        var me = new ApplicationUser { Id = Guid.NewGuid(), Name = "u", Email = "u@test", UserName = "u@test", ArtistId = null };
        var controller = NewMeController(db, me);

        var result = await controller.GetArtistTour();

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task CreateArtistTourDate_MissingVenue_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        var me = Artist(Guid.NewGuid(), artistId);
        db.Artists.Add(new Artist { Id = artistId, Name = "artist" });
        await db.SaveChangesAsync();
        var controller = NewMeController(db, me);

        var result = await controller.CreateArtistTourDate(
            new TourDateUpsertRequest(DateTime.UtcNow.AddDays(30), City: "KL", Venue: "", Country: "MY", TicketUrl: null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(db.TourDates);
    }

    [Fact]
    public async Task CreateArtistTourDate_NormalizesTicketUrlAndCountry()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        var me = Artist(Guid.NewGuid(), artistId);
        db.Artists.Add(new Artist { Id = artistId, Name = "artist" });
        await db.SaveChangesAsync();
        var controller = NewMeController(db, me);

        var result = await controller.CreateArtistTourDate(
            new TourDateUpsertRequest(DateTime.UtcNow.AddDays(30), City: " KL ", Venue: " Arena ", Country: "my", TicketUrl: "tickets.example/show"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<TourDateDto>(ok.Value);
        Assert.Equal("KL", dto.City);                                  // trimmed
        Assert.Equal("Arena", dto.Venue);
        Assert.Equal("MY", dto.Country);                               // upper-cased ISO
        Assert.Equal("https://tickets.example/show", dto.TicketUrl);   // scheme added
        Assert.Single(db.TourDates);
    }

    [Fact]
    public async Task UpdateArtistTourDate_AnotherArtistsDate_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var myArtistId = Guid.NewGuid();
        var otherArtistId = Guid.NewGuid();
        var me = Artist(Guid.NewGuid(), myArtistId);
        var foreign = new TourDate { ArtistId = otherArtistId, City = "NYC", Venue = "MSG", EventDate = DateTime.UtcNow.AddDays(10) };
        db.TourDates.Add(foreign);
        await db.SaveChangesAsync();
        var controller = NewMeController(db, me);

        var result = await controller.UpdateArtistTourDate(foreign.Id,
            new TourDateUpsertRequest(DateTime.UtcNow.AddDays(11), "NYC", "MSG", "US", null));

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task SetArtistTourSetlist_KeepsOnlyOwnTracks_DedupedAndOrdered()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        var artist = new Artist { Id = artistId, Name = "artist" };
        var me = Artist(Guid.NewGuid(), artistId);
        var otherArtist = new Artist { Id = Guid.NewGuid(), Name = "other" };

        var mine1 = OwnTrack(artistId, artist, "Mine A");
        var mine2 = OwnTrack(artistId, artist, "Mine B");
        var foreign = OwnTrack(otherArtist.Id, otherArtist, "Not Mine");

        var date = new TourDate { ArtistId = artistId, City = "KL", Venue = "Arena", EventDate = DateTime.UtcNow.AddDays(5) };
        db.Artists.AddRange(artist, otherArtist);
        db.Tracks.AddRange(mine1, mine2, foreign);
        db.TourDates.Add(date);
        await db.SaveChangesAsync();
        var controller = NewMeController(db, me);

        // Request order: mine2, foreign (dropped), mine1, mine2 (dup dropped).
        var result = await controller.SetArtistTourSetlist(date.Id,
            new TourSetlistRequest(new[] { mine2.Id.ToString(), foreign.Id.ToString(), mine1.Id.ToString(), mine2.Id.ToString() }));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<TourDateDto>(ok.Value);
        Assert.Equal(new[] { mine2.Id.ToString(), mine1.Id.ToString() }, dto.Songs.Select(s => s.TrackId).ToArray());
        Assert.DoesNotContain(foreign.Id.ToString(), dto.Songs.Select(s => s.TrackId));
    }

    [Fact]
    public async Task PublicTour_ReturnsOnlyFutureDates_WithOrderedSetlist()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        var artist = new Artist { Id = artistId, Name = "artist" };
        var track = OwnTrack(artistId, artist, "Hit");

        var past = new TourDate { ArtistId = artistId, City = "Old", Venue = "Past", EventDate = DateTime.UtcNow.AddDays(-1) };
        var future = new TourDate { ArtistId = artistId, City = "KL", Venue = "Arena", EventDate = DateTime.UtcNow.AddDays(5) };
        future.Setlist.Add(new TourDateTrack { TrackId = track.Id, Track = track, Position = 0 });

        db.Artists.Add(artist);
        db.Tracks.Add(track);
        db.TourDates.AddRange(past, future);
        await db.SaveChangesAsync();

        var controller = new ArtistsController(db, TestHelpers.NewMapper());
        var result = await controller.Tour(artistId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dates = Assert.IsAssignableFrom<IEnumerable<TourDateDto>>(ok.Value).ToList();
        var only = Assert.Single(dates);          // the past show is excluded
        Assert.Equal("KL", only.City);
        Assert.Equal("Hit", Assert.Single(only.Songs).Title);
    }

    private static string TmEventJson(string attraction, string venue, string city, string country, DateTime whenUtc)
        => $$"""
        { "_embedded": { "events": [ {
            "id": "E1",
            "url": "https://tm.test/e1",
            "dates": { "start": { "dateTime": "{{whenUtc:yyyy-MM-ddTHH:mm:ssZ}}" } },
            "_embedded": {
              "attractions": [ { "name": "{{attraction}}" } ],
              "venues": [ { "name": "{{venue}}", "city": { "name": "{{city}}" }, "country": { "countryCode": "{{country}}" } } ]
            }
        } ] } }
        """;

    [Fact]
    public async Task SyncArtist_CachesTicketmasterRows_AndStampsSyncedAt()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        db.Artists.Add(new Artist { Id = artistId, Name = "Metallica" });
        await db.SaveChangesAsync();

        var when = DateTime.UtcNow.AddDays(10);
        var tm = TestHelpers.NewTicketmaster(TmEventJson("Metallica", "Stadium", "London", "GB", when));
        var sync = TestHelpers.NewTourSync(db, tm);

        var ran = await sync.SyncArtistAsync(artistId, force: true);

        Assert.True(ran);
        var cached = Assert.Single(db.TourDates.Where(t => t.ArtistId == artistId));
        Assert.Equal("ticketmaster", cached.Source);
        Assert.Equal("tm:E1", cached.ExternalId);
        Assert.Equal("Stadium", cached.Venue);
        Assert.Equal("GB", cached.Country);
        Assert.NotNull(db.Artists.Single(a => a.Id == artistId).TourSyncedAt);
    }

    [Fact]
    public async Task SyncArtist_RespectsTtl_WhenNotForced()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        db.Artists.Add(new Artist { Id = artistId, Name = "Metallica", TourSyncedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var tm = TestHelpers.NewTicketmaster(TmEventJson("Metallica", "Stadium", "London", "GB", DateTime.UtcNow.AddDays(10)));
        var ran = await TestHelpers.NewTourSync(db, tm).SyncArtistAsync(artistId, force: false);

        Assert.False(ran);                                  // synced just now → skipped
        Assert.Empty(db.TourDates.Where(t => t.ArtistId == artistId));
    }

    [Fact]
    public async Task SyncArtist_ReplacesStaleCache_WithoutTouchingArtistRows()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        db.Artists.Add(new Artist { Id = artistId, Name = "Metallica" });
        // An artist-authored row and a stale cached TM row.
        db.TourDates.Add(new TourDate { ArtistId = artistId, Source = "artist", City = "KL", Venue = "Mine", EventDate = DateTime.UtcNow.AddDays(3) });
        db.TourDates.Add(new TourDate { ArtistId = artistId, Source = "ticketmaster", ExternalId = "OLD", City = "Gone", Venue = "Old", EventDate = DateTime.UtcNow.AddDays(4) });
        await db.SaveChangesAsync();

        var tm = TestHelpers.NewTicketmaster(TmEventJson("Metallica", "Stadium", "London", "GB", DateTime.UtcNow.AddDays(10)));
        await TestHelpers.NewTourSync(db, tm).SyncArtistAsync(artistId, force: true);

        var rows = db.TourDates.Where(t => t.ArtistId == artistId).ToList();
        Assert.Contains(rows, r => r.Source == "artist" && r.Venue == "Mine");   // untouched
        Assert.DoesNotContain(rows, r => r.ExternalId == "OLD");                  // stale TM row pruned
        Assert.Contains(rows, r => r.Source == "ticketmaster" && r.ExternalId == "tm:E1");
    }

    [Fact]
    public async Task PublicTour_ArtistRowWins_OverCollidingCachedRow()
    {
        await using var db = TestHelpers.NewDb();
        var artistId = Guid.NewGuid();
        var artist = new Artist { Id = artistId, Name = "artist" };
        var track = OwnTrack(artistId, artist, "Hit");
        var when = DateTime.UtcNow.AddDays(5);

        // Same day + venue from both sources; only the artist's (with setlist) should show.
        var mine = new TourDate { ArtistId = artistId, Source = "artist", City = "KL", Venue = "Arena", EventDate = when };
        mine.Setlist.Add(new TourDateTrack { TrackId = track.Id, Track = track, Position = 0 });
        var cached = new TourDate { ArtistId = artistId, Source = "ticketmaster", ExternalId = "E1", City = "KL", Venue = "Arena", EventDate = when.AddHours(1), TicketUrl = "https://tm.test/e1" };

        db.Artists.Add(artist);
        db.Tracks.Add(track);
        db.TourDates.AddRange(mine, cached);
        await db.SaveChangesAsync();

        var result = await new ArtistsController(db, TestHelpers.NewMapper()).Tour(artistId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var only = Assert.Single(Assert.IsAssignableFrom<IEnumerable<TourDateDto>>(ok.Value));
        Assert.Equal("Hit", Assert.Single(only.Songs).Title);   // it's the artist row
    }
}
