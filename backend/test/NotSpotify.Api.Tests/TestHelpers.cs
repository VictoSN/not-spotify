using System.Net.Http;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Data;
using NotSpotify.Api.Hubs;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Shared scaffolding for controller unit tests.
///
/// These are *unit* tests: a controller is constructed directly over an
/// EF Core InMemory database and mocked services, then its action methods are
/// invoked and the results asserted. Nothing here ever touches the shared
/// Supabase/Postgres database, and the web host (Program.cs) is never started —
/// so tests are fast, isolated, and safe to run on every machine.
/// </summary>
internal static class TestHelpers
{
    /// <summary>A fresh, uniquely-named InMemory AppDbContext (isolated per test).</summary>
    public static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"test-{Guid.NewGuid()}")
            .EnableSensitiveDataLogging()
            .Options;
        return new AppDbContext(options);
    }

    /// <summary>A stub storage service whose public/audio URLs are derived from the key.</summary>
    public static Mock<IStorageService> NewStorageMock()
    {
        var storage = new Mock<IStorageService>();
        storage.Setup(s => s.GetPublicUrl(It.IsAny<string>())).Returns<string>(k => $"https://cdn.test/{k}");
        storage.Setup(s => s.GetAudioUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync<string, CancellationToken, IStorageService, string>((k, _) => $"https://cdn.test/{k}");
        return storage;
    }

    /// <summary>A MediaMapper backed by a stub storage service (public URL = key).</summary>
    public static MediaMapper NewMapper() => new(NewStorageMock().Object);

    /// <summary>
    /// A PlaylistsController wired over the InMemory db with stub storage, a real
    /// SmartPlaylistService, and an AudioDownloadService (its HTTP path is never hit
    /// by the CRUD/visibility tests). Attach an identity via <c>.AsUser(id)</c> or
    /// <c>.AsGuest()</c>.
    /// </summary>
    public static PlaylistsController NewPlaylistsController(AppDbContext db)
    {
        var storage = NewStorageMock();
        var audio = new AudioDownloadService(storage.Object, new Mock<IHttpClientFactory>().Object);
        return new PlaylistsController(db, new MediaMapper(storage.Object), storage.Object, audio, new SmartPlaylistService(db));
    }

    /// <summary>
    /// An IHubContext whose Clients.Group(...).SendAsync(...) is a no-op, plus the
    /// proxy mock so a test can verify a push was attempted.
    /// </summary>
    public static (IHubContext<PresenceHub> hub, Mock<IClientProxy> proxy) NewHub()
    {
        var proxy = new Mock<IClientProxy>();
        proxy.Setup(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
             .Returns(Task.CompletedTask);

        var clients = new Mock<IHubClients>();
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(proxy.Object);

        var hub = new Mock<IHubContext<PresenceHub>>();
        hub.Setup(h => h.Clients).Returns(clients.Object);

        return (hub.Object, proxy);
    }

    /// <summary>A real NotificationService over the InMemory db + a no-op hub.</summary>
    public static NotificationService NewNotifications(AppDbContext db)
    {
        var (hub, _) = NewHub();
        return new NotificationService(db, hub, NullLogger<NotificationService>.Instance);
    }

    /// <summary>Attaches a ClaimsPrincipal carrying the given user id to a controller.</summary>
    public static T AsUser<T>(this T controller, Guid userId) where T : ControllerBase
    {
        var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "Test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }

    /// <summary>Attaches an anonymous (no-claims) principal so CurrentUserId() resolves to null.</summary>
    public static T AsGuest<T>(this T controller) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) },
        };
        return controller;
    }

    /// <summary>Adds an approved track (with its own artist + album) and returns it.</summary>
    public static Track SeedTrack(this AppDbContext db, string title = "Track", long durationMs = 1000)
    {
        var artist = new Artist { Id = Guid.NewGuid(), Name = $"{title} Artist" };
        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = $"{title} Album",
            Artist = artist,
            ArtistId = artist.Id,
            CoverUrl = "",
            ReleaseDate = DateOnly.FromDateTime(DateTime.UtcNow),
        };
        var track = new Track
        {
            Id = Guid.NewGuid(),
            Title = title,
            Artist = artist,
            ArtistId = artist.Id,
            Album = album,
            AlbumId = album.Id,
            AudioUrl = "",
            Status = "approved",
            DurationMs = durationMs,
        };
        db.AddRange(artist, album, track);
        return track;
    }

    /// <summary>Adds a playlist owned by <paramref name="ownerId"/> with the given visibility.</summary>
    public static Playlist AddPlaylist(this AppDbContext db, Guid ownerId, string visibility = "public", string name = "List")
    {
        var p = new Playlist
        {
            Id = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = name,
            Visibility = visibility,
            IsPublic = visibility == "public",
        };
        db.Playlists.Add(p);
        return p;
    }

    /// <summary>Adds a one-way follow edge (follower → followee).</summary>
    public static void AddFollow(this AppDbContext db, Guid followerId, Guid followeeId)
        => db.UserFollows.Add(new UserFollow { FollowerId = followerId, FolloweeId = followeeId });

    /// <summary>Adds a bare user (id + name) to the context.</summary>
    public static ApplicationUser AddUser(this AppDbContext db, Guid id, string name)
    {
        var user = new ApplicationUser { Id = id, Name = name, UserName = $"{name}@test", Email = $"{name}@test" };
        db.Users.Add(user);
        return user;
    }

    /// <summary>Creates an accepted friendship between two users.</summary>
    public static void AddFriendship(this AppDbContext db, Guid a, Guid b)
    {
        db.Friendships.Add(new Friendship
        {
            RequesterId = a,
            AddresseeId = b,
            Status = FriendshipStatus.Accepted,
        });
    }
}
