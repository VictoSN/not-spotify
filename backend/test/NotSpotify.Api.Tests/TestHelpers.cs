using System.Net.Http;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
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
    /// A configured TicketmasterService whose HTTP calls return the given canned
    /// Discovery-API JSON, so sync logic can be tested without a real network.
    /// </summary>
    public static TicketmasterService NewTicketmaster(string responseJson) => new(
        new HttpClient(new CannedHandler(responseJson)),
        Microsoft.Extensions.Options.Options.Create(new TicketmasterOptions { ApiKey = "test-key" }),
        NullLogger<TicketmasterService>.Instance);

    /// <summary>A TourSyncService over the InMemory db and the given Ticketmaster stub.</summary>
    public static TourSyncService NewTourSync(AppDbContext db, TicketmasterService tm) =>
        new(db, tm, NullLogger<TourSyncService>.Instance);

    /// <summary>An HttpMessageHandler that returns the same canned 200/JSON for every request.</summary>
    private sealed class CannedHandler : HttpMessageHandler
    {
        private readonly string _json;
        public CannedHandler(string json) => _json = json;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent(_json, System.Text.Encoding.UTF8, "application/json"),
            });
    }

    /// <summary>
    /// A PlaylistsController wired over the InMemory db with stub storage, a real
    /// SmartPlaylistService, and an AudioDownloadService (its HTTP path is never hit
    /// by the CRUD/visibility tests). Attach an identity via <c>.AsUser(id)</c> or
    /// <c>.AsGuest()</c>.
    /// </summary>
    public static PlaylistsController NewPlaylistsController(AppDbContext db)
    {
        var storage = NewStorageMock();
        var httpFactory = new Mock<IHttpClientFactory>().Object;
        var audio = new AudioDownloadService(storage.Object, httpFactory);
        return new PlaylistsController(
            db,
            new MediaMapper(storage.Object),
            storage.Object,
            audio,
            new SmartPlaylistService(db),
            httpFactory,
            NullLogger<PlaylistsController>.Instance);
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
        var push = new WebPushService(
            db,
            Microsoft.Extensions.Options.Options.Create(new WebPushOptions()),
            NullLogger<WebPushService>.Instance);
        return new NotificationService(db, hub, NullLogger<NotificationService>.Instance, push);
    }

    /// <summary>Attaches a ClaimsPrincipal carrying the given user id (and optional roles) to a controller.</summary>
    public static T AsUser<T>(this T controller, Guid userId, params string[] roles) where T : ControllerBase
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId.ToString()) };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        var identity = new ClaimsIdentity(claims, "Test", ClaimTypes.Name, ClaimTypes.Role);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }

    /// <summary>A mockable UserManager over a stub user store (no real persistence).</summary>
    public static Mock<UserManager<ApplicationUser>> MockUserManager()
    {
        var store = new Mock<IUserStore<ApplicationUser>>();
        return new Mock<UserManager<ApplicationUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
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

    /// <summary>An IHttpClientFactory whose clients all use the supplied handler.</summary>
    public static IHttpClientFactory NewHttpFactory(HttpMessageHandler handler)
    {
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(() => new HttpClient(handler));
        return factory.Object;
    }

    /// <summary>A LyricsService whose external HTTP calls are answered by <paramref name="responder"/>.</summary>
    public static LyricsService NewLyrics(Func<HttpRequestMessage, HttpResponseMessage> responder)
        => new(NewHttpFactory(new StubHttpMessageHandler(responder)), NullLogger<LyricsService>.Instance);

    /// <summary>
    /// A LyricsService that throws on any HTTP call. Use it to prove a code path
    /// never reached the network (the throw is not one of the swallowed exceptions).
    /// </summary>
    public static LyricsService NewOfflineLyrics()
        => NewLyrics(_ => throw new InvalidOperationException("network should not be called"));

    /// <summary>An AudioDownloadService over stub storage — not exercised by recommendation tests.</summary>
    public static AudioDownloadService NewAudioDownloads()
        => new(new Mock<IStorageService>().Object, NewHttpFactory(new StubHttpMessageHandler(
            _ => new HttpResponseMessage(System.Net.HttpStatusCode.NotFound))));

    /// <summary>Adds an approved track (with artist + album) to the context.</summary>
    public static Models.Track AddTrack(
        this AppDbContext db,
        string title,
        Artist artist,
        Album album,
        long playCount = 0,
        int ratingCount = 0,
        int ratingSum = 0,
        int daysOld = 1,
        string status = "approved")
    {
        var track = new Models.Track
        {
            Id = Guid.NewGuid(),
            Title = title,
            Artist = artist,
            ArtistId = artist.Id,
            Album = album,
            AlbumId = album.Id,
            AudioUrl = $"audio/{Guid.NewGuid()}.mp3",
            Status = status,
            PlayCount = playCount,
            RatingCount = ratingCount,
            RatingSum = ratingSum,
            CreatedAt = DateTime.UtcNow.AddDays(-daysOld),
        };
        db.Tracks.Add(track);
        return track;
    }

    /// <summary>Records a play of <paramref name="track"/> by <paramref name="user"/> some days ago.</summary>
    public static void AddPlay(this AppDbContext db, ApplicationUser user, Models.Track track, int daysAgo = 0)
    {
        db.PlayHistories.Add(new PlayHistory
        {
            Id = Guid.NewGuid(),
            User = user,
            UserId = user.Id,
            Track = track,
            TrackId = track.Id,
            PlayedAt = DateTime.UtcNow.AddDays(-daysAgo),
        });
    }

    /// <summary>Tags a track with a genre (creating the join row).</summary>
    public static void Tag(this AppDbContext db, Models.Track track, Genre genre)
    {
        db.TrackGenres.Add(new TrackGenre { Track = track, TrackId = track.Id, Genre = genre, GenreId = genre.Id });
    }

    /// <summary>Adds an artist + album pair (optionally tagged to a market country) and returns both.</summary>
    public static (Artist artist, Album album) AddArtistAlbum(this AppDbContext db, string name = "Artist", string? country = null)
    {
        var artist = new Artist { Id = Guid.NewGuid(), Name = name, Country = country };
        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = $"{name} Album",
            Artist = artist,
            ArtistId = artist.Id,
            CoverUrl = "",
            ReleaseDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Country = country,
        };
        db.AddRange(artist, album);
        return (artist, album);
    }

    /// <summary>Adds a genre row and returns it.</summary>
    public static Genre AddGenre(this AppDbContext db, string name, string slug)
    {
        var genre = new Genre { Id = Guid.NewGuid(), Name = name, Slug = slug, Color = "#123456" };
        db.Genres.Add(genre);
        return genre;
    }
}

/// <summary>A test double for HttpMessageHandler that answers requests from a delegate.</summary>
public sealed class StubHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

    public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) => _responder = responder;

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        => Task.FromResult(_responder(request));
}
