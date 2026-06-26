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
///   dotnet run -- ingest-media               # upload + insert (idempotent)
///   dotnet run -- ingest-media --dry-run     # preview, writes nothing
/// </code>
/// Durations are read with <c>ffprobe</c> (resolved on PATH or the WinGet Links
/// folder). Idempotent: a video with the same title, or an episode with the same
/// show + number, is skipped on re-run.
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

        var ffprobe = ResolveFfprobe();
        Console.WriteLine($"[Ingest] repo root: {repoRoot}");
        Console.WriteLine($"[Ingest] ffprobe:   {ffprobe ?? "NOT FOUND (durations will be 0)"}");
        Console.WriteLine($"[Ingest] bucket:    {sec["BucketName"]}{(dryRun ? "   (DRY RUN)" : "")}");
        Console.WriteLine();

        await IngestMusicVideosAsync(db, storage, videosDir, ffprobe, dryRun);
        await IngestPodcastAsync(db, storage, podcastDir, ffprobe, dryRun);

        Console.WriteLine("\n[Ingest] Done.");
    }

    // ---- Music videos -------------------------------------------------------

    private static async Task IngestMusicVideosAsync(
        AppDbContext db, IStorageService storage, string dir, string? ffprobe, bool dryRun)
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

            // Best-effort: link to the catalogue track this video accompanies.
            var core = CoreTitle(title, artistName);
            var track = await db.Tracks.FirstOrDefaultAsync(
                t => t.ArtistId == artist.Id && t.Title.ToLower() == core.ToLower());

            Console.WriteLine($"[Videos] {(dryRun ? "would upload" : "uploading")} {Path.GetFileName(file)} -> {key} "
                + $"({new FileInfo(file).Length:N0} bytes, {durationMs} ms)"
                + (track is not null ? $"  [linked track {track.Id}]" : ""));

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
                    DurationMs = durationMs,
                    CreatedAt = DateTime.UtcNow,
                });
                await db.SaveChangesAsync();
            }
        }
    }

    // ---- Podcast ------------------------------------------------------------

    private static async Task IngestPodcastAsync(
        AppDbContext db, IStorageService storage, string dir, string? ffprobe, bool dryRun)
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

    // ---- ffprobe ------------------------------------------------------------

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

    private static string? ResolveFfprobe()
    {
        var candidates = new List<string> { "ffprobe", "ffprobe.exe" };
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (!string.IsNullOrEmpty(local))
            candidates.Add(Path.Combine(local, "Microsoft", "WinGet", "Links", "ffprobe.exe"));

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
