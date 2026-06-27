using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Npgsql;
using NotSpotify.Api.Data;
using NotSpotify.Api.Hubs;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Load user-secrets explicitly so credentials work regardless of ASPNETCORE_ENVIRONMENT.
// By default user-secrets only load in Development; this makes them load always.
builder.Configuration.AddUserSecrets<Program>(optional: true);

// Re-add environment variables AFTER user-secrets to restore the standard .NET
// precedence (env vars > user-secrets). Appending user-secrets above had silently
// inverted it, so e.g. ConnectionStrings__Postgres could not be overridden per-run.
builder.Configuration.AddEnvironmentVariables();

Console.WriteLine($"[Env] ASPNETCORE_ENVIRONMENT = {builder.Environment.EnvironmentName}");

// One-time storage migration CLI (`dotnet run -- migrate-storage [--dry-run]`):
// copies every DB-referenced object from Supabase to S3 under the same keys.
// Short-circuits before the web host so it needs no JWT/Stripe/etc. config.
if (args.Contains("migrate-storage"))
{
    await StorageMigration.RunAsync(builder.Configuration, args);
    return;
}

// One-off bulk ingest (`dotnet run -- ingest-media [--dry-run]`): uploads the
// repo-root "Music Videos/" and "Podcast/" folders to S3 and inserts the matching
// MusicVideo / Podcast + Episode rows. Short-circuits before the web host.
if (args.Contains("ingest-media"))
{
    await MediaIngest.RunAsync(builder.Configuration, args);
    return;
}

// One-time S3 CORS setup (`dotnet run -- ensure-s3-cors`): lets the browser read
// bucket objects cross-origin so client-side dominant-colour extraction (the page
// gradient hues) works. Needs s3:PutBucketCors on the bucket. Idempotent.
if (args.Contains("ensure-s3-cors"))
{
    var s3Opt = builder.Configuration.GetSection("S3Storage").Get<S3StorageOptions>();
    if (s3Opt is null || string.IsNullOrWhiteSpace(s3Opt.BucketName))
    {
        Console.WriteLine("[S3 CORS] No 'S3Storage:BucketName' configured — set it in user-secrets/appsettings. Aborting.");
        return;
    }

    try
    {
        await new S3StorageService(Microsoft.Extensions.Options.Options.Create(s3Opt)).EnsureBrowserCorsAsync();
        Console.WriteLine($"[S3 CORS] Applied GET/HEAD CORS (AllowedOrigins=*) to bucket '{s3Opt.BucketName}'. Gradients will work once URLs refresh.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[S3 CORS] FAILED: {ex.Message}");
        Console.WriteLine("[S3 CORS] If this is a permissions error, apply the CORS rule from the AWS console instead (S3 → bucket → Permissions → CORS).");
    }
    return;
}

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()
    ?? throw new InvalidOperationException("Missing Jwt configuration section.");
builder.Services.AddSingleton(jwt);

builder.Services.AddDbContext<AppDbContext>(opt =>
{
    // Supabase session-mode pooler is capped at 15 connections shared across all team members.
    // Limiting the app-side pool prevents one running instance from consuming all slots.
    var cs = builder.Configuration.GetConnectionString("Postgres") ?? string.Empty;
    if (!cs.Contains("Maximum Pool Size", StringComparison.OrdinalIgnoreCase))
        cs += ";Maximum Pool Size=5";
    opt.UseNpgsql(cs);
});

builder.Services
    .AddIdentityCore<ApplicationUser>(opt =>
    {
        opt.Password.RequiredLength = 8;
        opt.Password.RequireNonAlphanumeric = false;
        opt.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };

        // SignalR WebSocket connections cannot send custom headers in browsers,
        // so the JWT arrives as ?access_token= on /hubs/* routes instead.
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"].ToString();
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    ctx.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<TokenService>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        var retryAfterSeconds = context.Lease.TryGetMetadata(
            MetadataName.RetryAfter,
            out var retryAfter)
            ? Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds))
            : 60;

        context.HttpContext.Response.Headers.RetryAfter = retryAfterSeconds.ToString();
        await context.HttpContext.Response.WriteAsJsonAsync(
            new
            {
                message = "Too many requests. Please try again shortly.",
                retryAfterSeconds,
            },
            cancellationToken);
    };

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));

    options.AddPolicy("chat-send", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? httpContext.User.FindFirstValue("sub")
                ?? httpContext.Connection.RemoteIpAddress?.ToString()
                ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromSeconds(10),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));
});

// Storage provider selection (priority: S3 → Supabase → Local). Each keys off its
// own config being present, so swapping is a user-secrets change, not a code change.
builder.Services.AddHttpClient();
var s3Section = builder.Configuration.GetSection("S3Storage");
var s3Bucket = s3Section["BucketName"];
var supabaseStorageSection = builder.Configuration.GetSection("SupabaseStorage");
var supabaseUrl = supabaseStorageSection["Url"];
if (!string.IsNullOrWhiteSpace(s3Bucket))
{
    builder.Services.Configure<S3StorageOptions>(s3Section);
    builder.Services.AddSingleton<IStorageService, S3StorageService>();
    var endpoint = string.IsNullOrWhiteSpace(s3Section["ServiceUrl"])
        ? $"AWS {s3Section["Region"] ?? "us-east-1"}"
        : s3Section["ServiceUrl"];
    Console.WriteLine($"[Storage] Using S3: bucket {s3Bucket} (endpoint: {endpoint})");
}
else if (!string.IsNullOrWhiteSpace(supabaseUrl))
{
    builder.Services.Configure<SupabaseStorageOptions>(supabaseStorageSection);
    builder.Services.AddSingleton<IStorageService, SupabaseStorageService>();
    Console.WriteLine($"[Storage] Using Supabase: {supabaseUrl} (bucket: {supabaseStorageSection["Bucket"]})");
}
else
{
    builder.Services.Configure<LocalStorageOptions>(builder.Configuration.GetSection("LocalStorage"));
    builder.Services.AddSingleton<IStorageService, LocalStorageService>();
    Console.WriteLine("[Storage] Using LocalStorage (no S3/Supabase config — user-secrets not loaded?)");
}
builder.Services.AddScoped<MediaMapper>();
builder.Services.AddScoped<AudioDownloadService>();
builder.Services.AddScoped<LyricsService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.Configure<NotSpotify.Api.Services.WebPushOptions>(builder.Configuration.GetSection("Push"));
builder.Services.AddScoped<NotSpotify.Api.Services.WebPushService>();
builder.Services.AddScoped<SmartPlaylistService>();
builder.Services.AddScoped<AudioWaveformService>();
builder.Services.AddHttpClient(); // IHttpClientFactory for AuthController's Google OAuth code flow
builder.Services.Configure<StripeBillingOptions>(builder.Configuration.GetSection("Stripe"));
builder.Services.AddHttpClient<StripeBillingService>();
builder.Services.Configure<TicketmasterOptions>(builder.Configuration.GetSection("Ticketmaster"));
builder.Services.AddHttpClient<TicketmasterService>();
builder.Services.AddScoped<TourSyncService>();
builder.Services.AddHostedService<TourSyncBackgroundService>();

var corsOrigins = (builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? new[] { "http://localhost:5173" })
    // The packaged Tauri desktop app serves from a custom origin (not localhost:5173),
    // so it must be allowed explicitly or its API + SignalR calls are CORS-blocked.
    // Windows uses http(s)://tauri.localhost; macOS/Linux use tauri://localhost.
    .Concat(new[] { "http://tauri.localhost", "https://tauri.localhost", "tauri://localhost" })
    .Distinct()
    .ToArray();

builder.Services.AddCors(opt =>
{
    opt.AddDefaultPolicy(p => p
        .WithOrigins(corsOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .WithExposedHeaders("Content-Disposition")
        .AllowCredentials());
});

builder.Services.AddSignalR();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "NotSpotify API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste JWT access token (no 'Bearer ' prefix)."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.MapHub<PresenceHub>("/hubs/presence");
app.MapHub<NotSpotify.Api.Hubs.SessionHub>("/hubs/session");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await db.Database.MigrateAsync();
    }
    catch (Npgsql.PostgresException ex) when (ex.SqlState == "42P07" || ex.SqlState == "42701")
    {
        // Shared Supabase DB: a previous run's raw-SQL guard already created the
        // table/column. The migration is a no-op — log and continue so later
        // migrations (which may add columns/ indexes) still apply.
        Console.WriteLine($"[Migration] Skipped (already exists): {ex.MessageText}");
    }

    // Ensure UserSavedAlbums table exists — the EF migration for this was stamped
    // as applied while empty (stale binary), so we guarantee the schema here.
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""UserSavedAlbums"" (
            ""UserId""  uuid NOT NULL,
            ""AlbumId"" uuid NOT NULL,
            ""SavedAt"" timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_UserSavedAlbums""
                PRIMARY KEY (""UserId"", ""AlbumId""),
            CONSTRAINT ""FK_UserSavedAlbums_Albums_AlbumId""
                FOREIGN KEY (""AlbumId"") REFERENCES ""Albums""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_UserSavedAlbums_AspNetUsers_UserId""
                FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ""IX_UserSavedAlbums_AlbumId""
            ON ""UserSavedAlbums""(""AlbumId"");
        CREATE INDEX IF NOT EXISTS ""IX_UserSavedAlbums_UserId_SavedAt""
            ON ""UserSavedAlbums""(""UserId"", ""SavedAt"");
    ");

    // Same guard for the asymmetric-follow graph: ensure the table exists even if the
    // EF migration gets stamped-without-running on the shared Supabase DB (a documented
    // hazard with multiple team members applying migrations).
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""UserFollows"" (
            ""Id""         uuid NOT NULL,
            ""FollowerId"" uuid NOT NULL,
            ""FolloweeId"" uuid NOT NULL,
            ""CreatedAt""  timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_UserFollows"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_UserFollows_AspNetUsers_FollowerId""
                FOREIGN KEY (""FollowerId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_UserFollows_AspNetUsers_FolloweeId""
                FOREIGN KEY (""FolloweeId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserFollows_FollowerId_FolloweeId""
            ON ""UserFollows""(""FollowerId"", ""FolloweeId"");
        CREATE INDEX IF NOT EXISTS ""IX_UserFollows_FolloweeId""
            ON ""UserFollows""(""FolloweeId"");
        CREATE INDEX IF NOT EXISTS ""IX_UserFollows_FollowerId""
            ON ""UserFollows""(""FollowerId"");
    ");

    // Ensure TrackComments table exists (same guard pattern — shared Supabase DB
    // sometimes stamps EF migrations without applying the DDL).
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""TrackComments"" (
            ""Id""          uuid NOT NULL,
            ""TrackId""     uuid NOT NULL,
            ""UserId""      uuid NOT NULL,
            ""Body""        character varying(1000) NOT NULL,
            ""ParentId""    uuid NULL,
            ""TimestampMs"" bigint NULL,
            ""CreatedAt""   timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_TrackComments"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_TrackComments_AspNetUsers_UserId""
                FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_TrackComments_Tracks_TrackId""
                FOREIGN KEY (""TrackId"") REFERENCES ""Tracks""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_TrackComments_TrackComments_ParentId""
                FOREIGN KEY (""ParentId"") REFERENCES ""TrackComments""(""Id"") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS ""IX_TrackComments_TrackId_CreatedAt""
            ON ""TrackComments""(""TrackId"", ""CreatedAt"");
        CREATE INDEX IF NOT EXISTS ""IX_TrackComments_ParentId""
            ON ""TrackComments""(""ParentId"");
        CREATE INDEX IF NOT EXISTS ""IX_TrackComments_UserId""
            ON ""TrackComments""(""UserId"");
    ");

    // Ensure Reposts table exists (same guard pattern).
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""Reposts"" (
            ""Id""         uuid NOT NULL,
            ""UserId""     uuid NOT NULL,
            ""TrackId""    uuid NULL,
            ""AlbumId""    uuid NULL,
            ""PlaylistId"" uuid NULL,
            ""CreatedAt""  timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_Reposts"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_Reposts_AspNetUsers_UserId""
                FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_Reposts_Tracks_TrackId""
                FOREIGN KEY (""TrackId"") REFERENCES ""Tracks""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_Reposts_Albums_AlbumId""
                FOREIGN KEY (""AlbumId"") REFERENCES ""Albums""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_Reposts_Playlists_PlaylistId""
                FOREIGN KEY (""PlaylistId"") REFERENCES ""Playlists""(""Id"") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Reposts_UserId_TrackId""
            ON ""Reposts""(""UserId"", ""TrackId"") WHERE ""TrackId"" IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Reposts_UserId_AlbumId""
            ON ""Reposts""(""UserId"", ""AlbumId"") WHERE ""AlbumId"" IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Reposts_UserId_PlaylistId""
            ON ""Reposts""(""UserId"", ""PlaylistId"") WHERE ""PlaylistId"" IS NOT NULL;
        CREATE INDEX IF NOT EXISTS ""IX_Reposts_UserId_CreatedAt""
            ON ""Reposts""(""UserId"", ""CreatedAt"");
        CREATE INDEX IF NOT EXISTS ""IX_Reposts_AlbumId""
            ON ""Reposts""(""AlbumId"");
        CREATE INDEX IF NOT EXISTS ""IX_Reposts_PlaylistId""
            ON ""Reposts""(""PlaylistId"");
    ");

    // Ensure Playlist featured/sort columns exist (same guard pattern —
    // shared Supabase DB sometimes stamps EF migrations without applying DDL).
    await db.Database.ExecuteSqlRawAsync(@"
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Playlists' AND column_name = 'IsFeatured') THEN
                ALTER TABLE ""Playlists"" ADD COLUMN ""IsFeatured"" boolean NOT NULL DEFAULT false;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Playlists' AND column_name = 'SortOrder') THEN
                ALTER TABLE ""Playlists"" ADD COLUMN ""SortOrder"" integer NOT NULL DEFAULT 0;
            END IF;
        END $$;
        CREATE INDEX IF NOT EXISTS ""IX_Playlists_IsFeatured_SortOrder""
            ON ""Playlists""(""IsFeatured"", ""SortOrder"");
    ");

    // Smart playlists store their rule set as JSONB. Keep the guard idempotent
    // because the shared database can have migration-history/schema drift.
    await db.Database.ExecuteSqlRawAsync(@"
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Playlists' AND column_name = 'Rules') THEN
                ALTER TABLE ""Playlists"" ADD COLUMN ""Rules"" jsonb NULL;
            END IF;
        END $$;
    ");

    // Web Push subscriptions (one row per browser/device per user).
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""PushSubscriptions"" (
            ""Id"" uuid NOT NULL PRIMARY KEY,
            ""UserId"" uuid NOT NULL,
            ""Endpoint"" text NOT NULL,
            ""P256dh"" text NOT NULL,
            ""AuthSecret"" text NOT NULL,
            ""CreatedAt"" timestamptz NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_PushSubscriptions_Endpoint""
            ON ""PushSubscriptions""(""Endpoint"");
        CREATE INDEX IF NOT EXISTS ""IX_PushSubscriptions_UserId""
            ON ""PushSubscriptions""(""UserId"");
    ");

    // Persisted waveform peaks generated by ffmpeg during audio upload.
    await db.Database.ExecuteSqlRawAsync(@"
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Tracks' AND column_name = 'Waveform') THEN
                ALTER TABLE ""Tracks"" ADD COLUMN ""Waveform"" jsonb NULL;
            END IF;
        END $$;
    ");

    // Podcasts subsystem (same guard pattern — shared Supabase DB may already
    // have these tables; create them idempotently regardless of EF history).
    // The one-time seed draws episode audio straight from the existing approved
    // catalogue so episodes actually play through the unchanged audio engine.
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""Podcasts"" (
            ""Id""          uuid NOT NULL,
            ""Title""       text NOT NULL,
            ""Author""      text NOT NULL DEFAULT '',
            ""Description"" text NULL,
            ""Category""    text NULL,
            ""ImageUrl""    text NULL,
            ""ImageKey""    text NULL,
            ""ArtistId""    uuid NULL,
            ""CreatedAt""   timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_Podcasts"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_Podcasts_Artists_ArtistId""
                FOREIGN KEY (""ArtistId"") REFERENCES ""Artists""(""Id"") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS ""IX_Podcasts_Title"" ON ""Podcasts""(""Title"");
        CREATE INDEX IF NOT EXISTS ""IX_Podcasts_CreatedAt"" ON ""Podcasts""(""CreatedAt"");
        CREATE INDEX IF NOT EXISTS ""IX_Podcasts_ArtistId"" ON ""Podcasts""(""ArtistId"");

        CREATE TABLE IF NOT EXISTS ""Episodes"" (
            ""Id""            uuid NOT NULL,
            ""PodcastId""     uuid NOT NULL,
            ""Title""         text NOT NULL,
            ""Description""   text NULL,
            ""AudioUrl""      text NOT NULL DEFAULT '',
            ""AudioKey""      text NULL,
            ""ImageUrl""      text NULL,
            ""ImageKey""      text NULL,
            ""Explicit""      boolean NOT NULL DEFAULT false,
            ""DurationMs""    bigint NOT NULL DEFAULT 0,
            ""EpisodeNumber"" integer NOT NULL DEFAULT 0,
            ""PublishedAt""   timestamp with time zone NOT NULL DEFAULT now(),
            ""CreatedAt""     timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_Episodes"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_Episodes_Podcasts_PodcastId""
                FOREIGN KEY (""PodcastId"") REFERENCES ""Podcasts""(""Id"") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ""IX_Episodes_PodcastId_PublishedAt""
            ON ""Episodes""(""PodcastId"", ""PublishedAt"");

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Podcasts' AND column_name = 'ArtistId') THEN
                ALTER TABLE ""Podcasts"" ADD COLUMN ""ArtistId"" uuid NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Podcasts_Artists_ArtistId') THEN
                ALTER TABLE ""Podcasts"" ADD CONSTRAINT ""FK_Podcasts_Artists_ArtistId""
                    FOREIGN KEY (""ArtistId"") REFERENCES ""Artists""(""Id"") ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Episodes' AND column_name = 'ImageUrl') THEN
                ALTER TABLE ""Episodes"" ADD COLUMN ""ImageUrl"" text NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Episodes' AND column_name = 'ImageKey') THEN
                ALTER TABLE ""Episodes"" ADD COLUMN ""ImageKey"" text NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Episodes' AND column_name = 'Explicit') THEN
                ALTER TABLE ""Episodes"" ADD COLUMN ""Explicit"" boolean NOT NULL DEFAULT false;
            END IF;
        END $$;

        DO $$
        DECLARE p1 uuid; p2 uuid;
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM ""Podcasts"") THEN
                p1 := gen_random_uuid();
                p2 := gen_random_uuid();
                INSERT INTO ""Podcasts"" (""Id"",""Title"",""Author"",""Description"",""Category"",""CreatedAt"") VALUES
                    (p1, 'The Not Spotify Show', 'NS Studios',
                     'Weekly conversations about the songs, artists and stories shaping the catalogue.',
                     'Music', now()),
                    (p2, 'Indie Spotlight', 'NS Studios',
                     'Deep dives and long-form chats with the rising independent artists on the platform.',
                     'Music', now());

                INSERT INTO ""Episodes""
                    (""Id"",""PodcastId"",""Title"",""Description"",""AudioUrl"",""AudioKey"",""DurationMs"",""EpisodeNumber"",""PublishedAt"",""CreatedAt"")
                SELECT gen_random_uuid(),
                       CASE WHEN t.rn <= 3 THEN p1 ELSE p2 END,
                       'Episode ' || (((t.rn - 1) % 3) + 1) || ': ' || t.""Title"",
                       'On this episode we dig into “' || t.""Title"" || '” and the sounds around it.',
                       t.""AudioUrl"", t.""AudioKey"",
                       GREATEST(t.""DurationMs"", 60000),
                       ((t.rn - 1) % 3) + 1,
                       now() - ((t.rn || ' days')::interval),
                       now()
                FROM (
                    SELECT ""Title"", ""AudioUrl"", ""AudioKey"", ""DurationMs"",
                           ROW_NUMBER() OVER (ORDER BY ""PlayCount"" DESC, ""CreatedAt"" DESC) AS rn
                    FROM ""Tracks"" WHERE ""Status"" = 'approved'
                ) t
                WHERE t.rn <= 6;
            END IF;
        END $$;
    ");

    // Ads engine (same idempotent guard pattern). One-time seeds the singleton
    // settings row + two house ads whose audio is borrowed from the existing
    // catalogue so they actually play through the dedicated client ad element.
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""Advertisements"" (
            ""Id""              uuid NOT NULL,
            ""Title""           text NOT NULL,
            ""Advertiser""      text NOT NULL DEFAULT '',
            ""AudioUrl""        text NOT NULL DEFAULT '',
            ""AudioKey""        text NULL,
            ""ImageUrl""        text NULL,
            ""ImageKey""        text NULL,
            ""ClickUrl""        text NULL,
            ""DurationMs""      bigint NOT NULL DEFAULT 0,
            ""Country""         text NULL,
            ""Weight""          integer NOT NULL DEFAULT 1,
            ""IsActive""        boolean NOT NULL DEFAULT true,
            ""StartsAt""        timestamp with time zone NULL,
            ""EndsAt""          timestamp with time zone NULL,
            ""ImpressionCount"" bigint NOT NULL DEFAULT 0,
            ""CreatedAt""       timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_Advertisements"" PRIMARY KEY (""Id"")
        );
        CREATE INDEX IF NOT EXISTS ""IX_Advertisements_IsActive_Country""
            ON ""Advertisements""(""IsActive"", ""Country"");

        CREATE TABLE IF NOT EXISTS ""AdSettings"" (
            ""Id""            uuid NOT NULL,
            ""AdsPerNTracks"" integer NOT NULL DEFAULT 3,
            ""IsEnabled""     boolean NOT NULL DEFAULT true,
            ""UpdatedAt""     timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_AdSettings"" PRIMARY KEY (""Id"")
        );

        INSERT INTO ""AdSettings"" (""Id"",""AdsPerNTracks"",""IsEnabled"",""UpdatedAt"")
        SELECT gen_random_uuid(), 3, true, now()
        WHERE NOT EXISTS (SELECT 1 FROM ""AdSettings"");

        INSERT INTO ""Advertisements""
            (""Id"",""Title"",""Advertiser"",""AudioUrl"",""AudioKey"",""DurationMs"",""Weight"",""IsActive"",""CreatedAt"")
        SELECT gen_random_uuid(),
               'Go Premium — listen ad-free',
               'Not Spotify',
               t.""AudioUrl"", t.""AudioKey"",
               LEAST(GREATEST(t.""DurationMs"", 10000), 30000),
               1, true, now()
        FROM (
            SELECT ""AudioUrl"", ""AudioKey"", ""DurationMs"",
                   ROW_NUMBER() OVER (ORDER BY ""PlayCount"" DESC, ""CreatedAt"" DESC) AS rn
            FROM ""Tracks"" WHERE ""Status"" = 'approved'
        ) t
        WHERE t.rn <= 2 AND NOT EXISTS (SELECT 1 FROM ""Advertisements"");
    ");

    // RBAC approval queue (same idempotent guard pattern). Non-master admins'
    // privileged actions land here pending a master admin's approval.
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""PendingActions"" (
            ""Id""                uuid NOT NULL,
            ""ActionType""        text NOT NULL,
            ""TargetUserId""      uuid NOT NULL,
            ""TargetEmail""       text NOT NULL DEFAULT '',
            ""Status""            text NOT NULL DEFAULT 'pending',
            ""RequestedByUserId"" uuid NOT NULL,
            ""RequestedByName""   text NOT NULL DEFAULT '',
            ""RequestedAt""       timestamp with time zone NOT NULL DEFAULT now(),
            ""ReviewedByUserId""  uuid NULL,
            ""ReviewedByName""    text NULL,
            ""ReviewedAt""        timestamp with time zone NULL,
            ""ReviewNote""        text NULL,
            CONSTRAINT ""PK_PendingActions"" PRIMARY KEY (""Id"")
        );
        CREATE INDEX IF NOT EXISTS ""IX_PendingActions_Status_RequestedAt""
            ON ""PendingActions""(""Status"", ""RequestedAt"");
        CREATE INDEX IF NOT EXISTS ""IX_PendingActions_RequestedByUserId""
            ON ""PendingActions""(""RequestedByUserId"");
    ");

    // Personal uploads locker (same idempotent guard pattern). Per-user private
    // audio — never part of the public catalogue.
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""UserUploads"" (
            ""Id""         uuid NOT NULL,
            ""UserId""     uuid NOT NULL,
            ""Title""      text NOT NULL DEFAULT '',
            ""Artist""     text NULL,
            ""AudioUrl""   text NOT NULL DEFAULT '',
            ""AudioKey""   text NULL,
            ""DurationMs"" bigint NOT NULL DEFAULT 0,
            ""CreatedAt""  timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_UserUploads"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_UserUploads_AspNetUsers_UserId""
                FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ""IX_UserUploads_UserId_CreatedAt""
            ON ""UserUploads""(""UserId"", ""CreatedAt"");
    ");

    // Music videos (same idempotent guard pattern). One-time-seeds a few videos
    // linked to top tracks using public sample footage so the catalogue plays.
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""MusicVideos"" (
            ""Id""           uuid NOT NULL,
            ""Title""        text NOT NULL,
            ""ArtistId""     uuid NOT NULL,
            ""TrackId""      uuid NULL,
            ""Description""  text NULL,
            ""VideoUrl""     text NOT NULL DEFAULT '',
            ""VideoKey""     text NULL,
            ""ThumbnailUrl"" text NULL,
            ""ThumbnailKey"" text NULL,
            ""DurationMs""   bigint NOT NULL DEFAULT 0,
            ""ViewCount""    bigint NOT NULL DEFAULT 0,
            ""CreatedAt""    timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_MusicVideos"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_MusicVideos_Artists_ArtistId""
                FOREIGN KEY (""ArtistId"") REFERENCES ""Artists""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_MusicVideos_Tracks_TrackId""
                FOREIGN KEY (""TrackId"") REFERENCES ""Tracks""(""Id"") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS ""IX_MusicVideos_CreatedAt"" ON ""MusicVideos""(""CreatedAt"");

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MusicVideos' AND column_name = 'Description') THEN
                ALTER TABLE ""MusicVideos"" ADD COLUMN ""Description"" text NULL;
            END IF;
        END $$;

        INSERT INTO ""MusicVideos""
            (""Id"",""Title"",""ArtistId"",""TrackId"",""VideoUrl"",""ThumbnailUrl"",""DurationMs"",""ViewCount"",""CreatedAt"")
        SELECT gen_random_uuid(),
               t.""Title"" || ' (Official Video)',
               t.""ArtistId"", t.""Id"",
               (ARRAY[
                   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'
               ])[((t.rn - 1) % 4) + 1],
               al.""CoverUrl"",
               60000, 0, now()
        FROM (
            SELECT tr.""Id"", tr.""Title"", tr.""ArtistId"", tr.""AlbumId"",
                   ROW_NUMBER() OVER (ORDER BY tr.""PlayCount"" DESC, tr.""CreatedAt"" DESC) AS rn
            FROM ""Tracks"" tr WHERE tr.""Status"" = 'approved'
        ) t
        JOIN ""Albums"" al ON al.""Id"" = t.""AlbumId""
        WHERE t.rn <= 4 AND NOT EXISTS (SELECT 1 FROM ""MusicVideos"");
    ");

    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""MusicVideoComments"" (
            ""Id""           uuid NOT NULL,
            ""MusicVideoId"" uuid NOT NULL,
            ""UserId""       uuid NOT NULL,
            ""Body""         character varying(1000) NOT NULL,
            ""ParentId""     uuid NULL,
            ""TimestampMs""  bigint NULL,
            ""CreatedAt""    timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_MusicVideoComments"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_MusicVideoComments_AspNetUsers_UserId""
                FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_MusicVideoComments_MusicVideos_MusicVideoId""
                FOREIGN KEY (""MusicVideoId"") REFERENCES ""MusicVideos""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_MusicVideoComments_MusicVideoComments_ParentId""
                FOREIGN KEY (""ParentId"") REFERENCES ""MusicVideoComments""(""Id"") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS ""IX_MusicVideoComments_MusicVideoId_CreatedAt""
            ON ""MusicVideoComments""(""MusicVideoId"", ""CreatedAt"");
        CREATE INDEX IF NOT EXISTS ""IX_MusicVideoComments_ParentId""
            ON ""MusicVideoComments""(""ParentId"");
        CREATE INDEX IF NOT EXISTS ""IX_MusicVideoComments_UserId""
            ON ""MusicVideoComments""(""UserId"");
    ");

    // Concert/tour info. Artist-authored rows (Source='artist') are the source of
    // truth + fallback; rows with Source='ticketmaster' are cached from the live
    // Discovery API and refreshed in the background by TourSyncService. No fake
    // seeding — an artist with no events simply shows none until a date is added or
    // the sync finds one. We also purge the old google-search demo rows on startup.
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""TourDates"" (
            ""Id""         uuid NOT NULL,
            ""ArtistId""   uuid NOT NULL,
            ""EventDate""  timestamp with time zone NOT NULL,
            ""City""       text NOT NULL DEFAULT '',
            ""Venue""      text NOT NULL DEFAULT '',
            ""Country""    text NOT NULL DEFAULT '',
            ""TicketUrl""  text NULL,
            ""Source""     text NOT NULL DEFAULT 'artist',
            ""ExternalId"" text NULL,
            CONSTRAINT ""PK_TourDates"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_TourDates_Artists_ArtistId""
                FOREIGN KEY (""ArtistId"") REFERENCES ""Artists""(""Id"") ON DELETE CASCADE
        );
        -- Shared DBs created before the sync feature: add the new columns idempotently.
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'TourDates' AND column_name = 'Source') THEN
                ALTER TABLE ""TourDates"" ADD COLUMN ""Source"" text NOT NULL DEFAULT 'artist';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'TourDates' AND column_name = 'ExternalId') THEN
                ALTER TABLE ""TourDates"" ADD COLUMN ""ExternalId"" text NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Artists' AND column_name = 'TourSyncedAt') THEN
                ALTER TABLE ""Artists"" ADD COLUMN ""TourSyncedAt"" timestamp with time zone NULL;
            END IF;
        END $$;
        CREATE INDEX IF NOT EXISTS ""IX_TourDates_ArtistId_EventDate""
            ON ""TourDates""(""ArtistId"",""EventDate"");

        -- One-time cleanup of the old fake demo dates, identified by their generic
        -- google-search ticket link. Idempotent: matches nothing once removed.
        DELETE FROM ""TourDates""
        WHERE ""Source"" = 'artist'
          AND ""TicketUrl"" LIKE 'https://www.google.com/search?q=%tour+tickets';
    ");

    // Tour setlists — ordered songs the artist plans to play at a show. Idempotent
    // guard (no seed; artists fill this in from the dashboard).
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""TourDateTracks"" (
            ""TourDateId"" uuid NOT NULL,
            ""TrackId""    uuid NOT NULL,
            ""Position""   integer NOT NULL DEFAULT 0,
            CONSTRAINT ""PK_TourDateTracks"" PRIMARY KEY (""TourDateId"",""TrackId""),
            CONSTRAINT ""FK_TourDateTracks_TourDates_TourDateId""
                FOREIGN KEY (""TourDateId"") REFERENCES ""TourDates""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_TourDateTracks_Tracks_TrackId""
                FOREIGN KEY (""TrackId"") REFERENCES ""Tracks""(""Id"") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ""IX_TourDateTracks_TrackId""
            ON ""TourDateTracks""(""TrackId"");
    ");

    // Multi-seat plans (Duo/Family/Student): per-user tier + shared-seat owner
    // columns, plus the membership/invite table. Same idempotent guard pattern —
    // the shared Supabase DB may already have these from a teammate's run.
    await db.Database.ExecuteSqlRawAsync(@"
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'AspNetUsers' AND column_name = 'PlanTier') THEN
                ALTER TABLE ""AspNetUsers"" ADD COLUMN ""PlanTier"" text NOT NULL DEFAULT 'individual';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'AspNetUsers' AND column_name = 'PlanOwnerId') THEN
                ALTER TABLE ""AspNetUsers"" ADD COLUMN ""PlanOwnerId"" uuid NULL;
            END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS ""PlanMemberships"" (
            ""Id""           uuid NOT NULL,
            ""OwnerId""      uuid NOT NULL,
            ""InvitedEmail"" text NOT NULL DEFAULT '',
            ""MemberId""     uuid NULL,
            ""Status""       text NOT NULL DEFAULT 'invited',
            ""CreatedAt""    timestamp with time zone NOT NULL DEFAULT now(),
            ""AcceptedAt""   timestamp with time zone NULL,
            CONSTRAINT ""PK_PlanMemberships"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_PlanMemberships_AspNetUsers_OwnerId""
                FOREIGN KEY (""OwnerId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_PlanMemberships_AspNetUsers_MemberId""
                FOREIGN KEY (""MemberId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS ""IX_PlanMemberships_OwnerId"" ON ""PlanMemberships""(""OwnerId"");
        CREATE INDEX IF NOT EXISTS ""IX_PlanMemberships_MemberId"" ON ""PlanMemberships""(""MemberId"");
        CREATE INDEX IF NOT EXISTS ""IX_PlanMemberships_InvitedEmail"" ON ""PlanMemberships""(""InvitedEmail"");
    ");

    // Runtime feature flags and lightweight app settings. Auth provider toggles live here
    // so admins can show/hide providers without a deploy.
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""AppSettings"" (
            ""Key""       character varying(160) NOT NULL,
            ""Value""     character varying(4000) NOT NULL,
            ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_AppSettings"" PRIMARY KEY (""Key"")
        );

        INSERT INTO ""AppSettings"" (""Key"", ""Value"", ""UpdatedAt"")
        VALUES
            ('auth.external.google.enabled', 'true', now()),
            ('auth.external.facebook.enabled', 'false', now()),
            ('auth.external.apple.enabled', 'false', now())
        ON CONFLICT (""Key"") DO NOTHING;
    ");

    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""UserAccountPreferences"" (
            ""UserId"" uuid NOT NULL,
            ""AllowPersonalizedAds"" boolean NOT NULL DEFAULT true,
            ""BlockAlcoholAds"" boolean NOT NULL DEFAULT false,
            ""BlockGamblingAds"" boolean NOT NULL DEFAULT false,
            ""EmailProductUpdates"" boolean NOT NULL DEFAULT true,
            ""EmailSecurityAlerts"" boolean NOT NULL DEFAULT true,
            ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_UserAccountPreferences"" PRIMARY KEY (""UserId""),
            CONSTRAINT ""FK_UserAccountPreferences_AspNetUsers_UserId""
                FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ""DeletedPlaylists"" (
            ""Id"" uuid NOT NULL,
            ""OriginalPlaylistId"" uuid NOT NULL,
            ""UserId"" uuid NOT NULL,
            ""Name"" character varying(200) NOT NULL,
            ""Description"" text NULL,
            ""CoverUrl"" text NULL,
            ""CoverKey"" text NULL,
            ""IsPublic"" boolean NOT NULL,
            ""Visibility"" character varying(20) NOT NULL DEFAULT 'public',
            ""Rules"" text NULL,
            ""TracksJson"" jsonb NOT NULL DEFAULT '[]'::jsonb,
            ""DeletedAt"" timestamp with time zone NOT NULL,
            ""ExpiresAt"" timestamp with time zone NOT NULL,
            CONSTRAINT ""PK_DeletedPlaylists"" PRIMARY KEY (""Id""),
            CONSTRAINT ""FK_DeletedPlaylists_AspNetUsers_UserId""
                FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS ""IX_DeletedPlaylists_UserId_DeletedAt""
            ON ""DeletedPlaylists""(""UserId"", ""DeletedAt"");
        CREATE INDEX IF NOT EXISTS ""IX_DeletedPlaylists_ExpiresAt""
            ON ""DeletedPlaylists""(""ExpiresAt"");
    ");

    await DbSeeder.SeedAsync(scope.ServiceProvider);
    await RepairKnownInstrumentalLyricsAsync(db);

    // Fill the romanization-aware search blob for new rows, and recompute once
    // when the curated alias dictionary version changes.
    try
    {
        var backfilled = await NotSpotify.Api.Services.SearchTextBackfill.RunAsync(db);
        if (backfilled > 0) Console.WriteLine($"[SearchText] Backfilled {backfilled} row(s).");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[SearchText] Backfill skipped: {ex.Message}");
    }
}

// One-time bulk catalogue import (`dotnet run -- import-music [--path <dir>] [--dry-run]`).
// Runs after migrations/seed so the schema + genres exist, then exits without starting
// the web host. Idempotent: re-running skips tracks that already have audio.
if (args.Contains("import-music"))
{
    await MusicImporter.RunAsync(app.Services, args);
    return;
}

// Force-recompute the romanization-aware SearchText blob for every Artist/Album/Track
// (`dotnet run -- backfill-search-text`). Use after editing the alias dictionary in
// SearchAliases — startup only fills rows that are still null.
if (args.Contains("backfill-search-text"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var n = await NotSpotify.Api.Services.SearchTextBackfill.RunAsync(db, force: true);
    Console.WriteLine($"[SearchText] Recomputed {n} row(s).");
    return;
}

// One-off bulk playlist deletion (`dotnet run -- delete-playlists [--owner <name|email>] [--dry-run]`).
// Mirrors the per-user delete (just removes the Playlist rows; PlaylistTracks/mood-tags/
// reposts/saved rows fall away via the DB's ON DELETE CASCADE). No --owner = ALL playlists.
if (args.Contains("delete-playlists"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var ownerIdx = Array.IndexOf(args, "--owner");
    var owner = ownerIdx >= 0 && ownerIdx + 1 < args.Length ? args[ownerIdx + 1] : null;

    var query = db.Playlists.Include(p => p.Owner).AsQueryable();
    if (owner is not null)
        query = query.Where(p => p.Owner.Name == owner || p.Owner.Email == owner);

    var playlists = await query.ToListAsync();
    Console.WriteLine($"[Playlists] {playlists.Count} playlist(s) match{(owner is null ? " (ALL owners)" : $" (owner = {owner})")}:");
    foreach (var p in playlists)
        Console.WriteLine($"   - {p.Name}  (owner: {p.Owner?.Name ?? "?"})");

    if (args.Contains("--dry-run"))
    {
        Console.WriteLine("[Playlists] DRY RUN — nothing deleted.");
        return;
    }

    db.Playlists.RemoveRange(playlists);
    var removed = await db.SaveChangesAsync();
    Console.WriteLine($"[Playlists] Deleted {playlists.Count} playlist(s) ({removed} rows incl. cascaded children).");
    return;
}

// Re-scrape Spotify and overwrite an artist's profile + banner images in storage.
// Useful when the scraper logic changes (e.g. switching to a larger size variant).
// Usage: dotnet run -- refresh-spotify-images --name "RADWIMPS" --spotify-id 1EowJ1WwkMzkCkRomFhui7
if (args.Contains("refresh-spotify-images"))
{
    string? GetArg(string n) { var i = Array.IndexOf(args, n); return i >= 0 && i + 1 < args.Length ? args[i + 1] : null; }
    var name = GetArg("--name");
    var spotifyId = GetArg("--spotify-id");
    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(spotifyId))
    {
        Console.WriteLine("[refresh-spotify-images] both --name and --spotify-id are required"); return;
    }

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<NotSpotify.Api.Data.AppDbContext>();
    var storage = scope.ServiceProvider.GetRequiredService<NotSpotify.Api.Services.IStorageService>();
    var http = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>().CreateClient();
    http.DefaultRequestHeaders.UserAgent.ParseAdd("not-spotify-import/1.0");

    var artist = await db.Artists.FirstOrDefaultAsync(a => a.Name.ToLower() == name.ToLower());
    if (artist is null) { Console.WriteLine($"[refresh-spotify-images] '{name}' not found"); return; }

    using var pageRes = await http.GetAsync($"https://open.spotify.com/artist/{spotifyId}");
    if (!pageRes.IsSuccessStatusCode) { Console.WriteLine($"[refresh-spotify-images] Spotify page returned {(int)pageRes.StatusCode}"); return; }
    var html = await pageRes.Content.ReadAsStringAsync();
    var m = System.Text.RegularExpressions.Regex.Match(html, @"i\.scdn\.co/image/ab67616100[0-9a-f]{6}(?<hash>[0-9a-f]{24})");
    if (!m.Success) { Console.WriteLine("[refresh-spotify-images] no image found in Spotify page"); return; }
    var url = $"https://i.scdn.co/image/ab6761610000e5eb{m.Groups["hash"].Value}";

    using var imgRes = await http.GetAsync(url);
    if (!imgRes.IsSuccessStatusCode) { Console.WriteLine($"[refresh-spotify-images] image download returned {(int)imgRes.StatusCode}"); return; }
    var bytes = await imgRes.Content.ReadAsByteArrayAsync();
    Console.WriteLine($"[refresh-spotify-images] downloaded {bytes.Length:N0} bytes from {url}");

    // Overwrite existing keys when present, else create new ones.
    var profileKey = artist.ImageKey ?? $"images/artists/{Guid.NewGuid()}.jpg";
    var headerKey  = artist.HeaderImageKey ?? $"images/artists/{Guid.NewGuid()}-header.jpg";
    await storage.UploadAsync(profileKey, new MemoryStream(bytes), "image/jpeg");
    await storage.UploadAsync(headerKey,  new MemoryStream(bytes), "image/jpeg");
    artist.ImageKey = profileKey;
    artist.HeaderImageKey = headerKey;
    artist.ImageUrl = null;
    artist.HeaderImageUrl = null;
    await db.SaveChangesAsync();
    Console.WriteLine($"[refresh-spotify-images] '{artist.Name}' profile + banner refreshed (profile={profileKey}, header={headerKey})");
    return;
}

// Quick lookup: print one artist's row + their albums + track counts.
// Usage: dotnet run -- show-artist --name "RADWIMPS"
if (args.Contains("show-artist"))
{
    string? GetArg(string n) { var i = Array.IndexOf(args, n); return i >= 0 && i + 1 < args.Length ? args[i + 1] : null; }
    var name = GetArg("--name");
    if (string.IsNullOrWhiteSpace(name)) { Console.WriteLine("[show-artist] --name is required"); return; }
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<NotSpotify.Api.Data.AppDbContext>();
    var a = await db.Artists.FirstOrDefaultAsync(x => x.Name.ToLower() == name.ToLower());
    if (a is null) { Console.WriteLine($"[show-artist] '{name}' not found"); return; }
    Console.WriteLine($"[show-artist] {a.Name}: country={a.Country}, listeners={a.MonthlyListeners:N0}, followers={a.FollowerCount:N0}, verified={a.Verified}, revoked={a.IsRevoked}");
    Console.WriteLine($"             image={(a.ImageKey ?? a.ImageUrl ?? "(none)")}, header={(a.HeaderImageKey ?? a.HeaderImageUrl ?? "(none)")}");
    var albums = await db.Albums.Where(al => al.ArtistId == a.Id).ToListAsync();
    foreach (var al in albums)
    {
        var trackCount = await db.Tracks.CountAsync(t => t.AlbumId == al.Id);
        Console.WriteLine($"             - album '{al.Title}' [{al.Type}, status={al.Status}, {trackCount} tracks, cover={(al.CoverKey ?? al.CoverUrl ?? "(none)")}]");
    }
    return;
}

// Update one artist's listener/follower counts (and optional bio / socials) by name.
// Usage: dotnet run -- update-artist --name "Vaundy" --listeners 6100000 --followers 2500000
//        optional: --bio "..." --country JP --instagram handle --twitter handle --verified true
if (args.Contains("update-artist"))
{
    string? GetArg(string n) { var i = Array.IndexOf(args, n); return i >= 0 && i + 1 < args.Length ? args[i + 1] : null; }
    var name = GetArg("--name");
    if (string.IsNullOrWhiteSpace(name)) { Console.WriteLine("[update-artist] --name is required"); return; }

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<NotSpotify.Api.Data.AppDbContext>();
    var artist = await db.Artists.FirstOrDefaultAsync(a => a.Name.ToLower() == name.ToLower());
    if (artist is null) { Console.WriteLine($"[update-artist] No artist named '{name}'"); return; }

    if (long.TryParse(GetArg("--listeners"), out var ml)) artist.MonthlyListeners = ml;
    if (long.TryParse(GetArg("--followers"), out var fc)) artist.FollowerCount = fc;
    if (GetArg("--bio") is { } bio) artist.Bio = bio;
    if (GetArg("--country") is { } country) artist.Country = country;
    if (GetArg("--instagram") is { } ig) artist.Instagram = ig;
    if (GetArg("--twitter") is { } tw) artist.Twitter = tw;
    if (bool.TryParse(GetArg("--verified"), out var verified)) artist.Verified = verified;

    await db.SaveChangesAsync();
    Console.WriteLine($"[update-artist] '{artist.Name}' → listeners={artist.MonthlyListeners:N0}, followers={artist.FollowerCount:N0}, country={artist.Country}, verified={artist.Verified}");
    return;
}

// Update one artist's genre by name (creates the genre if it doesn't exist).
// Usage:
// dotnet run -- update-artist-genre --artist "Zedd" --genre "Electronic"

if (args.Contains("update-artist-genre"))
{
    string? GetArg(string key)
    {
        var i = Array.IndexOf(args, key);
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    var artistName = GetArg("--artist");
    var genreName = GetArg("--genre");

    if (string.IsNullOrWhiteSpace(artistName))
    {
        Console.WriteLine("[update-artist-genre] --artist is required");
        return;
    }

    if (string.IsNullOrWhiteSpace(genreName))
    {
        Console.WriteLine("[update-artist-genre] --genre is required");
        return;
    }

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var genreSlug = genreName
        .Trim()
        .ToLowerInvariant()
        .Replace("&", "and")
        .Replace("/", "-")
        .Replace(" ", "-");

    var genre = await db.Genres.FirstOrDefaultAsync(g =>
        g.Name.ToLower() == genreName.ToLower() ||
        g.Slug.ToLower() == genreSlug);

    if (genre is null)
    {
        genre = new Genre
        {
            Name = genreName.Trim(),
            Slug = genreSlug
        };

        db.Genres.Add(genre);
        await db.SaveChangesAsync();

        Console.WriteLine($"[update-artist-genre] Created genre '{genre.Name}' ({genre.Slug})");
    }

    var tracks = await db.Tracks
        .Include(t => t.Artist)
        .Include(t => t.TrackGenres)
        .Where(t => t.Artist.Name.ToLower() == artistName.ToLower())
        .ToListAsync();

    if (tracks.Count == 0)
    {
        Console.WriteLine($"[update-artist-genre] No tracks found for artist '{artistName}'");
        return;
    }

    var updated = 0;

    foreach (var track in tracks)
    {
        if (!track.TrackGenres.Any(tg => tg.GenreId == genre.Id))
        {
            track.TrackGenres.Add(new TrackGenre
            {
                TrackId = track.Id,
                GenreId = genre.Id
            });

            updated++;
        }
    }

    await db.SaveChangesAsync();

    Console.WriteLine($"[update-artist-genre] Updated {updated}/{tracks.Count} tracks for '{artistName}' → {genre.Name}");
    return;
}

app.Run();

static async Task RepairKnownInstrumentalLyricsAsync(AppDbContext db)
{
    var radwimpsInstrumentals = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Date",
        "Date 2",
        "Theme of Mitsuha",
    };

    var tracks = await db.Tracks
        .Include(t => t.Artist)
        .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
        .Where(t => t.Artist.Name == "RADWIMPS")
        .ToListAsync();

    tracks = tracks.Where(t => radwimpsInstrumentals.Contains(t.Title)).ToList();
    if (tracks.Count == 0) return;

    var instrumental = await db.Genres.FirstOrDefaultAsync(g => g.Slug == "instrumental");
    if (instrumental is null)
    {
        instrumental = new Genre
        {
            Id = Guid.NewGuid(),
            Name = "Instrumental",
            Slug = "instrumental",
            Color = "#607D8B",
        };
        db.Genres.Add(instrumental);
    }

    var changed = false;
    foreach (var track in tracks)
    {
        if (!track.TrackGenres.Any(tg => string.Equals(tg.Genre.Slug, "instrumental", StringComparison.OrdinalIgnoreCase)))
        {
            track.TrackGenres.Add(new TrackGenre { TrackId = track.Id, GenreId = instrumental.Id });
            changed = true;
        }

        if (!string.IsNullOrWhiteSpace(track.Lyrics) || track.SyncedLyrics != "__none__")
        {
            track.Lyrics = null;
            track.SyncedLyrics = "__none__";
            changed = true;
        }
    }

    if (changed)
    {
        await db.SaveChangesAsync();
        Console.WriteLine($"[SeedRepair] Cleared lyrics for {tracks.Count} known RADWIMPS instrumental track(s).");
    }
}
