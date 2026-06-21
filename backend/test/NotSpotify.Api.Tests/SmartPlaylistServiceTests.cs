using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class SmartPlaylistServiceTests
{
    [Fact]
    public void Validate_RejectsEmptyAndOutOfRangeRules()
    {
        Assert.NotNull(SmartPlaylistService.Validate(new SmartPlaylistRulesDto()));
        Assert.NotNull(SmartPlaylistService.Validate(new SmartPlaylistRulesDto(MinimumRating: 6)));
        Assert.NotNull(SmartPlaylistService.Validate(new SmartPlaylistRulesDto(AddedWithinDays: 0)));
        Assert.Null(SmartPlaylistService.Validate(new SmartPlaylistRulesDto(Genre: "rock")));
    }

    [Fact]
    public async Task ResolveAsync_AppliesAllRulesAndOrdersMatches()
    {
        await using var db = TestHelpers.NewDb();
        var artist = new Artist { Id = Guid.NewGuid(), Name = "Artist" };
        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = "Album",
            Artist = artist,
            ArtistId = artist.Id,
            CoverUrl = "",
            ReleaseDate = DateOnly.FromDateTime(DateTime.UtcNow),
        };
        var rock = new Genre { Id = Guid.NewGuid(), Name = "Rock", Slug = "rock", Color = "#000" };
        var matching = NewTrack("Matching", artist, album, playCount: 50, ratingCount: 2, ratingSum: 9, daysOld: 2);
        var lowRated = NewTrack("Low rated", artist, album, playCount: 100, ratingCount: 2, ratingSum: 5, daysOld: 1);
        var old = NewTrack("Old", artist, album, playCount: 200, ratingCount: 2, ratingSum: 10, daysOld: 90);
        db.AddRange(artist, album, rock, matching, lowRated, old);
        db.TrackGenres.AddRange(
            new TrackGenre { Track = matching, TrackId = matching.Id, Genre = rock, GenreId = rock.Id },
            new TrackGenre { Track = lowRated, TrackId = lowRated.Id, Genre = rock, GenreId = rock.Id },
            new TrackGenre { Track = old, TrackId = old.Id, Genre = rock, GenreId = rock.Id });
        await db.SaveChangesAsync();

        var rules = new SmartPlaylistRulesDto(
            Genre: " ROCK ",
            MinimumRating: 4,
            MinimumPlayCount: 25,
            AddedWithinDays: 30,
            Limit: 20);
        var service = new SmartPlaylistService(db);

        var result = await service.ResolveAsync(SmartPlaylistService.Serialize(rules));

        Assert.Single(result);
        Assert.Equal(matching.Id, result[0].Id);
    }

    [Fact]
    public void Validate_RejectsLimitOutOfRange()
    {
        Assert.NotNull(SmartPlaylistService.Validate(new SmartPlaylistRulesDto(Genre: "rock", Limit: 0)));
        Assert.NotNull(SmartPlaylistService.Validate(new SmartPlaylistRulesDto(Genre: "rock", Limit: 501)));
        Assert.Null(SmartPlaylistService.Validate(new SmartPlaylistRulesDto(Genre: "rock", Limit: 50)));
    }

    [Fact]
    public void Serialize_NormalizesGenre_AndClampsLimit()
    {
        var json = SmartPlaylistService.Serialize(new SmartPlaylistRulesDto(Genre: "  ROCK ", Limit: 9999));

        var round = SmartPlaylistService.Deserialize(json);

        Assert.NotNull(round);
        Assert.Equal("rock", round!.Genre);
        Assert.Equal(500, round.Limit);
    }

    [Fact]
    public void Deserialize_NullOrGarbage_ReturnsNull()
    {
        Assert.Null(SmartPlaylistService.Deserialize(null));
        Assert.Null(SmartPlaylistService.Deserialize("   "));
        Assert.Null(SmartPlaylistService.Deserialize("{not json"));
    }

    [Fact]
    public async Task ResolveAsync_AppliesLimit_AndExcludesUnapprovedTracks()
    {
        await using var db = TestHelpers.NewDb();
        var artist = new Artist { Id = Guid.NewGuid(), Name = "Artist" };
        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = "Album",
            Artist = artist,
            ArtistId = artist.Id,
            CoverUrl = "",
            ReleaseDate = DateOnly.FromDateTime(DateTime.UtcNow),
        };
        var top = NewTrack("Top", artist, album, playCount: 100, ratingCount: 0, ratingSum: 0, daysOld: 1);
        var mid = NewTrack("Mid", artist, album, playCount: 50, ratingCount: 0, ratingSum: 0, daysOld: 1);
        var low = NewTrack("Low", artist, album, playCount: 10, ratingCount: 0, ratingSum: 0, daysOld: 1);
        var pending = NewTrack("Pending", artist, album, playCount: 999, ratingCount: 0, ratingSum: 0, daysOld: 1);
        pending.Status = "pending";
        db.AddRange(artist, album, top, mid, low, pending);
        await db.SaveChangesAsync();

        var rules = new SmartPlaylistRulesDto(MinimumPlayCount: 1, Limit: 2);
        var result = await new SmartPlaylistService(db).ResolveAsync(SmartPlaylistService.Serialize(rules));

        Assert.Equal(2, result.Count);
        Assert.Equal(top.Id, result[0].Id);   // ordered by play count (no ratings)
        Assert.Equal(mid.Id, result[1].Id);
        Assert.DoesNotContain(result, t => t.Id == pending.Id); // never surfaces unapproved
    }

    [Fact]
    public async Task ResolveAsync_FiltersByAddedWithinDays()
    {
        await using var db = TestHelpers.NewDb();
        var artist = new Artist { Id = Guid.NewGuid(), Name = "Artist" };
        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = "Album",
            Artist = artist,
            ArtistId = artist.Id,
            CoverUrl = "",
            ReleaseDate = DateOnly.FromDateTime(DateTime.UtcNow),
        };
        var recent = NewTrack("Recent", artist, album, playCount: 1, ratingCount: 0, ratingSum: 0, daysOld: 2);
        var old = NewTrack("Old", artist, album, playCount: 1, ratingCount: 0, ratingSum: 0, daysOld: 100);
        db.AddRange(artist, album, recent, old);
        await db.SaveChangesAsync();

        var rules = new SmartPlaylistRulesDto(AddedWithinDays: 30, Limit: 20);
        var result = await new SmartPlaylistService(db).ResolveAsync(SmartPlaylistService.Serialize(rules));

        Assert.Single(result);
        Assert.Equal(recent.Id, result[0].Id);
    }

    private static Track NewTrack(
        string title,
        Artist artist,
        Album album,
        long playCount,
        int ratingCount,
        int ratingSum,
        int daysOld) => new()
        {
            Id = Guid.NewGuid(),
            Title = title,
            Artist = artist,
            ArtistId = artist.Id,
            Album = album,
            AlbumId = album.Id,
            AudioUrl = "",
            Status = "approved",
            PlayCount = playCount,
            RatingCount = ratingCount,
            RatingSum = ratingSum,
            CreatedAt = DateTime.UtcNow.AddDays(-daysOld),
        };
}
