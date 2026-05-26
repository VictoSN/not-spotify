using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Data;

public static class DbSeeder
{
    // Stable GUIDs so re-seeding is idempotent.
    private static Guid G(string s) => new(System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(s)));

    public const string AdminRole = "Admin";

    public static async Task SeedAsync(IServiceProvider sp)
    {
        var db = sp.GetRequiredService<AppDbContext>();
        var users = sp.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = sp.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

        // Always-run (idempotent): ensure Admin role exists + demo user is in it.
        if (!await roles.RoleExistsAsync(AdminRole))
            await roles.CreateAsync(new IdentityRole<Guid>(AdminRole) { Id = Guid.NewGuid() });

        // Seed user (matches frontend mockUser).
        var demoUser = await users.FindByEmailAsync("alex@example.com");
        if (demoUser is null)
        {
            demoUser = new ApplicationUser
            {
                Id = G("user-1"),
                UserName = "alex@example.com",
                Email = "alex@example.com",
                Name = "Alex Rivera",
                AvatarUrl = "https://picsum.photos/seed/user1/100/100",
                Plan = "premium",
                Country = "US",
                CreatedAt = new DateTime(2022, 1, 10, 0, 0, 0, DateTimeKind.Utc),
                EmailConfirmed = true,
            };
            var result = await users.CreateAsync(demoUser, "Password123!");
            if (!result.Succeeded)
                throw new InvalidOperationException("Seed user creation failed: " + string.Join(", ", result.Errors.Select(e => e.Description)));
        }

        if (!await users.IsInRoleAsync(demoUser, AdminRole))
            await users.AddToRoleAsync(demoUser, AdminRole);

        if (await db.Artists.AnyAsync()) return;

        // Genres
        var genres = new[]
        {
            new Genre { Id = G("g-1"),  Name = "Pop",        Slug = "pop",        Color = "#E91E63", ImageUrl = "https://picsum.photos/seed/gpop/200/200" },
            new Genre { Id = G("g-2"),  Name = "Hip-Hop",    Slug = "hip-hop",    Color = "#FF5722", ImageUrl = "https://picsum.photos/seed/ghiphop/200/200" },
            new Genre { Id = G("g-3"),  Name = "R&B",        Slug = "rnb",        Color = "#9C27B0", ImageUrl = "https://picsum.photos/seed/grnb/200/200" },
            new Genre { Id = G("g-4"),  Name = "Electronic", Slug = "electronic", Color = "#2196F3", ImageUrl = "https://picsum.photos/seed/gelec/200/200" },
            new Genre { Id = G("g-5"),  Name = "Indie",      Slug = "indie",      Color = "#4CAF50", ImageUrl = "https://picsum.photos/seed/gindie/200/200" },
            new Genre { Id = G("g-6"),  Name = "Synthwave",  Slug = "synthwave",  Color = "#673AB7", ImageUrl = "https://picsum.photos/seed/gsynth/200/200" },
            new Genre { Id = G("g-7"),  Name = "Lo-Fi",      Slug = "lo-fi",      Color = "#795548", ImageUrl = "https://picsum.photos/seed/glofi/200/200" },
            new Genre { Id = G("g-8"),  Name = "Post-Rock",  Slug = "post-rock",  Color = "#607D8B", ImageUrl = "https://picsum.photos/seed/gpost/200/200" },
            new Genre { Id = G("g-9"),  Name = "Jazz",       Slug = "jazz",       Color = "#FF9800", ImageUrl = "https://picsum.photos/seed/gjazz/200/200" },
            new Genre { Id = G("g-10"), Name = "Classical",  Slug = "classical",  Color = "#00BCD4", ImageUrl = "https://picsum.photos/seed/gclass/200/200" },
            new Genre { Id = G("g-11"), Name = "Metal",      Slug = "metal",      Color = "#424242", ImageUrl = "https://picsum.photos/seed/gmetal/200/200" },
            new Genre { Id = G("g-12"), Name = "Country",    Slug = "country",    Color = "#8BC34A", ImageUrl = "https://picsum.photos/seed/gcountry/200/200" },
        };

        // Extra genre slugs that appear in track data but not in the canonical list — we map them to their parent where possible by re-using slugs.
        // dream-pop, neo-soul, bedroom-pop, alternative, retrowave, instrumental aren't in the canonical genres list — add as slugs for browse parity.
        var extras = new[] { "dream-pop", "neo-soul", "bedroom-pop", "alternative", "retrowave", "instrumental" };
        var extraGenres = extras.Select(slug => new Genre
        {
            Id = G("g-extra-" + slug),
            Name = string.Join(' ', slug.Split('-').Select(p => char.ToUpper(p[0]) + p[1..])),
            Slug = slug,
            Color = "#888888",
            ImageUrl = $"https://picsum.photos/seed/g{slug}/200/200",
        }).ToArray();

        db.Genres.AddRange(genres);
        db.Genres.AddRange(extraGenres);

        // Artists
        var artists = new[]
        {
            new Artist { Id = G("artist-1"), Name = "Luna Waves",       Bio = "Indie electronic artist blending dreamy synths with introspective lyrics.", ImageUrl = "https://picsum.photos/seed/artist1/300/300",  HeaderImageUrl = "https://picsum.photos/seed/artist1h/1200/400", MonthlyListeners = 4_200_000, FollowerCount = 980_000,   Verified = true,  Instagram = "lunawaves",      Twitter = "lunawaves",      CreatedAt = new DateTime(2020, 3, 15, 0, 0, 0, DateTimeKind.Utc) },
            new Artist { Id = G("artist-2"), Name = "The Hollow Echo",  Bio = "Post-rock quartet from Portland with cinematic, expansive soundscapes.",     ImageUrl = "https://picsum.photos/seed/artist2/300/300",  HeaderImageUrl = "https://picsum.photos/seed/artist2h/1200/400", MonthlyListeners = 1_800_000, FollowerCount = 420_000,   Verified = true,  Instagram = "thehollowecho",                            CreatedAt = new DateTime(2018, 7, 1,  0, 0, 0, DateTimeKind.Utc) },
            new Artist { Id = G("artist-3"), Name = "Kiera Solano",     Bio = "R&B and neo-soul vocalist with silky flows and vivid storytelling.",         ImageUrl = "https://picsum.photos/seed/artist3/300/300",  HeaderImageUrl = "https://picsum.photos/seed/artist3h/1200/400", MonthlyListeners = 7_100_000, FollowerCount = 2_300_000, Verified = true,  Instagram = "kierasolano",    Twitter = "kierasolano",    Website = "https://kierasolano.com", CreatedAt = new DateTime(2017, 1, 20, 0, 0, 0, DateTimeKind.Utc) },
            new Artist { Id = G("artist-4"), Name = "Static Bloom",     Bio = "Bedroom pop producer crafting lo-fi beats and hazy guitars.",                ImageUrl = "https://picsum.photos/seed/artist4/300/300",  HeaderImageUrl = "https://picsum.photos/seed/artist4h/1200/400", MonthlyListeners = 620_000,   FollowerCount = 145_000,   Verified = false, Instagram = "staticbloom",                              CreatedAt = new DateTime(2021, 9, 10, 0, 0, 0, DateTimeKind.Utc) },
            new Artist { Id = G("artist-5"), Name = "Neon Corridor",    Bio = "Synthwave duo channeling 80s nostalgia with modern production flair.",      ImageUrl = "https://picsum.photos/seed/artist5/300/300",  HeaderImageUrl = "https://picsum.photos/seed/artist5h/1200/400", MonthlyListeners = 3_400_000, FollowerCount = 890_000,   Verified = true,                              Twitter = "neoncorridor", Website = "https://neoncorridor.fm", CreatedAt = new DateTime(2019, 4, 22, 0, 0, 0, DateTimeKind.Utc) },
        };
        db.Artists.AddRange(artists);

        // Albums
        var albums = new[]
        {
            new Album { Id = G("album-1"), ArtistId = artists[0].Id, Title = "Tidal Drift",        Type = "album",  CoverUrl = "https://picsum.photos/seed/album1/300/300", ReleaseDate = new DateOnly(2023, 6, 15),  TotalTracks = 10, DurationMs = 2_580_000, Label = "Dreamgate Records", Copyright = "© 2023 Dreamgate Records", Popularity = 82 },
            new Album { Id = G("album-2"), ArtistId = artists[1].Id, Title = "Ruins & Resonance", Type = "album",  CoverUrl = "https://picsum.photos/seed/album2/300/300", ReleaseDate = new DateOnly(2022, 11, 3),  TotalTracks = 8,  DurationMs = 3_120_000, Label = "Cascade Music",     Copyright = "© 2022 Cascade Music",     Popularity = 74 },
            new Album { Id = G("album-3"), ArtistId = artists[2].Id, Title = "Golden Hours",      Type = "album",  CoverUrl = "https://picsum.photos/seed/album3/300/300", ReleaseDate = new DateOnly(2024, 2, 14),  TotalTracks = 12, DurationMs = 2_940_000, Label = "Velvet Sound",      Copyright = "© 2024 Velvet Sound",      Popularity = 91 },
            new Album { Id = G("album-4"), ArtistId = artists[3].Id, Title = "Tape Hiss Diaries", Type = "ep",     CoverUrl = "https://picsum.photos/seed/album4/300/300", ReleaseDate = new DateOnly(2024, 5, 20),  TotalTracks = 5,  DurationMs = 1_200_000, Label = null,                Copyright = null,                       Popularity = 58 },
            new Album { Id = G("album-5"), ArtistId = artists[4].Id, Title = "Drive Forever",     Type = "album",  CoverUrl = "https://picsum.photos/seed/album5/300/300", ReleaseDate = new DateOnly(2023, 10, 31), TotalTracks = 9,  DurationMs = 2_700_000, Label = "Neon Prism",        Copyright = "© 2023 Neon Prism",        Popularity = 87 },
        };
        db.Albums.AddRange(albums);

        // Tracks (12, matches frontend)
        var trackCreated = new[]
        {
            new DateTime(2023, 6, 15, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2022, 11, 3, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2024, 2, 14, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2024, 5, 20, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2023, 10, 31, 0, 0, 0, DateTimeKind.Utc),
        };

        var trackData = new (string id, string title, long dur, int song, int trackNo, Guid artistId, Guid albumId, DateTime created, bool explicitFlag, long playCount, string[] genreSlugs)[]
        {
            ("track-1",  "Tidal Drift",     224_000, 1, 1, artists[0].Id, albums[0].Id, trackCreated[0], false,  8_400_000, new[]{"indie","electronic"}),
            ("track-2",  "Glass Corridors", 198_000, 2, 2, artists[0].Id, albums[0].Id, trackCreated[0], false,  5_200_000, new[]{"indie","dream-pop"}),
            ("track-3",  "Hollow Ground",   412_000, 3, 1, artists[1].Id, albums[1].Id, trackCreated[1], false,  3_100_000, new[]{"post-rock","instrumental"}),
            ("track-4",  "Collapse & Bloom",388_000, 4, 2, artists[1].Id, albums[1].Id, trackCreated[1], false,  2_700_000, new[]{"post-rock","alternative"}),
            ("track-5",  "Golden Hours",    214_000, 5, 1, artists[2].Id, albums[2].Id, trackCreated[2], false, 18_900_000, new[]{"rnb","neo-soul"}),
            ("track-6",  "Slow Burn",       232_000, 6, 2, artists[2].Id, albums[2].Id, trackCreated[2], false, 14_200_000, new[]{"rnb","pop"}),
            ("track-7",  "Tape Hiss",       187_000, 7, 1, artists[3].Id, albums[3].Id, trackCreated[3], false,    920_000, new[]{"lo-fi","bedroom-pop"}),
            ("track-8",  "Sunday Static",   203_000, 8, 2, artists[3].Id, albums[3].Id, trackCreated[3], false,    810_000, new[]{"lo-fi","indie"}),
            ("track-9",  "Drive Forever",   296_000, 9, 1, artists[4].Id, albums[4].Id, trackCreated[4], false, 11_300_000, new[]{"synthwave","electronic"}),
            ("track-10", "Neon Rain",       312_000,10, 2, artists[4].Id, albums[4].Id, trackCreated[4], false,  9_600_000, new[]{"synthwave","retrowave"}),
            ("track-11", "Midnight Signal", 248_000,11, 3, artists[0].Id, albums[0].Id, trackCreated[0], false,  6_100_000, new[]{"electronic","dream-pop"}),
            ("track-12", "Velvet Throne",   219_000,12, 3, artists[2].Id, albums[2].Id, trackCreated[2], true,  12_500_000, new[]{"rnb","neo-soul"}),
        };

        var slugToGenreId = await db.Genres.ToDictionaryAsync(g => g.Slug, g => g.Id);
        foreach (var newGenre in genres.Concat(extraGenres))
            slugToGenreId[newGenre.Slug] = newGenre.Id;

        var tracks = new List<Track>();
        foreach (var t in trackData)
        {
            var track = new Track
            {
                Id = G(t.id),
                Title = t.title,
                DurationMs = t.dur,
                AudioUrl = $"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-{t.song}.mp3",
                PreviewUrl = null,
                TrackNumber = t.trackNo,
                DiscNumber = 1,
                Explicit = t.explicitFlag,
                PlayCount = t.playCount,
                ArtistId = t.artistId,
                AlbumId = t.albumId,
                CreatedAt = t.created,
            };
            tracks.Add(track);

            foreach (var slug in t.genreSlugs)
                if (slugToGenreId.TryGetValue(slug, out var gid))
                    track.TrackGenres.Add(new TrackGenre { TrackId = track.Id, GenreId = gid });
        }
        db.Tracks.AddRange(tracks);

        await db.SaveChangesAsync();

        // Playlists (owned by seed user)
        var now = DateTime.UtcNow;
        void AddPlaylist(string id, string name, string description, string coverSeed, int[] trackIdxs, long followers, DateTime createdAt)
        {
            var p = new Playlist
            {
                Id = G(id),
                Name = name,
                Description = description,
                CoverUrl = $"https://picsum.photos/seed/{coverSeed}/300/300",
                IsPublic = true,
                OwnerId = demoUser!.Id,
                FollowerCount = followers,
                CreatedAt = createdAt,
                UpdatedAt = now,
            };
            db.Playlists.Add(p);

            for (int i = 0; i < trackIdxs.Length; i++)
            {
                db.PlaylistTracks.Add(new PlaylistTrack
                {
                    PlaylistId = p.Id,
                    TrackId = tracks[trackIdxs[i]].Id,
                    Position = i + 1,
                    AddedAt = now,
                    AddedByUserId = demoUser.Id,
                });
            }
        }

        AddPlaylist("playlist-1", "Evening Chill", "Wind down with ambient and dream-pop favourites.", "pl1", new[] { 0, 1, 6, 7, 10 }, 1_240, new DateTime(2023, 12, 1, 0, 0, 0, DateTimeKind.Utc));
        AddPlaylist("playlist-2", "Night Drive",   "Synthwave and retrowave for late-night cruising.", "pl2", new[] { 8, 9, 10 },       4_870, new DateTime(2023, 9, 15, 0, 0, 0, DateTimeKind.Utc));
        AddPlaylist("playlist-3", "R&B Vibes",     "The smoothest neo-soul and R&B cuts right now.",   "pl3", new[] { 4, 5, 11 },       9_300, new DateTime(2024, 1, 20, 0, 0, 0, DateTimeKind.Utc));

        await db.SaveChangesAsync();
    }
}
