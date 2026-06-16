using System.Net.Http;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
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

    /// <summary>A MediaMapper backed by a stub storage service (public URL = key).</summary>
    public static MediaMapper NewMapper()
    {
        var storage = new Mock<IStorageService>();
        storage.Setup(s => s.GetPublicUrl(It.IsAny<string>())).Returns<string>(k => $"https://cdn.test/{k}");
        storage.Setup(s => s.GetAudioUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync<string, CancellationToken, IStorageService, string>((k, _) => $"https://cdn.test/{k}");
        return new MediaMapper(storage.Object);
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

    /// <summary>A stub storage service (public URL = key, ReadAsync = miss).</summary>
    public static IStorageService NewStorage()
    {
        var storage = new Mock<IStorageService>();
        storage.Setup(s => s.GetPublicUrl(It.IsAny<string>())).Returns<string>(k => $"https://cdn.test/{k}");
        storage.Setup(s => s.GetAudioUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .Returns<string, CancellationToken>((k, _) => Task.FromResult($"https://cdn.test/{k}"));
        storage.Setup(s => s.ReadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync((byte[]?)null);
        return storage.Object;
    }

    /// <summary>An IHttpClientFactory handing out plain HttpClients.</summary>
    public static IHttpClientFactory NewHttpFactory()
    {
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(() => new HttpClient());
        return factory.Object;
    }

    public static AudioDownloadService NewAudioDownloads()
        => new AudioDownloadService(NewStorage(), NewHttpFactory());

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

    /// <summary>Attaches an anonymous principal (no user id) — i.e. a logged-out visitor.</summary>
    public static T AsGuest<T>(this T controller) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) },
        };
        return controller;
    }

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

    /// <summary>Adds a playlist with the given owner and visibility ("public"|"friends"|"private").</summary>
    public static Playlist AddPlaylist(this AppDbContext db, Guid ownerId, string visibility)
    {
        var playlist = new Playlist
        {
            Id = Guid.NewGuid(),
            Name = "Test playlist",
            OwnerId = ownerId,
            IsPublic = visibility == "public",
            Visibility = visibility,
        };
        db.Playlists.Add(playlist);
        return playlist;
    }
}
