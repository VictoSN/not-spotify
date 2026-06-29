using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Browse taxonomy: moods/activities and genres — list, slug lookup (404 on
/// miss), and the slug→tracks / slug→playlists projections (approved-only,
/// public-only, tag-scoped).
/// </summary>
public class TaxonomyControllerTests
{
    // ── Moods ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Moods_List_ReturnsAllTags()
    {
        await using var db = TestHelpers.NewDb();
        db.MoodTags.Add(new MoodTag { Id = Guid.NewGuid(), Name = "Chill", Slug = "chill", Kind = "mood" });
        db.MoodTags.Add(new MoodTag { Id = Guid.NewGuid(), Name = "Focus", Slug = "focus", Kind = "activity" });
        await db.SaveChangesAsync();

        var result = await new MoodsController(db, TestHelpers.NewMapper()).List();

        var tags = Assert.IsAssignableFrom<IEnumerable<MoodTagDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(2, tags.Count());
    }

    [Fact]
    public async Task Moods_Get_UnknownSlug_NotFound()
    {
        await using var db = TestHelpers.NewDb();

        var result = await new MoodsController(db, TestHelpers.NewMapper()).Get("nope");

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Moods_Tracks_ReturnsApprovedTaggedTracksOnly()
    {
        await using var db = TestHelpers.NewDb();
        var mood = new MoodTag { Id = Guid.NewGuid(), Name = "Chill", Slug = "chill" };
        db.MoodTags.Add(mood);
        var tagged = db.SeedTrack("Tagged");
        var untagged = db.SeedTrack("Untagged");
        db.TrackMoodTags.Add(new TrackMoodTag { TrackId = tagged.Id, MoodTagId = mood.Id });
        await db.SaveChangesAsync();

        var result = await new MoodsController(db, TestHelpers.NewMapper()).Tracks("chill");

        var tracks = Assert.IsAssignableFrom<IEnumerable<TrackDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var single = Assert.Single(tracks);
        Assert.Equal(tagged.Id, single.Id);
    }

    [Fact]
    public async Task Moods_Tracks_UnknownSlug_NotFound()
    {
        await using var db = TestHelpers.NewDb();

        var result = await new MoodsController(db, TestHelpers.NewMapper()).Tracks("nope");

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Moods_Playlists_ReturnsPublicTaggedPlaylistsOnly()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var mood = new MoodTag { Id = Guid.NewGuid(), Name = "Party", Slug = "party" };
        db.MoodTags.Add(mood);
        var pub = db.AddPlaylist(owner, "public", "Public");
        var priv = db.AddPlaylist(owner, "private", "Private");
        db.PlaylistMoodTags.Add(new PlaylistMoodTag { PlaylistId = pub.Id, MoodTagId = mood.Id });
        db.PlaylistMoodTags.Add(new PlaylistMoodTag { PlaylistId = priv.Id, MoodTagId = mood.Id });
        await db.SaveChangesAsync();

        var result = await new MoodsController(db, TestHelpers.NewMapper()).Playlists("party");

        var playlists = Assert.IsAssignableFrom<IEnumerable<PlaylistSummaryDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var single = Assert.Single(playlists);
        Assert.Equal(pub.Id, single.Id);
    }

    // ── Genres ────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Genres_List_ReturnsGenres()
    {
        await using var db = TestHelpers.NewDb();
        db.Genres.Add(new Genre { Id = Guid.NewGuid(), Name = "Rock", Slug = "rock" });
        db.Genres.Add(new Genre { Id = Guid.NewGuid(), Name = "Jazz", Slug = "jazz" });
        await db.SaveChangesAsync();

        var result = await new GenresController(db, TestHelpers.NewMapper()).List();

        var genres = Assert.IsAssignableFrom<IEnumerable<GenreDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(2, genres.Count());
    }

    [Fact]
    public async Task Genres_Tracks_UnknownSlug_NotFound()
    {
        await using var db = TestHelpers.NewDb();

        var result = await new GenresController(db, TestHelpers.NewMapper()).Tracks("nope");

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Genres_Tracks_ReturnsTaggedTracks()
    {
        await using var db = TestHelpers.NewDb();
        var rock = new Genre { Id = Guid.NewGuid(), Name = "Rock", Slug = "rock" };
        db.Genres.Add(rock);
        var tagged = db.SeedTrack("Rocker");
        var untagged = db.SeedTrack("Quiet");
        var pending = db.SeedTrack("Pending Rocker");
        pending.Status = "pending";
        db.TrackGenres.AddRange(
            new TrackGenre { TrackId = tagged.Id, GenreId = rock.Id },
            new TrackGenre { TrackId = pending.Id, GenreId = rock.Id });
        await db.SaveChangesAsync();

        var result = await new GenresController(db, TestHelpers.NewMapper()).Tracks("rock");

        var tracks = Assert.IsAssignableFrom<IEnumerable<TrackDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(tagged.Id, Assert.Single(tracks).Id);
    }

    [Fact]
    public async Task Genres_Playlists_ReturnsPublicPlaylistsContainingGenreTracks()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var rock = new Genre { Id = Guid.NewGuid(), Name = "Rock", Slug = "rock" };
        db.Genres.Add(rock);
        var track = db.SeedTrack("Rocker");
        db.TrackGenres.Add(new TrackGenre { TrackId = track.Id, GenreId = rock.Id });
        var pub = db.AddPlaylist(owner, "public", "RockMix");
        pub.PlaylistTracks.Add(new PlaylistTrack { PlaylistId = pub.Id, TrackId = track.Id, Position = 1, AddedByUserId = owner });
        var priv = db.AddPlaylist(owner, "private", "PrivateRock");
        priv.PlaylistTracks.Add(new PlaylistTrack { PlaylistId = priv.Id, TrackId = track.Id, Position = 1, AddedByUserId = owner });
        var pendingTrack = db.SeedTrack("Pending Rocker");
        pendingTrack.Status = "pending";
        db.TrackGenres.Add(new TrackGenre { TrackId = pendingTrack.Id, GenreId = rock.Id });
        var pendingOnly = db.AddPlaylist(owner, "public", "PendingOnly");
        pendingOnly.PlaylistTracks.Add(new PlaylistTrack { PlaylistId = pendingOnly.Id, TrackId = pendingTrack.Id, Position = 1, AddedByUserId = owner });
        await db.SaveChangesAsync();

        var result = await new GenresController(db, TestHelpers.NewMapper()).Playlists("rock");

        var playlists = Assert.IsAssignableFrom<IEnumerable<PlaylistDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var single = Assert.Single(playlists);
        Assert.Equal(pub.Id, single.Id);
    }

    [Fact]
    public async Task Genres_Artists_UnknownSlug_NotFound()
    {
        await using var db = TestHelpers.NewDb();

        var result = await new GenresController(db, TestHelpers.NewMapper()).Artists("nope");

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Genres_Artists_ReturnsGenreArtistsRankedByGenreTrackPlays()
    {
        await using var db = TestHelpers.NewDb();
        var rock = new Genre { Id = Guid.NewGuid(), Name = "Rock", Slug = "rock" };
        var jazz = new Genre { Id = Guid.NewGuid(), Name = "Jazz", Slug = "jazz" };
        db.Genres.AddRange(rock, jazz);

        var top = db.SeedTrack("Popular Rock");
        top.PlayCount = 500;
        top.Artist.MonthlyListeners = 10;
        var second = db.SeedTrack("Second Rock");
        second.PlayCount = 100;
        second.Artist.MonthlyListeners = 1_000;
        var unrelated = db.SeedTrack("Jazz Only");
        unrelated.PlayCount = 10_000;
        var pending = db.SeedTrack("Pending Rock");
        pending.PlayCount = 20_000;
        pending.Status = "pending";

        db.TrackGenres.AddRange(
            new TrackGenre { TrackId = top.Id, GenreId = rock.Id },
            new TrackGenre { TrackId = second.Id, GenreId = rock.Id },
            new TrackGenre { TrackId = pending.Id, GenreId = rock.Id },
            new TrackGenre { TrackId = unrelated.Id, GenreId = jazz.Id });
        await db.SaveChangesAsync();

        var result = await new GenresController(db, TestHelpers.NewMapper()).Artists("rock");

        var artists = Assert.IsAssignableFrom<IEnumerable<ArtistDto>>(
            Assert.IsType<OkObjectResult>(result.Result).Value).ToList();
        Assert.Equal(new[] { top.ArtistId, second.ArtistId }, artists.Select(a => a.Id));
        Assert.All(artists, artist => Assert.Contains("rock", artist.Genres));
    }
}
