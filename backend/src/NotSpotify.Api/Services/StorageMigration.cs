using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NotSpotify.Api.Data;

namespace NotSpotify.Api.Services;

/// <summary>
/// One-time storage migration CLI. Copies every storage object referenced by the
/// database from one provider/bucket to another, under the <b>same keys</b> (so the
/// stored <c>*Key</c> columns keep resolving).
///
/// Run from <c>backend/src/NotSpotify.Api</c>:
/// <code>
///   dotnet run -- migrate-storage --source S3Storage --dest S3StorageDest     # S3 -> S3 (e.g. moving to a new account)
///   dotnet run -- migrate-storage --dry-run                                   # preview, writes nothing
/// </code>
/// <para>
/// <c>--source</c>/<c>--dest</c> name config sections (default <c>S3Storage</c> →
/// <c>S3StorageDest</c>). Both must be S3-compatible config sections with a
/// <c>BucketName</c>. Idempotent — re-runs just upsert.
/// </para>
/// </summary>
public static class StorageMigration
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    public static async Task RunAsync(IConfiguration config, string[] args)
    {
        var dryRun = args.Contains("--dry-run");
        var sourceSection = ArgValue(args, "--source") ?? "S3Storage";
        var destSection = ArgValue(args, "--dest") ?? "S3StorageDest";

        if (string.Equals(sourceSection, destSection, StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine($"[Migrate] --source and --dest are both '{sourceSection}' — they must differ. Aborting.");
            return;
        }

        var services = new ServiceCollection();
        services.AddHttpClient();
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(config.GetConnectionString("Postgres")));

        await using var sp = services.BuildServiceProvider();
        using var scope = sp.CreateScope();

        IStorageService source, dest;
        try
        {
            source = BuildStorage(config, sourceSection, scope.ServiceProvider);
            dest = BuildStorage(config, destSection, scope.ServiceProvider);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Migrate] {ex.Message}");
            return;
        }

        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Console.WriteLine($"[Migrate] {sourceSection} -> {destSection}{(dryRun ? "  (DRY RUN)" : "")}");

        var keys = await CollectKeysAsync(db);
        Console.WriteLine($"[Migrate] {keys.Count} distinct storage keys referenced by the DB.");

        int copied = 0, missing = 0, failed = 0, i = 0;
        long bytesTotal = 0;
        foreach (var key in keys)
        {
            i++;
            try
            {
                var bytes = await source.ReadAsync(key);
                if (bytes is null)
                {
                    missing++;
                    Console.WriteLine($"[Migrate] ({i}/{keys.Count}) MISSING in source: {key}");
                    continue;
                }

                if (!dryRun)
                {
                    using var ms = new MemoryStream(bytes);
                    await dest.UploadAsync(key, ms, ContentTypeFor(key));
                }

                copied++;
                bytesTotal += bytes.Length;
                Console.WriteLine($"[Migrate] ({i}/{keys.Count}) {(dryRun ? "would copy" : "copied")} {key} ({bytes.Length:N0} bytes)");
            }
            catch (Exception ex)
            {
                failed++;
                Console.WriteLine($"[Migrate] ({i}/{keys.Count}) FAILED {key}: {ex.Message}");
            }
        }

        Console.WriteLine($"[Migrate] Done. {copied} {(dryRun ? "to copy" : "copied")} ({bytesTotal:N0} bytes), {missing} missing in source, {failed} failed.");
        if (failed > 0) Console.WriteLine("[Migrate] Some objects failed — re-run is safe (upsert). Check the keys above.");
    }

    /// <summary>Build the right <see cref="IStorageService"/> from a named config section.</summary>
    private static IStorageService BuildStorage(IConfiguration config, string section, IServiceProvider sp)
    {
        var sec = config.GetSection(section);

        if (!string.IsNullOrWhiteSpace(sec["BucketName"]))
        {
            var opt = sec.Get<S3StorageOptions>() ?? new S3StorageOptions();
            return new S3StorageService(Options.Create(opt));
        }

        throw new InvalidOperationException(
            $"Config section '{section}' isn't a usable S3 storage config — it needs a 'BucketName'. Set it in user-secrets.");
    }

    /// <summary>Every distinct non-empty storage key the DB references, normalised (no leading slash).</summary>
    private static async Task<List<string>> CollectKeysAsync(AppDbContext db)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal);
        void Add(IEnumerable<string?> ks)
        {
            foreach (var k in ks)
                if (!string.IsNullOrWhiteSpace(k)) keys.Add(k!.Replace('\\', '/').TrimStart('/'));
        }

        Add(await db.Tracks.Select(t => t.AudioKey).ToListAsync());
        Add(await db.Albums.Select(a => a.CoverKey).ToListAsync());
        Add(await db.Artists.Select(a => a.ImageKey).ToListAsync());
        Add(await db.Artists.Select(a => a.HeaderImageKey).ToListAsync());
        Add(await db.Playlists.Select(p => p.CoverKey).ToListAsync());
        Add(await db.Users.Select(u => u.AvatarKey).ToListAsync());
        Add(await db.UserUploads.Select(u => u.AudioKey).ToListAsync());
        Add(await db.Episodes.Select(e => e.AudioKey).ToListAsync());
        Add(await db.Podcasts.Select(p => p.ImageKey).ToListAsync());
        Add(await db.MusicVideos.Select(v => v.VideoKey).ToListAsync());
        Add(await db.MusicVideos.Select(v => v.ThumbnailKey).ToListAsync());
        Add(await db.Advertisements.Select(a => a.AudioKey).ToListAsync());
        Add(await db.Advertisements.Select(a => a.ImageKey).ToListAsync());

        return keys.OrderBy(k => k, StringComparer.Ordinal).ToList();
    }

    private static string? ArgValue(string[] args, string name)
    {
        var i = Array.IndexOf(args, name);
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    private static string ContentTypeFor(string key)
        => ContentTypes.TryGetContentType(key, out var ct) ? ct : "application/octet-stream";
}
