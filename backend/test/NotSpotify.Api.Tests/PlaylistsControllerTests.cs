using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Playlist CRUD + the public/friends/private visibility 403 matrix, plus
/// collaborative add/remove guards (owner-scope, smart-playlist lock,
/// duplicate-track conflict). Unit tests over the InMemory db — see TestHelpers.
/// </summary>
public class PlaylistsControllerTests
{
    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_AsGuest_ReturnsUnauthorized()
    {
        await using var db = TestHelpers.NewDb();
        var controller = TestHelpers.NewPlaylistsController(db).AsGuest();

        var result = await controller.Create(new CreatePlaylistRequest("My List", null));

        Assert.IsType<UnauthorizedResult>(result.Result);
        Assert.Empty(db.Playlists);
    }

    [Fact]
    public async Task Create_PersistsPublicPlaylistOwnedByCaller()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();
        var controller = TestHelpers.NewPlaylistsController(db).AsUser(me);

        var result = await controller.Create(new CreatePlaylistRequest("My List", "desc", IsPublic: true));

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<PlaylistDto>(created.Value);
        Assert.Equal("My List", dto.Name);
        Assert.True(dto.IsPublic);
        Assert.Equal("public", dto.Visibility);
        Assert.True(dto.IsOwner);
        var row = Assert.Single(db.Playlists);
        Assert.Equal(me, row.OwnerId);
    }

    [Fact]
    public async Task Create_PrivateRequest_SetsVisibilityPrivate()
    {
        await using var db = TestHelpers.NewDb();
        var me = Guid.NewGuid();
        db.AddUser(me, "me");
        await db.SaveChangesAsync();
        var controller = TestHelpers.NewPlaylistsController(db).AsUser(me);

        var result = await controller.Create(new CreatePlaylistRequest("Secret", null, IsPublic: false));

        var dto = Assert.IsType<PlaylistDto>(Assert.IsType<CreatedAtActionResult>(result.Result).Value);
        Assert.False(dto.IsPublic);
        Assert.Equal("private", dto.Visibility);
    }

    // ── Visibility 403 matrix (Get) ─────────────────────────────────────────────

    [Fact]
    public async Task Get_PublicPlaylist_AllowsGuest()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var p = db.AddPlaylist(owner, "public");
        await db.SaveChangesAsync();
        var controller = TestHelpers.NewPlaylistsController(db).AsGuest();

        var result = await controller.Get(p.Id);

        var dto = Assert.IsType<PlaylistDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(p.Id, dto.Id);
        Assert.False(dto.IsOwner);
    }

    [Fact]
    public async Task Get_PrivatePlaylist_ForbidsNonOwner_AllowsOwner()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var p = db.AddPlaylist(owner, "private");
        await db.SaveChangesAsync();

        var asStranger = await TestHelpers.NewPlaylistsController(db).AsUser(Guid.NewGuid()).Get(p.Id);
        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<StatusCodeResult>(asStranger.Result).StatusCode);

        var asOwner = await TestHelpers.NewPlaylistsController(db).AsUser(owner).Get(p.Id);
        Assert.IsType<OkObjectResult>(asOwner.Result);
    }

    [Fact]
    public async Task Get_FriendsPlaylist_AllowsFriend_ForbidsStrangerAndGuest()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var friend = Guid.NewGuid();
        db.AddUser(owner, "owner");
        db.AddFriendship(owner, friend); // accepted
        var p = db.AddPlaylist(owner, "friends");
        await db.SaveChangesAsync();

        var asFriend = await TestHelpers.NewPlaylistsController(db).AsUser(friend).Get(p.Id);
        Assert.IsType<OkObjectResult>(asFriend.Result);

        var asStranger = await TestHelpers.NewPlaylistsController(db).AsUser(Guid.NewGuid()).Get(p.Id);
        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<StatusCodeResult>(asStranger.Result).StatusCode);

        var asGuest = await TestHelpers.NewPlaylistsController(db).AsGuest().Get(p.Id);
        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<StatusCodeResult>(asGuest.Result).StatusCode);
    }

    [Fact]
    public async Task Get_MissingPlaylist_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var controller = TestHelpers.NewPlaylistsController(db).AsGuest();

        var result = await controller.Get(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ── Update ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_ByNonOwner_Forbidden()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var p = db.AddPlaylist(owner, "public");
        await db.SaveChangesAsync();
        var controller = TestHelpers.NewPlaylistsController(db).AsUser(Guid.NewGuid());

        var result = await controller.Update(p.Id, new UpdatePlaylistRequest("x", null, null, null, null, null));

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<StatusCodeResult>(result.Result).StatusCode);
    }

    [Fact]
    public async Task Update_InvalidVisibility_BadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var p = db.AddPlaylist(owner, "public");
        await db.SaveChangesAsync();
        var controller = TestHelpers.NewPlaylistsController(db).AsUser(owner);

        var result = await controller.Update(p.Id, new UpdatePlaylistRequest(null, null, null, "secret", null, null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Update_PublicToPrivate_RevokesOtherUsersSaves()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var saver = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var p = db.AddPlaylist(owner, "public");
        db.UserSavedPlaylists.Add(new UserSavedPlaylist { UserId = saver, PlaylistId = p.Id });
        await db.SaveChangesAsync();
        var controller = TestHelpers.NewPlaylistsController(db).AsUser(owner);

        var result = await controller.Update(p.Id, new UpdatePlaylistRequest(null, null, null, "private", null, null));

        var dto = Assert.IsType<PlaylistDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal("private", dto.Visibility);
        Assert.Empty(db.UserSavedPlaylists);
    }

    // ── Delete ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_ByNonOwner_Forbidden()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var p = db.AddPlaylist(owner, "public");
        await db.SaveChangesAsync();
        var controller = TestHelpers.NewPlaylistsController(db).AsUser(Guid.NewGuid());

        var result = await controller.Delete(p.Id);

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<StatusCodeResult>(result).StatusCode);
        Assert.Single(db.Playlists);
    }

    [Fact]
    public async Task Delete_ByOwner_RemovesPlaylist()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var p = db.AddPlaylist(owner, "public");
        await db.SaveChangesAsync();
        var controller = TestHelpers.NewPlaylistsController(db).AsUser(owner);

        var result = await controller.Delete(p.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.Playlists);
    }

    // ── Collaborative add/remove ────────────────────────────────────────────────

    [Fact]
    public async Task AddTrack_Owner_AddsTrack_ThenDuplicateConflicts()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var track = db.SeedTrack();
        var p = db.AddPlaylist(owner, "public");
        await db.SaveChangesAsync();

        var add = await TestHelpers.NewPlaylistsController(db).AsUser(owner)
            .AddTrack(p.Id, new AddPlaylistTrackRequest(track.Id));
        var dto = Assert.IsType<PlaylistDto>(Assert.IsType<OkObjectResult>(add.Result).Value);
        Assert.Single(dto.Tracks);

        var dup = await TestHelpers.NewPlaylistsController(db).AsUser(owner)
            .AddTrack(p.Id, new AddPlaylistTrackRequest(track.Id));
        Assert.IsType<ConflictObjectResult>(dup.Result);
    }

    [Fact]
    public async Task AddTrack_ByNonOwner_Forbidden()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var track = db.SeedTrack();
        var p = db.AddPlaylist(owner, "public");
        await db.SaveChangesAsync();

        var result = await TestHelpers.NewPlaylistsController(db).AsUser(Guid.NewGuid())
            .AddTrack(p.Id, new AddPlaylistTrackRequest(track.Id));

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<StatusCodeResult>(result.Result).StatusCode);
    }

    [Fact]
    public async Task AddTrack_ToSmartPlaylist_BadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var track = db.SeedTrack();
        var p = db.AddPlaylist(owner, "public");
        p.Rules = SmartPlaylistService.Serialize(new SmartPlaylistRulesDto(Genre: "rock"));
        await db.SaveChangesAsync();

        var result = await TestHelpers.NewPlaylistsController(db).AsUser(owner)
            .AddTrack(p.Id, new AddPlaylistTrackRequest(track.Id));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task RemoveTrack_Owner_Removes_NonOwnerForbidden()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var track = db.SeedTrack();
        var p = db.AddPlaylist(owner, "public");
        p.PlaylistTracks.Add(new PlaylistTrack { PlaylistId = p.Id, TrackId = track.Id, Position = 1, AddedByUserId = owner });
        await db.SaveChangesAsync();

        var forbidden = await TestHelpers.NewPlaylistsController(db).AsUser(Guid.NewGuid())
            .RemoveTrack(p.Id, track.Id);
        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<StatusCodeResult>(forbidden).StatusCode);

        var removed = await TestHelpers.NewPlaylistsController(db).AsUser(owner)
            .RemoveTrack(p.Id, track.Id);
        Assert.IsType<NoContentResult>(removed);
        Assert.Empty(db.PlaylistTracks);
    }

    // ── Recommendations (genre overlap) ──────────────────────────────────────────

    [Fact]
    public async Task ReorderTracks_Owner_PersistsAndReturnsRequestedOrder()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var first = db.SeedTrack("First");
        var second = db.SeedTrack("Second");
        var third = db.SeedTrack("Third");
        var playlist = db.AddPlaylist(owner, "public");
        db.PlaylistTracks.AddRange(
            new PlaylistTrack { PlaylistId = playlist.Id, TrackId = first.Id, Position = 1, AddedByUserId = owner },
            new PlaylistTrack { PlaylistId = playlist.Id, TrackId = second.Id, Position = 2, AddedByUserId = owner },
            new PlaylistTrack { PlaylistId = playlist.Id, TrackId = third.Id, Position = 3, AddedByUserId = owner });
        await db.SaveChangesAsync();

        var requestedOrder = new[] { third.Id, first.Id, second.Id };
        var result = await TestHelpers.NewPlaylistsController(db).AsUser(owner)
            .ReorderTracks(playlist.Id, new ReorderPlaylistTracksRequest(requestedOrder));

        var dto = Assert.IsType<PlaylistDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(requestedOrder, dto.Tracks.Select(item => item.Track.Id));
        Assert.Equal(
            requestedOrder,
            db.PlaylistTracks.OrderBy(item => item.Position).Select(item => item.TrackId));
    }

    [Fact]
    public async Task ReorderTracks_RejectsIncompleteOrDuplicateTrackLists()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        db.AddUser(owner, "owner");
        var first = db.SeedTrack("First");
        var second = db.SeedTrack("Second");
        var playlist = db.AddPlaylist(owner, "public");
        db.PlaylistTracks.AddRange(
            new PlaylistTrack { PlaylistId = playlist.Id, TrackId = first.Id, Position = 1, AddedByUserId = owner },
            new PlaylistTrack { PlaylistId = playlist.Id, TrackId = second.Id, Position = 2, AddedByUserId = owner });
        await db.SaveChangesAsync();
        var controller = TestHelpers.NewPlaylistsController(db).AsUser(owner);

        var incomplete = await controller.ReorderTracks(
            playlist.Id,
            new ReorderPlaylistTracksRequest([second.Id]));
        var duplicate = await controller.ReorderTracks(
            playlist.Id,
            new ReorderPlaylistTracksRequest([second.Id, second.Id]));

        Assert.IsType<BadRequestObjectResult>(incomplete.Result);
        Assert.IsType<BadRequestObjectResult>(duplicate.Result);
        Assert.Equal(
            new[] { first.Id, second.Id },
            db.PlaylistTracks.OrderBy(item => item.Position).Select(item => item.TrackId));
    }

    [Fact]
    public async Task ReorderTracks_ByNonOwner_IsForbidden()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var track = db.SeedTrack();
        var playlist = db.AddPlaylist(owner, "public");
        playlist.PlaylistTracks.Add(
            new PlaylistTrack { PlaylistId = playlist.Id, TrackId = track.Id, Position = 1, AddedByUserId = owner });
        await db.SaveChangesAsync();

        var result = await TestHelpers.NewPlaylistsController(db).AsUser(Guid.NewGuid())
            .ReorderTracks(playlist.Id, new ReorderPlaylistTracksRequest([track.Id]));

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<StatusCodeResult>(result.Result).StatusCode);
    }

    [Fact]
    public async Task Recommendations_SuggestSharedGenreTracks_ExcludingExistingAndUnrelated()
    {
        await using var db = TestHelpers.NewDb();
        var owner = Guid.NewGuid();
        var inList = db.SeedTrack("In");
        var candidate = db.SeedTrack("Candidate");
        var unrelated = db.SeedTrack("Unrelated");
        var rock = new Genre { Id = Guid.NewGuid(), Name = "Rock", Slug = "rock" };
        db.Add(rock);
        db.TrackGenres.AddRange(
            new TrackGenre { TrackId = inList.Id, GenreId = rock.Id },
            new TrackGenre { TrackId = candidate.Id, GenreId = rock.Id });
        var p = db.AddPlaylist(owner, "public");
        p.PlaylistTracks.Add(new PlaylistTrack { PlaylistId = p.Id, TrackId = inList.Id, Position = 1, AddedByUserId = owner });
        await db.SaveChangesAsync();

        var result = await TestHelpers.NewPlaylistsController(db).AsGuest().Recommendations(p.Id);

        var recs = Assert.IsAssignableFrom<IEnumerable<TrackDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Contains(recs, t => t.Id == candidate.Id);
        Assert.DoesNotContain(recs, t => t.Id == inList.Id);
        Assert.DoesNotContain(recs, t => t.Id == unrelated.Id);
    }
}
