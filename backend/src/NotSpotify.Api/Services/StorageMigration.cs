using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;

namespace NotSpotify.Api.Services;

/// <summary>
/// One-time storage migration CLI. Copies every storage object referenced by the
/// database from the current Supabase bucket to the configured S3 bucket, under
/// the <b>same keys</b> (so the stored <c>*Key</c> columns keep resolving after the
/// provider flips to S3).
///
/// Run from <c>backend/src/NotSpotify.Api</c>:
/// <code>
///   dotnet run -- migrate-storage            # copy
///   dotnet run -- migrate-storage --dry-run  # list what would copy, write nothing
/// </code>
/// Both <c>SupabaseStorage:*</c> (source) and <c>S3Storage:*</c> (destination) must
/// be set in user-secrets at the same time. Idempotent — re-runs just upsert.
/// </summary>
public static class StorageMigration
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    public static async Task RunAsync(IConfiguration config, string[] args)
    {
        var dryRun = args.Contains("--dry-run");

        var supaUrl = config["SupabaseStorage:Url"];
        var s3Bucket = config["S3Storage:BucketName"];
        if (string.IsNullOrWhiteSpace(supaUrl))
        {
            Console.WriteLine("[Migrate] SupabaseStorage:Url is not set — nothing to copy FROM. Aborting.");
            return;
        }
        if (string.IsNullOrWhiteSpace(s3Bucket))
        {
            Console.WriteLine("[Migrate] S3Storage:BucketName is not set — nothing to copy TO. Aborting.");
            return;
        }

        var services = new ServiceCollection();
        services.AddHttpClient();
        services.Configure<SupabaseStorageOptions>(config.GetSection("SupabaseStorage"));
        services.Configure<S3StorageOptions>(config.GetSection("S3Storage"));
        services.AddSingleton<SupabaseStorageService>();
        services.AddSingleton<S3StorageService>();
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(config.GetConnectionString("Postgres")));

        await using var sp = services.BuildServiceProvider();
        using var scope = sp.CreateScope();
        var source = scope.ServiceProvider.GetRequiredService<SupabaseStorageService>();
        var dest = scope.ServiceProvider.GetRequiredService<S3StorageService>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Console.WriteLine($"[Migrate] Supabase '{supaUrl}' -> S3 bucket '{s3Bucket}'{(dryRun ? "  (DRY RUN)" : "")}");

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

    private static string ContentTypeFor(string key)
        => ContentTypes.TryGetContentType(key, out var ct) ? ct : "application/octet-stream";
}
