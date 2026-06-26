using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

/// <summary>
/// One-off bulk ingest CLI. Reads the repo-root <c>Music Videos/</c> and
/// <c>Podcast/</c> folders, uploads each media file to the configured S3 bucket
/// (under <c>videos/{guid}.ext</c> / <c>audio/{guid}.ext</c>) and inserts the
/// matching <see cref="MusicVideo"/> / <see cref="Podcast"/> + <see cref="Episode"/>
/// rows into the database — i.e. "push to S3 + RDS" in one pass.
///
/// Run from <c>backend/src/NotSpotify.Api</c>:
/// <code>
///   dotnet run -- ingest-media                       # upload + insert + thumbnails (idempotent)
///   dotnet run -- ingest-media --dry-run             # preview, writes nothing
///   dotnet run -- ingest-media --thumbnails          # only (re)generate missing thumbnails
///   dotnet run -- ingest-media --remove-placeholders # delete the seeded demo videos/podcasts
/// </code>
/// Durations are read with <c>ffprobe</c> and thumbnails grabbed with <c>ffmpeg</c>
/// (resolved on PATH or the WinGet Links folder). Idempotent: a video with the same
/// title, or an episode with the same show + number, is skipped on re-run; a row
/// that already has a thumbnail is left alone.
/// </summary>
public static class MediaIngest
{
    public static async Task RunAsync(IConfiguration config, string[] args)
    {
        var dryRun = args.Contains("--dry-run");

        var sec = config.GetSection("S3Storage");
        if (string.IsNullOrWhiteSpace(sec["BucketName"]))
        {
            Console.WriteLine("[Ingest] No 'S3Storage:BucketName' configured — set it in user-secrets. Aborting.");
            return;
        }
        var storage = new S3StorageService(Options.Create(sec.Get<S3StorageOptions>()!));

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(config.GetConnectionString("Postgres")));
        await using var sp = services.BuildServiceProvider();
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var repoRoot = FindRepoRoot();
        var videosDir = Path.Combine(repoRoot, "Music Videos");
        var podcastDir = Path.Combine(repoRoot, "Podcast");

        var ffprobe = ResolveTool("ffprobe");
        var ffmpeg = ResolveTool("ffmpeg");
        Console.WriteLine($"[Ingest] repo root: {repoRoot}");
        Console.WriteLine($"[Ingest] ffprobe:   {ffprobe ?? "NOT FOUND (durations will be 0)"}");
        Console.WriteLine($"[Ingest] ffmpeg:    {ffmpeg ?? "NOT FOUND (thumbnails skipped)"}");
        Console.WriteLine($"[Ingest] bucket:    {sec["BucketName"]}{(dryRun ? "   (DRY RUN)" : "")}");
        Console.WriteLine();

        if (args.Contains("--remove-placeholders"))
        {
            await RemovePlaceholdersAsync(db, dryRun);
            Console.WriteLine("\n[Ingest] Done.");
            return;
        }

        if (args.Contains("--team-coco"))
        {
            await SetupTeamCocoAsync(db, storage, args, dryRun);
            Console.WriteLine("\n[Ingest] Done.");
            return;
        }

        if (!args.Contains("--thumbnails"))
        {
            await IngestMusicVideosAsync(db, storage, videosDir, ffprobe, ffmpeg, dryRun);
            await IngestPodcastAsync(db, storage, podcastDir, ffprobe, ffmpeg, dryRun);
        }

        await BackfillThumbnailsAsync(db, storage, ffmpeg, videosDir, podcastDir, dryRun);

        Console.WriteLine("\n[Ingest] Done.");
    }

    // ---- Placeholder removal -----------------------------------------------

    // Exact titles of the seeded demo music videos the user asked to remove
    // (Arctic Monkeys "Brianstorm"/"Teddy Picker" + Vaundy "踊り子"/"怪獣の花唄").
    // They point at external sample footage, so there is no S3 object of their own.
    private static readonly string[] PlaceholderVideoTitles =
    {
        "Brianstorm (Official Video)",
        "Teddy Picker (Official Video)",
        "踊り子 (Official Video)",
        "怪獣の花唄 (Official Video)",
    };

    private static async Task RemovePlaceholdersAsync(AppDbContext db, bool dryRun)
    {
        var videos = await db.MusicVideos.Where(v => PlaceholderVideoTitles.Contains(v.Title))
            .Select(v => v.Title).ToListAsync();
        Console.WriteLine($"[Clean] {videos.Count} placeholder music videos:");
        foreach (var t in videos) Console.WriteLine($"[Clean]   - {t}");

        // Seeded demo podcasts by "NS Studios"; their episodes reuse real tracks'
        // audio keys, so we only delete the DB rows (never the shared S3 objects).
        var pods = await db.Podcasts
            .Where(p => p.Author == "NS Studios" &&
                        (p.Title == "The Not Spotify Show" || p.Title == "Indie Spotlight"))
            .Select(p => new { p.Id, p.Title }).ToListAsync();
        Console.WriteLine($"[Clean] {pods.Count} placeholder podcasts:");
        foreach (var p in pods) Console.WriteLine($"[Clean]   - {p.Title}");

        if (dryRun) { Console.WriteLine("[Clean] (dry run — nothing deleted)"); return; }

        var podIds = pods.Select(p => p.Id).ToList();
        var eps = await db.Episodes.Where(e => podIds.Contains(e.PodcastId)).ExecuteDeleteAsync();
        var podDel = await db.Podcasts.Where(p => podIds.Contains(p.Id)).ExecuteDeleteAsync();
        var vidDel = await db.MusicVideos.Where(v => PlaceholderVideoTitles.Contains(v.Title)).ExecuteDeleteAsync();
        Console.WriteLine($"[Clean] Deleted {vidDel} music videos, {podDel} podcasts, {eps} episodes.");
    }

    // ---- Team Coco account --------------------------------------------------

    /// <summary>Create/refresh the "Team Coco" artist account (bio + web-sourced
    /// profile/header art) and point the Conan podcast's Author at it, swapping its
    /// placeholder cover for the real show artwork. Asset paths come from
    /// <c>--profile</c>/<c>--header</c>/<c>--cover</c>.</summary>
    private static async Task SetupTeamCocoAsync(AppDbContext db, IStorageService storage, string[] args, bool dryRun)
    {
        const string name = "Team Coco";
        var profile = ArgValue(args, "--profile");
        var header = ArgValue(args, "--header");
        var cover = ArgValue(args, "--cover");

        var artist = await db.Artists.FirstOrDefaultAsync(a => a.Name == name);
        if (artist is null)
        {
            artist = new Artist { Id = Guid.NewGuid(), Name = name };
            Console.WriteLine($"[TeamCoco] creating artist account {artist.Id}.");
            if (!dryRun) db.Artists.Add(artist);
        }
        else
        {
            Console.WriteLine($"[TeamCoco] using existing artist account {artist.Id}.");
        }

        artist.Bio = "Team Coco is the digital media company and podcast network founded by " +
                     "Conan O'Brien — home to Conan O'Brien Needs A Friend and a roster of " +
                     "comedy and conversation shows.";
        artist.Country = "US";
        artist.Verified = true;
        artist.Website = "https://teamcoco.com";
        artist.Instagram = "teamcoco";
        artist.Twitter = "TeamCoco";

        if (profile is not null && File.Exists(profile))
        {
            var key = $"images/artists/{Guid.NewGuid()}.jpg";
            if (!dryRun) { await using var fs = File.OpenRead(profile); await storage.UploadAsync(key, fs, "image/jpeg"); }
            artist.ImageKey = key; artist.ImageUrl = null;
            Console.WriteLine($"[TeamCoco] profile image -> {key}");
        }
        if (header is not null && File.Exists(header))
        {
            var key = $"headers/{Guid.NewGuid()}.jpg";
            if (!dryRun) { await using var fs = File.OpenRead(header); await storage.UploadAsync(key, fs, "image/jpeg"); }
            artist.HeaderImageKey = key; artist.HeaderImageUrl = null;
            Console.WriteLine($"[TeamCoco] header image -> {key}");
        }
        if (!dryRun) await db.SaveChangesAsync();

        var pod = await db.Podcasts.FirstOrDefaultAsync(p => p.Title == "Conan O'Brien Needs A Friend");
        if (pod is null) { Console.WriteLine("[TeamCoco] podcast not found — skipping author/cover."); return; }

        pod.Author = name;
        Console.WriteLine($"[TeamCoco] podcast author set to '{name}'.");

        if (cover is not null && File.Exists(cover))
        {
            var oldKey = pod.ImageKey;
            var key = $"covers/{Guid.NewGuid():N}.jpg";
            if (!dryRun)
            {
                await using (var fs = File.OpenRead(cover)) await storage.UploadAsync(key, fs, "image/jpeg");
                pod.ImageKey = key;
                await db.SaveChangesAsync();
                if (!string.IsNullOrWhiteSpace(oldKey) && oldKey != key)
                    try { await storage.DeleteAsync(oldKey); Console.WriteLine($"[TeamCoco] removed placeholder cover {oldKey}."); }
                    catch (Exception ex) { Console.WriteLine($"[TeamCoco] couldn't delete old cover: {ex.Message}"); }
            }
            Console.WriteLine($"[TeamCoco] podcast cover -> {key}");
        }
        else if (!dryRun)
        {
            await db.SaveChangesAsync();
        }
    }

    private static string? ArgValue(string[] args, string name)
    {
        var i = Array.IndexOf(args, name);
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    // ---- Music videos -------------------------------------------------------

    private static async Task IngestMusicVideosAsync(
        AppDbContext db, IStorageService storage, string dir, string? ffprobe, string? ffmpeg, bool dryRun)
    {
        if (!Directory.Exists(dir)) { Console.WriteLine($"[Videos] folder not found: {dir} — skipping."); return; }

        const string artistName = "Nirvana";
        var artist = await db.Artists.FirstOrDefaultAsync(a => a.Name == artistName);
        if (artist is null)
        {
            artist = new Artist { Id = Guid.NewGuid(), Name = artistName, Country = "US", Verified = true };
            Console.WriteLine($"[Videos] artist '{artistName}' not found — creating {artist.Id}.");
            if (!dryRun) db.Artists.Add(artist);
        }
        else
        {
            Console.WriteLine($"[Videos] using existing artist '{artistName}' ({artist.Id}).");
        }

        var files = Directory.GetFiles(dir, "*.mp4").OrderBy(f => f, StringComparer.Ordinal).ToList();
        Console.WriteLine($"[Videos] {files.Count} .mp4 files.");

        foreach (var file in files)
        {
            var title = CleanVideoTitle(Path.GetFileNameWithoutExtension(file), artistName);

            if (await db.MusicVideos.AnyAsync(v => v.Title == title))
            {
                Console.WriteLine($"[Videos] SKIP (exists): {title}");
                continue;
            }

            var durationMs = ProbeDurationMs(ffprobe, file);
            var key = $"videos/{Guid.NewGuid():N}.mp4";

            var core = CoreTitle(title, artistName);
            var track = await db.Tracks.FirstOrDefaultAsync(
                t => t.ArtistId == artist.Id && t.Title.ToLower() == core.ToLower());

            Console.WriteLine($"[Videos] {(dryRun ? "would upload" : "uploading")} {Path.GetFileName(file)} -> {key} "
                + $"({new FileInfo(file).Length:N0} bytes, {durationMs} ms)"
                + (track is not null ? $"  [linked track {track.Id}]" : ""));

            var thumbKey = await EnsureThumbAsync(storage, ffmpeg, file, 15, dryRun);

            if (!dryRun)
            {
                await using (var fs = File.OpenRead(file))
                    await storage.UploadAsync(key, fs, "video/mp4");

                db.MusicVideos.Add(new MusicVideo
                {
                    Id = Guid.NewGuid(),
                    Title = title,
                    ArtistId = artist.Id,
                    TrackId = track?.Id,
                    VideoUrl = string.Empty,
                    VideoKey = key,
                    ThumbnailKey = thumbKey,
                    DurationMs = durationMs,
                    CreatedAt = DateTime.UtcNow,
                });
                await db.SaveChangesAsync();
            }
        }
    }

    // ---- Podcast ------------------------------------------------------------

    private static async Task IngestPodcastAsync(
        AppDbContext db, IStorageService storage, string dir, string? ffprobe, string? ffmpeg, bool dryRun)
    {
        if (!Directory.Exists(dir)) { Console.WriteLine($"[Podcast] folder not found: {dir} — skipping."); return; }

        var files = Directory.GetFiles(dir, "*.webm").OrderBy(NaturalKey).ToList();
        Console.WriteLine($"\n[Podcast] {files.Count} .webm files.");
        if (files.Count == 0) return;

        var showTitle = ShowTitleFromFile(Path.GetFileNameWithoutExtension(files[0])) ?? "Conan O'Brien Needs A Friend";

        var podcast = await db.Podcasts.Include(p => p.Episodes).FirstOrDefaultAsync(p => p.Title == showTitle);
        if (podcast is null)
        {
            podcast = new Podcast
            {
                Id = Guid.NewGuid(),
                Title = showTitle,
                Author = "Conan O'Brien",
                Category = "Comedy",
                Description = $"{showTitle} — full episodes.",
                ImageKey = await EnsurePodcastImageAsync(storage, ffmpeg, files[0], showTitle, "Conan O'Brien", dryRun),
                CreatedAt = DateTime.UtcNow,
            };
            Console.WriteLine($"[Podcast] show '{showTitle}' not found — creating {podcast.Id}.");
            if (!dryRun) { db.Podcasts.Add(podcast); await db.SaveChangesAsync(); }
        }
        else
        {
            Console.WriteLine($"[Podcast] using existing show '{showTitle}' ({podcast.Id}).");
        }

        foreach (var file in files)
        {
            var name = Path.GetFileNameWithoutExtension(file);
            var (epNum, epTitle) = EpisodeFromFile(name);

            if (podcast.Episodes.Any(e => e.EpisodeNumber == epNum))
            {
                Console.WriteLine($"[Podcast] SKIP (ep {epNum} exists): {epTitle}");
                continue;
            }

            var durationMs = ProbeDurationMs(ffprobe, file);
            var key = $"audio/{Guid.NewGuid():N}.webm";

            Console.WriteLine($"[Podcast] {(dryRun ? "would upload" : "uploading")} ep {epNum} '{epTitle}' "
                + $"-> {key} ({new FileInfo(file).Length:N0} bytes, {durationMs} ms)");

            if (!dryRun)
            {
                await using (var fs = File.OpenRead(file))
                    await storage.UploadAsync(key, fs, "video/webm");

                db.Episodes.Add(new Episode
                {
                    Id = Guid.NewGuid(),
                    PodcastId = podcast.Id,
                    Title = epTitle,
                    Description = "Full episode.",
                    AudioUrl = string.Empty,
                    AudioKey = key,
                    DurationMs = durationMs,
                    EpisodeNumber = epNum,
                    PublishedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                });
                await db.SaveChangesAsync();
            }
        }
    }

    // ---- Thumbnail backfill (for rows ingested before thumbnails existed) ----

    private static async Task BackfillThumbnailsAsync(
        AppDbContext db, IStorageService storage, string? ffmpeg, string videosDir, string podcastDir, bool dryRun)
    {
        Console.WriteLine("\n[Thumbs] backfilling missing thumbnails…");

        // Music videos: match each thumbless row to its source file by cleaned title.
        var fileByTitle = Directory.Exists(videosDir)
            ? Directory.GetFiles(videosDir, "*.mp4").ToDictionary(f => CleanVideoTitle(Path.GetFileNameWithoutExtension(f), "Nirvana"))
            : new Dictionary<string, string>();

        var artist = await db.Artists.FirstOrDefaultAsync(a => a.Name == "Nirvana");
        if (artist is not null)
        {
            var rows = await db.MusicVideos
                .Where(v => v.ArtistId == artist.Id && v.ThumbnailKey == null)
                .ToListAsync();
            foreach (var v in rows)
            {
                if (!fileByTitle.TryGetValue(v.Title, out var src))
                {
                    Console.WriteLine($"[Thumbs] no source file for '{v.Title}' — skipping.");
                    continue;
                }
                var key = await EnsureThumbAsync(storage, ffmpeg, src, 15, dryRun);
                Console.WriteLine($"[Thumbs] video '{v.Title}' -> {key ?? "(none)"}");
                if (!dryRun && key is not null) { v.ThumbnailKey = key; await db.SaveChangesAsync(); }
            }
        }

        // Podcast: one show image from the first episode file.
        if (Directory.Exists(podcastDir))
        {
            var firstWebm = Directory.GetFiles(podcastDir, "*.webm").OrderBy(NaturalKey).FirstOrDefault();
            if (firstWebm is not null)
            {
                var showTitle = ShowTitleFromFile(Path.GetFileNameWithoutExtension(firstWebm));
                var pod = await db.Podcasts.FirstOrDefaultAsync(p => p.Title == showTitle && p.ImageKey == null);
                if (pod is not null)
                {
                    var key = await EnsurePodcastImageAsync(storage, ffmpeg, firstWebm, pod.Title, pod.Author, dryRun);
                    Console.WriteLine($"[Thumbs] podcast '{pod.Title}' -> {key ?? "(none)"}");
                    if (!dryRun && key is not null) { pod.ImageKey = key; await db.SaveChangesAsync(); }
                }
            }
        }
    }

    /// <summary>Grab a single frame at <paramref name="atSeconds"/>, upload it to
    /// <c>covers/{guid}.jpg</c>, and return the key (null if ffmpeg is missing/fails).</summary>
    private static async Task<string?> EnsureThumbAsync(
        IStorageService storage, string? ffmpeg, string sourceFile, int atSeconds, bool dryRun)
    {
        if (ffmpeg is null) return null;
        var key = $"covers/{Guid.NewGuid():N}.jpg";
        if (dryRun) return key;

        var tmp = Path.Combine(Path.GetTempPath(), $"ns-thumb-{Guid.NewGuid():N}.jpg");
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = ffmpeg,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            foreach (var a in new[] { "-y", "-ss", atSeconds.ToString(), "-i", sourceFile,
                                      "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", tmp })
                psi.ArgumentList.Add(a);

            using (var p = Process.Start(psi)!)
            {
                p.StandardError.ReadToEnd();
                p.WaitForExit();
            }

            if (!File.Exists(tmp) || new FileInfo(tmp).Length == 0) return null;
            await using (var fs = File.OpenRead(tmp))
                await storage.UploadAsync(key, fs, "image/jpeg");
            return key;
        }
        catch { return null; }
        finally { try { if (File.Exists(tmp)) File.Delete(tmp); } catch { } }
    }

    /// <summary>Podcast cover: try a real video frame first; if the file is
    /// audio-only (no frame), generate a branded title card instead.</summary>
    private static async Task<string?> EnsurePodcastImageAsync(
        IStorageService storage, string? ffmpeg, string sourceFile, string title, string author, bool dryRun)
    {
        var frame = await EnsureThumbAsync(storage, ffmpeg, sourceFile, 120, dryRun);
        if (frame is not null) return frame;
        return await GenerateTitleCardAsync(storage, ffmpeg, title, author, dryRun);
    }

    /// <summary>Render a 640×640 title-card cover with ffmpeg (lavfi color + drawtext).</summary>
    private static async Task<string?> GenerateTitleCardAsync(
        IStorageService storage, string? ffmpeg, string title, string author, bool dryRun)
    {
        if (ffmpeg is null) return null;
        var key = $"covers/{Guid.NewGuid():N}.jpg";
        if (dryRun) return key;

        var fontBold = FindFont("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf");
        var fontReg = FindFont("segoeui.ttf", "arial.ttf");
        if (fontBold is null || fontReg is null) return null;

        var titleFile = Path.Combine(Path.GetTempPath(), $"ns-title-{Guid.NewGuid():N}.txt");
        var authorFile = Path.Combine(Path.GetTempPath(), $"ns-auth-{Guid.NewGuid():N}.txt");
        var outFile = Path.Combine(Path.GetTempPath(), $"ns-card-{Guid.NewGuid():N}.jpg");
        await File.WriteAllTextAsync(titleFile, Wrap(title, 16), new System.Text.UTF8Encoding(false));
        await File.WriteAllTextAsync(authorFile, author.ToUpperInvariant(), new System.Text.UTF8Encoding(false));

        try
        {
            var vf =
                $"drawtext=fontfile='{Esc(fontBold)}':textfile='{Esc(titleFile)}':fontcolor=white:" +
                "fontsize=52:line_spacing=12:x=(w-text_w)/2:y=(h-text_h)/2-20," +
                $"drawtext=fontfile='{Esc(fontReg)}':textfile='{Esc(authorFile)}':fontcolor=0x1DB954:" +
                "fontsize=26:x=(w-text_w)/2:y=h-110";

            var psi = new ProcessStartInfo
            {
                FileName = ffmpeg,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            foreach (var a in new[] { "-y", "-f", "lavfi", "-i", "color=c=0x191427:s=640x640",
                                      "-vf", vf, "-frames:v", "1", "-q:v", "3", outFile })
                psi.ArgumentList.Add(a);

            using (var p = Process.Start(psi)!)
            {
                var err = p.StandardError.ReadToEnd();
                p.WaitForExit();
                if (p.ExitCode != 0) { Console.WriteLine($"[Thumbs] title-card ffmpeg failed: {err.Split('\n').LastOrDefault(l => l.Trim().Length > 0)}"); return null; }
            }

            if (!File.Exists(outFile) || new FileInfo(outFile).Length == 0) return null;
            await using (var fs = File.OpenRead(outFile))
                await storage.UploadAsync(key, fs, "image/jpeg");
            return key;
        }
        catch (Exception ex) { Console.WriteLine($"[Thumbs] title-card error: {ex.Message}"); return null; }
        finally
        {
            foreach (var f in new[] { titleFile, authorFile, outFile })
                try { if (File.Exists(f)) File.Delete(f); } catch { }
        }
    }

    // Greedy word-wrap to keep drawtext lines within ~maxChars.
    private static string Wrap(string text, int maxChars)
    {
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var lines = new List<string>();
        var cur = "";
        foreach (var w in words)
        {
            if (cur.Length == 0) cur = w;
            else if ((cur.Length + 1 + w.Length) <= maxChars) cur += " " + w;
            else { lines.Add(cur); cur = w; }
        }
        if (cur.Length > 0) lines.Add(cur);
        return string.Join("\n", lines);
    }

    private static string Esc(string path) => path.Replace('\\', '/').Replace(":", "\\:");

    private static string? FindFont(params string[] names)
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Fonts");
        foreach (var n in names)
        {
            var p = Path.Combine(dir, n);
            if (File.Exists(p)) return p;
        }
        return null;
    }

    // ---- Filename / title parsing ------------------------------------------

    // Strip trailing " [youtubeId]", normalise the fullwidth slash, collapse spaces.
    private static string CleanVideoTitle(string name, string artist)
    {
        var t = Regex.Replace(name, @"\s*\[[A-Za-z0-9_\-]{6,}\]\s*$", "");
        t = t.Replace('⧸', '/').Replace('／', '/');
        t = Regex.Replace(t, @"\s+", " ").Trim();
        if (!t.StartsWith(artist + " ", StringComparison.OrdinalIgnoreCase))
            t = $"{artist} - {t}";
        return t;
    }

    // "Nirvana - Come As You Are (Live On MTV ...)" -> "Come As You Are"
    private static string CoreTitle(string title, string artist)
    {
        var t = title;
        if (t.StartsWith(artist + " - ", StringComparison.OrdinalIgnoreCase))
            t = t[(artist.Length + 3)..];
        t = Regex.Replace(t, @"\s*\(.*?\)\s*$", "");
        return t.Trim();
    }

    // "Conan O'Brien Needs A Friend" comes after the fullwidth "｜" separator.
    private static string? ShowTitleFromFile(string name)
    {
        var parts = name.Split('｜', '|');
        return parts.Length > 1 ? parts[^1].Trim() : null;
    }

    // "1 - Josh Groban (Full Episode) ｜ Conan ..." -> (1, "Josh Groban")
    private static (int num, string title) EpisodeFromFile(string name)
    {
        var left = name.Split('｜', '|')[0].Trim();
        var m = Regex.Match(left, @"^\s*(\d+)\s*-\s*(.+)$");
        var num = m.Success ? int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) : 0;
        var title = m.Success ? m.Groups[2].Value : left;
        title = Regex.Replace(title, @"\s*\(Full Episode\)\s*$", "", RegexOptions.IgnoreCase).Trim();
        return (num, title);
    }

    private static string NaturalKey(string path)
    {
        var name = Path.GetFileName(path);
        var m = Regex.Match(name, @"^\s*(\d+)");
        return m.Success ? m.Groups[1].Value.PadLeft(6, '0') : name;
    }

    // ---- ffprobe / ffmpeg ---------------------------------------------------

    private static long ProbeDurationMs(string? ffprobe, string file)
    {
        if (ffprobe is null) return 0;
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = ffprobe,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            foreach (var a in new[] { "-v", "error", "-show_entries", "format=duration",
                                      "-of", "default=noprint_wrappers=1:nokey=1", file })
                psi.ArgumentList.Add(a);

            using var p = Process.Start(psi)!;
            var outp = p.StandardOutput.ReadToEnd();
            p.WaitForExit();
            return double.TryParse(outp.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var secs)
                ? (long)(secs * 1000) : 0;
        }
        catch { return 0; }
    }

    private static string? ResolveTool(string name)
    {
        var candidates = new List<string> { name, name + ".exe" };
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (!string.IsNullOrEmpty(local))
            candidates.Add(Path.Combine(local, "Microsoft", "WinGet", "Links", name + ".exe"));

        foreach (var c in candidates)
        {
            try
            {
                if (Path.IsPathRooted(c) && !File.Exists(c)) continue;
                using var p = Process.Start(new ProcessStartInfo
                {
                    FileName = c, Arguments = "-version",
                    RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false,
                })!;
                p.WaitForExit();
                if (p.ExitCode == 0) return c;
            }
            catch { /* try next */ }
        }
        return null;
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, ".git")) ||
                Directory.Exists(Path.Combine(dir.FullName, "Music Videos")) ||
                Directory.Exists(Path.Combine(dir.FullName, "Podcast")))
                return dir.FullName;
            dir = dir.Parent;
        }
        return Directory.GetCurrentDirectory();
    }
}
