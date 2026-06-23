using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

/// <summary>
/// One-off bulk catalogue importer (`dotnet run -- import-music [--path &lt;dir&gt;] [--dry-run]`).
/// Walks a local "Artist - Album (Year)" folder tree of .m4a (+ optional .lrc) files and
/// idempotently creates Artists / Albums / Tracks in the database, uploading audio and
/// covers to the configured <see cref="IStorageService"/> (S3 in production). Track durations
/// and waveform peaks come from ffmpeg/ffprobe; album covers + release dates come from the
/// free iTunes Search API; genre + country are filled from a curated per-artist table.
///
/// Mirrors the existing `migrate-storage` / `ensure-s3-cors` CLI commands in Program.cs:
/// it runs after the host is built (so DI + migrations are ready) and then exits.
/// </summary>
public static class MusicImporter
{
    // Curated facts for the artists in the seed library. Genre slugs map to Genre rows
    // (created on demand). Country is ISO-3166 alpha-2. Listener/follower counts are
    // ballpark figures so artist pages don't render as brand-new zero-listener acts.
    private record ArtistInfo(string Country, string[] GenreSlugs, string Bio,
        long MonthlyListeners, long Followers, string? Instagram, string? Twitter,
        string? SpotifyId = null);

    private static readonly Dictionary<string, ArtistInfo> KnownArtists = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Arctic Monkeys"] = new("GB", new[] { "indie", "rock", "alternative" },
            "Sheffield indie-rock band fronted by Alex Turner, known for sharp, literate songwriting that has evolved from garage-rock to lounge-pop.",
            52_000_000, 31_000_000, "arcticmonkeys", "arcticmonkeys"),
        ["Eminem"] = new("US", new[] { "hip-hop" },
            "Detroit rapper and one of the best-selling music artists of all time, famed for rapid-fire technical rhyming and the Slim Shady persona.",
            74_000_000, 96_000_000, "eminem", "eminem"),
        ["John Denver"] = new("US", new[] { "country", "folk" },
            "American singer-songwriter whose warm folk and country-pop anthems like 'Take Me Home, Country Roads' became enduring standards.",
            13_000_000, 3_500_000, null, null),
        ["Linkin Park"] = new("US", new[] { "rock", "metal", "alternative" },
            "California band that fused nu-metal, rap and electronics into one of the defining rock sounds of the 2000s.",
            61_000_000, 28_000_000, "linkinpark", "linkinpark"),
        ["Nirvana"] = new("US", new[] { "rock", "grunge", "alternative" },
            "Aberdeen, Washington trio led by Kurt Cobain whose raw sound brought grunge into the mainstream and reshaped 90s rock.",
            42_000_000, 16_000_000, "nirvana", null),
        ["Ado"] = new("JP", new[] { "j-pop", "pop", "rock" },
            "Tokyo-born vocalist who broke out on Niconico as an utaite and reached the mainstream at 17 with 'Usseewa'. Known for her explosive range and a public persona that keeps her face hidden, she sang 'New Genesis' for One Piece Film: Red and is one of Japan's most-streamed artists worldwide.",
            6_700_000, 5_700_000, "ado1024imokenp", "ado1024imokenp",
            SpotifyId: "6mEQK9m2krja6X1cfsAjfl"),
        ["RADWIMPS"] = new("JP", new[] { "j-rock", "rock", "alternative", "pop" },
            "Yokohama alt-rock four-piece formed in 2001 by Yojiro Noda and friends. Beloved for emotionally literate lyrics and shape-shifting arrangements, they reached a global audience scoring Makoto Shinkai's anime trilogy — Your Name (2016), Weathering With You (2019), and Suzume (2022) — and have since sold out international arena tours.",
            7_200_000, 3_500_000, "radwimps_jp", "RADWIMPS_jp",
            SpotifyId: "1EowJ1WwkMzkCkRomFhui7"),
    };

    // Fallbacks for any artist not in the table above.
    private static readonly ArtistInfo DefaultArtist =
        new("US", new[] { "rock" }, "", 1_000_000, 250_000, null, null);

    private static readonly Dictionary<string, HashSet<string>> KnownInstrumentalTracks = new(StringComparer.OrdinalIgnoreCase)
    {
        ["RADWIMPS"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Date",
            "Date 2",
            "Theme of Mitsuha",
        },
    };

    // Audio formats the importer ingests. ffprobe + ffmpeg handle all of them, and S3 stores
    // them with the right Content-Type so the browser <audio> element picks the right codec.
    private static readonly HashSet<string> AudioExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".m4a", ".flac", ".mp3", ".ogg", ".opus", ".wav" };

    private static string AudioMime(string ext) => ext switch
    {
        ".m4a" => "audio/mp4",
        ".flac" => "audio/flac",
        ".mp3" => "audio/mpeg",
        ".ogg" => "audio/ogg",
        ".opus" => "audio/ogg",
        ".wav" => "audio/wav",
        _ => "application/octet-stream",
    };

    private static readonly Dictionary<string, (string Name, string Color)> GenreMeta = new(StringComparer.OrdinalIgnoreCase)
    {
        ["rock"] = ("Rock", "#C62828"),
        ["grunge"] = ("Grunge", "#6D4C41"),
        ["folk"] = ("Folk", "#9CCC65"),
        ["indie"] = ("Indie", "#4CAF50"),
        ["alternative"] = ("Alternative", "#8E24AA"),
        ["metal"] = ("Metal", "#424242"),
        ["country"] = ("Country", "#8BC34A"),
        ["hip-hop"] = ("Hip-Hop", "#FF5722"),
        ["pop"] = ("Pop", "#EC407A"),
        ["j-pop"] = ("J-Pop", "#F06292"),
        ["j-rock"] = ("J-Rock", "#AD1457"),
        ["instrumental"] = ("Instrumental", "#607D8B"),
    };

    public static async Task RunAsync(IServiceProvider services, string[] args)
    {
        var dryRun = args.Contains("--dry-run");
        var root = GetArg(args, "--path") ?? FindDefaultMusicDir();
        if (root is null || !Directory.Exists(root))
        {
            Console.WriteLine($"[Import] Music directory not found. Pass --path <dir>. (looked for '{root}')");
            return;
        }

        Console.WriteLine($"[Import] Source: {root}");
        Console.WriteLine($"[Import] Mode:   {(dryRun ? "DRY RUN (no DB writes, no uploads)" : "LIVE")}");

        if (!await EnsureFfmpegAsync())
        {
            Console.WriteLine("[Import] ffprobe/ffmpeg not found on PATH — durations and waveforms require them. Aborting.");
            return;
        }

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<IStorageService>();
        var waveforms = scope.ServiceProvider.GetRequiredService<AudioWaveformService>();
        var httpFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
        var http = httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(30);
        http.DefaultRequestHeaders.UserAgent.ParseAdd("not-spotify-import/1.0");

        var genreCache = await db.Genres.ToDictionaryAsync(g => g.Slug, g => g, StringComparer.OrdinalIgnoreCase);

        var albumDirs = Directory.GetDirectories(root)
            .OrderBy(d => d, StringComparer.OrdinalIgnoreCase)
            .ToList();
        Console.WriteLine($"[Import] Found {albumDirs.Count} album folder(s).\n");

        int newArtists = 0, newAlbums = 0, newTracks = 0, skipped = 0;

        foreach (var dir in albumDirs)
        {
            var folder = Path.GetFileName(dir);
            var parsed = ParseFolder(folder);
            if (parsed is null)
            {
                Console.WriteLine($"[skip] Unrecognized folder name: {folder}");
                continue;
            }
            var (artistName, albumTitle, year) = parsed.Value;

            var audioFiles = Directory.GetFiles(dir)
                .Where(f => AudioExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
                .OrderBy(f => f, StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (audioFiles.Count == 0)
            {
                Console.WriteLine($"[skip] No audio files in: {folder}");
                continue;
            }

            Console.WriteLine($"== {artistName} — {albumTitle} ({year}) — {audioFiles.Count} tracks ==");

            var info = KnownArtists.TryGetValue(artistName, out var ai) ? ai : DefaultArtist;

            // ---- Artist (get-or-create by name) ----
            var artist = await db.Artists.FirstOrDefaultAsync(a => a.Name.ToLower() == artistName.ToLower());
            if (artist is null)
            {
                artist = new Artist
                {
                    Id = Guid.NewGuid(),
                    Name = artistName,
                    Bio = info.Bio,
                    Country = info.Country,
                    Verified = true,
                    MonthlyListeners = info.MonthlyListeners,
                    FollowerCount = info.Followers,
                    Instagram = info.Instagram,
                    Twitter = info.Twitter,
                    CreatedAt = DateTime.UtcNow,
                };
                if (!dryRun) db.Artists.Add(artist);
                newArtists++;
                Console.WriteLine($"   + artist created ({info.Country}, {string.Join("/", info.GenreSlugs)})");
            }

            // iTunes lookup for cover art + release date; fall back to the artwork
            // embedded in the first .m4a when iTunes has no match for the album.
            var meta = await LookupAlbumAsync(http, artistName, albumTitle);
            var coverBytes = meta?.ArtworkUrl is { } url ? await TryDownloadAsync(http, url) : null;
            if (coverBytes is null)
            {
                coverBytes = await ExtractEmbeddedArtAsync(audioFiles[0]);
                if (coverBytes is not null) Console.WriteLine("   . cover from embedded artwork (iTunes had none)");
            }
            var release = meta?.ReleaseDate ?? new DateOnly(year, 1, 1);

            // Profile + banner: prefer Spotify (scraped from the public artist page) when we
            // have a SpotifyId; otherwise fall back to the first album cover for the profile
            // and leave the banner blank (admin can upload one later).
            SpotifyImages? spotifyImages = info.SpotifyId is { } sid ? await ScrapeSpotifyImagesAsync(http, sid) : null;

            if (artist.ImageKey is null && string.IsNullOrEmpty(artist.ImageUrl))
            {
                byte[]? profileBytes = null;
                string source = "";
                if (spotifyImages is not null)
                {
                    profileBytes = await TryDownloadAsync(http, spotifyImages.ProfileUrl);
                    if (profileBytes is not null) source = "Spotify";
                }
                if (profileBytes is null && coverBytes is not null) { profileBytes = coverBytes; source = "album art"; }

                if (profileBytes is not null)
                {
                    if (!dryRun)
                    {
                        var ik = $"images/artists/{Guid.NewGuid()}.jpg";
                        await storage.UploadAsync(ik, new MemoryStream(profileBytes), "image/jpeg");
                        artist.ImageKey = ik;
                        artist.ImageUrl = null;
                    }
                    Console.WriteLine($"   + artist profile image set ({source})");
                }
            }

            // Banner / header — only Spotify provides a wide variant; skip when no match.
            if (artist.HeaderImageKey is null && string.IsNullOrEmpty(artist.HeaderImageUrl) && spotifyImages is not null)
            {
                var headerBytes = await TryDownloadAsync(http, spotifyImages.HeaderUrl);
                if (headerBytes is not null)
                {
                    if (!dryRun)
                    {
                        var hk = $"images/artists/{Guid.NewGuid()}-header.jpg";
                        await storage.UploadAsync(hk, new MemoryStream(headerBytes), "image/jpeg");
                        artist.HeaderImageKey = hk;
                        artist.HeaderImageUrl = null;
                    }
                    Console.WriteLine("   + artist banner set (Spotify)");
                }
            }

            // ---- Album (get-or-create by artist + title) ----
            var album = await db.Albums.FirstOrDefaultAsync(a => a.ArtistId == artist.Id && a.Title.ToLower() == albumTitle.ToLower());
            if (album is null)
            {
                album = new Album
                {
                    Id = Guid.NewGuid(),
                    ArtistId = artist.Id,
                    Title = albumTitle,
                    Type = ResolveAlbumType(albumTitle, audioFiles.Count),
                    ReleaseDate = release,
                    Country = info.Country,
                    Popularity = 80,
                    Status = "approved",
                    CoverUrl = string.Empty,
                };
                if (!dryRun) db.Albums.Add(album);
                newAlbums++;
                Console.WriteLine($"   + album created (release {release})");
            }

            // Ensure a cover (covers newly-created albums and backfills any existing
            // album that was imported before without one).
            if (album.CoverKey is null && coverBytes is not null && !dryRun)
            {
                var ck = $"covers/{Guid.NewGuid()}.jpg";
                await storage.UploadAsync(ck, new MemoryStream(coverBytes), "image/jpeg");
                album.CoverKey = ck;
                album.CoverUrl = string.Empty;
                Console.WriteLine($"   + cover {(meta?.ArtworkUrl is not null ? "(iTunes)" : "(embedded)")} set");
            }

            // Resolve genre rows for this artist once.
            var genres = new List<Genre>();
            foreach (var slug in info.GenreSlugs)
                genres.Add(await GetOrCreateGenreAsync(db, genreCache, slug, dryRun));

            // ---- Tracks ----
            foreach (var audioPath in audioFiles)
            {
                var (trackNo, title, isExplicit) = ParseTrackFile(audioPath);

                var existing = await db.Tracks.FirstOrDefaultAsync(t =>
                    t.AlbumId == album.Id && t.TrackNumber == trackNo && t.DiscNumber == 1);
                if (existing is not null && existing.AudioKey is not null)
                {
                    skipped++;
                    Console.WriteLine($"   = [{trackNo:00}] {title} (already imported)");
                    continue;
                }

                var durationMs = await ProbeDurationMsAsync(audioPath);
                var lrcPath = Path.ChangeExtension(audioPath, ".lrc");
                string? synced = File.Exists(lrcPath) ? await File.ReadAllTextAsync(lrcPath) : null;
                string? plain = synced is not null ? StripTimestamps(synced) : null;
                var instrumental = IsKnownInstrumental(artistName, title);
                if (instrumental)
                {
                    synced = null;
                    plain = null;
                }

                string? audioKey = null;
                string? waveformJson = null;
                if (!dryRun)
                {
                    var peaks = await waveforms.ExtractAsync(audioPath);
                    waveformJson = peaks is null ? null : JsonSerializer.Serialize(peaks);

                    var ext = Path.GetExtension(audioPath).ToLowerInvariant();
                    audioKey = $"audio/{Guid.NewGuid()}{ext}";
                    await using var fs = File.OpenRead(audioPath);
                    await storage.UploadAsync(audioKey, fs, AudioMime(ext));
                }

                if (existing is not null)
                {
                    // Row exists but never got audio — backfill it.
                    existing.AudioKey = audioKey;
                    existing.DurationMs = durationMs;
                    existing.Waveform ??= waveformJson;
                    if (instrumental)
                    {
                        existing.SyncedLyrics = "__none__";
                        existing.Lyrics = null;
                    }
                    else
                    {
                        existing.SyncedLyrics ??= synced;
                        existing.Lyrics ??= plain;
                    }
                    Console.WriteLine($"   ~ [{trackNo:00}] {title} (audio backfilled, {Fmt(durationMs)})");
                }
                else
                {
                    var track = new Track
                    {
                        Id = Guid.NewGuid(),
                        Title = title,
                        DurationMs = durationMs,
                        AudioUrl = string.Empty,
                        AudioKey = audioKey,
                        TrackNumber = trackNo,
                        DiscNumber = 1,
                        Explicit = isExplicit,
                        Status = "approved",
                        ArtistId = artist.Id,
                        AlbumId = album.Id,
                        CreatedAt = release.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                        Waveform = waveformJson,
                        SyncedLyrics = synced,
                        Lyrics = plain,
                    };
                    var trackGenres = instrumental
                        ? genres.Append(await GetOrCreateGenreAsync(db, genreCache, "instrumental", dryRun)).DistinctBy(g => g.Id)
                        : genres;
                    foreach (var g in trackGenres)
                        track.TrackGenres.Add(new TrackGenre { TrackId = track.Id, GenreId = g.Id });
                    if (!dryRun) db.Tracks.Add(track);
                    newTracks++;
                    Console.WriteLine($"   + [{trackNo:00}] {title}{(isExplicit ? " [E]" : "")} ({Fmt(durationMs)}, {(synced is not null ? "lrc" : "no lrc")})");
                }
            }

            // Roll up album stats from its tracks.
            if (!dryRun)
            {
                await db.SaveChangesAsync();
                var albumTracks = await db.Tracks.Where(t => t.AlbumId == album.Id).ToListAsync();
                album.TotalTracks = albumTracks.Count;
                album.DurationMs = albumTracks.Sum(t => t.DurationMs);
                await db.SaveChangesAsync();
            }
            Console.WriteLine();
        }

        Console.WriteLine($"[Import] Done. +{newArtists} artists, +{newAlbums} albums, +{newTracks} tracks, {skipped} tracks skipped (already present).");
        if (dryRun) Console.WriteLine("[Import] DRY RUN — nothing was written.");
    }

    // ---------- parsing ----------

    private static (string artist, string album, int year)? ParseFolder(string folder)
    {
        var m = Regex.Match(folder, @"^(?<artist>.+?) - (?<rest>.+) \((?<year>\d{4})\)\s*$");
        if (!m.Success) return null;
        var artist = m.Groups["artist"].Value.Trim();
        var rest = m.Groups["rest"].Value;
        var year = int.Parse(m.Groups["year"].Value);

        // Strip bracketed [..] tags and edition qualifiers in (..) so the title is clean.
        rest = Regex.Replace(rest, @"\s*\[[^\]]*\]", "");
        rest = Regex.Replace(rest,
            @"\s*\((?:Standard Version|Standard Edition|Remastered[^)]*|Explicit Version|Deluxe[^)]*|Special Edition|Expanded Edition|Anniversary[^)]*|Bonus[^)]*)\)",
            "", RegexOptions.IgnoreCase);
        var album = Regex.Replace(rest, @"\s+", " ").Trim();
        return (artist, album, year);
    }

    private static string ResolveAlbumType(string title, int trackCount)
    {
        if (title.Contains("Greatest Hits", StringComparison.OrdinalIgnoreCase)) return "compilation";
        if (trackCount <= 1) return "single";
        if (trackCount <= 6) return "ep";
        return "album";
    }

    private static (int trackNo, string title, bool isExplicit) ParseTrackFile(string path)
    {
        var name = Path.GetFileNameWithoutExtension(path);
        var m = Regex.Match(name, @"^\s*(?<no>\d+)\s*[-.]\s*(?<title>.+)$");
        var trackNo = m.Success ? int.Parse(m.Groups["no"].Value) : 0;
        var title = m.Success ? m.Groups["title"].Value : name;

        var isExplicit = Regex.IsMatch(title, @"\[explicit\]", RegexOptions.IgnoreCase);
        title = Regex.Replace(title, @"\s*\[explicit\]", "", RegexOptions.IgnoreCase);
        // Underscores in these filenames stand in for characters illegal on disk (usually '?').
        title = title.Replace("_", "?");
        title = Regex.Replace(title, @"\s+", " ").Trim();
        return (trackNo, title, isExplicit);
    }

    private static bool IsKnownInstrumental(string artistName, string title)
        => KnownInstrumentalTracks.TryGetValue(artistName, out var titles) && titles.Contains(title);

    private static string StripTimestamps(string lrc)
    {
        var lines = lrc.Replace("\r\n", "\n").Split('\n')
            .Select(l => Regex.Replace(l, @"\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]", "").Trim())
            .Where(l => l.Length > 0);
        return string.Join("\n", lines);
    }

    // ---------- genres ----------

    private static async Task<Genre> GetOrCreateGenreAsync(
        AppDbContext db, Dictionary<string, Genre> cache, string slug, bool dryRun)
    {
        if (cache.TryGetValue(slug, out var g)) return g;
        var (name, color) = GenreMeta.TryGetValue(slug, out var meta)
            ? meta
            : (char.ToUpper(slug[0]) + slug[1..], "#888888");
        g = new Genre
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            Color = color,
            ImageUrl = $"https://picsum.photos/seed/g{slug}/200/200",
        };
        if (!dryRun) db.Genres.Add(g);
        cache[slug] = g;
        Console.WriteLine($"   + genre created: {name}");
        return g;
    }

    // ---------- Spotify artist image scraper ----------

    // Spotify embeds artist images in the public artist page as i.scdn.co URLs. The
    // 16-char prefix encodes the size; only three are exposed publicly:
    //   ab6761610000f178 = 160x160 (thumb)
    //   ab67616100005174 = 320x320 (medium)
    //   ab6761610000e5eb = 640x640 (largest available without OAuth)
    // Higher-res variants exist but require the Spotify Web API. Use the 640px for
    // both avatar and banner — Spotify itself stretches the same image for the page
    // header, so this matches what's on spotify.com.
    private record SpotifyImages(string ProfileUrl, string HeaderUrl);

    private static async Task<SpotifyImages?> ScrapeSpotifyImagesAsync(HttpClient http, string spotifyId)
    {
        try
        {
            using var res = await http.GetAsync($"https://open.spotify.com/artist/{spotifyId}");
            if (!res.IsSuccessStatusCode) return null;
            var html = await res.Content.ReadAsStringAsync();
            // Grab the first artist-image hash (ab67616100... prefix). The 24-char hash
            // is everything after the 16-char size prefix.
            var m = Regex.Match(html, @"i\.scdn\.co/image/ab67616100[0-9a-f]{6}(?<hash>[0-9a-f]{24})");
            if (!m.Success) return null;
            var hash = m.Groups["hash"].Value;
            var largest = $"https://i.scdn.co/image/ab6761610000e5eb{hash}";
            return new SpotifyImages(ProfileUrl: largest, HeaderUrl: largest);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"   ! Spotify image scrape failed for id={spotifyId}: {ex.Message}");
            return null;
        }
    }

    // ---------- iTunes lookup ----------

    private record AlbumMeta(string? ArtworkUrl, DateOnly? ReleaseDate);

    private static async Task<AlbumMeta?> LookupAlbumAsync(HttpClient http, string artist, string album)
    {
        try
        {
            var term = Uri.EscapeDataString($"{artist} {album}");
            var u = $"https://itunes.apple.com/search?term={term}&entity=album&limit=10&country=US";
            using var res = await http.GetAsync(u);
            if (!res.IsSuccessStatusCode) return null;
            await using var s = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(s);
            if (!doc.RootElement.TryGetProperty("results", out var results)) return null;

            // Prefer an artist+title match; fall back to a title-only match (soundtracks
            // are credited to "Various Artists" but still carry the right cover), then to
            // the first artist match.
            JsonElement? artistAndTitle = null, titleOnly = null, artistOnly = null;
            foreach (var r in results.EnumerateArray())
            {
                var coll = r.TryGetProperty("collectionName", out var c) ? c.GetString() ?? "" : "";
                var art = r.TryGetProperty("artistName", out var a) ? a.GetString() ?? "" : "";
                var artistMatch = art.Contains(artist, StringComparison.OrdinalIgnoreCase) ||
                                  artist.Contains(art, StringComparison.OrdinalIgnoreCase);
                var titleMatch = coll.Contains(album, StringComparison.OrdinalIgnoreCase) ||
                                 album.Contains(coll, StringComparison.OrdinalIgnoreCase);
                if (artistMatch && titleMatch) { artistAndTitle = r; break; }
                if (titleMatch) titleOnly ??= r;
                else if (artistMatch) artistOnly ??= r;
            }
            var best = artistAndTitle ?? titleOnly ?? artistOnly;
            if (best is null) return null;
            var elem = best.Value;

            string? artwork = null;
            if (elem.TryGetProperty("artworkUrl100", out var aw) && aw.GetString() is { } a100)
                artwork = a100.Replace("100x100bb", "600x600bb").Replace("100x100", "600x600");

            DateOnly? release = null;
            if (elem.TryGetProperty("releaseDate", out var rd) && rd.GetString() is { } rdStr &&
                DateTime.TryParse(rdStr, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var dt))
                release = DateOnly.FromDateTime(dt);

            return new AlbumMeta(artwork, release);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"   ! iTunes lookup failed for '{artist} - {album}': {ex.Message}");
            return null;
        }
    }

    /// <summary>Pull the cover art embedded in an .m4a (mjpeg/png attached_pic) via ffmpeg.</summary>
    private static async Task<byte[]?> ExtractEmbeddedArtAsync(string audioPath)
    {
        var tmp = Path.Combine(Path.GetTempPath(), $"nsimport-art-{Guid.NewGuid()}.jpg");
        try
        {
            using var p = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "ffmpeg",
                    Arguments = $"-v error -y -i \"{audioPath}\" -an -c:v mjpeg -frames:v 1 \"{tmp}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                },
            };
            p.Start();
            await p.WaitForExitAsync();
            if (p.ExitCode == 0 && File.Exists(tmp) && new FileInfo(tmp).Length > 0)
                return await File.ReadAllBytesAsync(tmp);
        }
        catch { /* no embedded art */ }
        finally
        {
            try { if (File.Exists(tmp)) File.Delete(tmp); } catch { /* ignore */ }
        }
        return null;
    }

    private static async Task<byte[]?> TryDownloadAsync(HttpClient http, string url)
    {
        try
        {
            using var res = await http.GetAsync(url);
            return res.IsSuccessStatusCode ? await res.Content.ReadAsByteArrayAsync() : null;
        }
        catch { return null; }
    }

    // ---------- ffmpeg helpers ----------

    private static async Task<long> ProbeDurationMsAsync(string path)
    {
        try
        {
            using var p = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "ffprobe",
                    Arguments = $"-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 \"{path}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                },
            };
            p.Start();
            var outp = await p.StandardOutput.ReadToEndAsync();
            await p.WaitForExitAsync();
            if (double.TryParse(outp.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var secs))
                return (long)Math.Round(secs * 1000);
        }
        catch { /* fall through */ }
        return 0;
    }

    private static async Task<bool> EnsureFfmpegAsync()
    {
        try
        {
            using var p = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "ffprobe", Arguments = "-version",
                    RedirectStandardOutput = true, RedirectStandardError = true,
                    UseShellExecute = false, CreateNoWindow = true,
                },
            };
            p.Start();
            await p.WaitForExitAsync();
            return p.ExitCode == 0;
        }
        catch { return false; }
    }

    // ---------- misc ----------

    private static string? GetArg(string[] args, string name)
    {
        var i = Array.IndexOf(args, name);
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    private static string? FindDefaultMusicDir()
    {
        // Search upward from the working directory for a "Music" folder (repo root).
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        for (int i = 0; i < 6 && dir is not null; i++, dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "Music");
            if (Directory.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static string Fmt(long ms) => $"{ms / 60000}:{(ms / 1000) % 60:00}";
}
