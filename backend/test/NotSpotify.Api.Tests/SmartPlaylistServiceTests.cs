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
