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
builder.Services.AddScoped<SmartPlaylistService>();
builder.Services.AddScoped<AudioWaveformService>();
builder.Services.Configure<StripeBillingOptions>(builder.Configuration.GetSection("Stripe"));
builder.Services.AddHttpClient<StripeBillingService>();
builder.Services.Configure<TicketmasterOptions>(builder.Configuration.GetSection("Ticketmaster"));
builder.Services.AddHttpClient<TicketmasterService>();
builder.Services.AddScoped<TourSyncService>();
builder.Services.AddHostedService<TourSyncBackgroundService>();

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173" };

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
            ""CreatedAt""   timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ""PK_Podcasts"" PRIMARY KEY (""Id"")
        );
        CREATE INDEX IF NOT EXISTS ""IX_Podcasts_Title"" ON ""Podcasts""(""Title"");
        CREATE INDEX IF NOT EXISTS ""IX_Podcasts_CreatedAt"" ON ""Podcasts""(""CreatedAt"");

        CREATE TABLE IF NOT EXISTS ""Episodes"" (
            ""Id""            uuid NOT NULL,
            ""PodcastId""     uuid NOT NULL,
            ""Title""         text NOT NULL,
            ""Description""   text NULL,
            ""AudioUrl""      text NOT NULL DEFAULT '',
            ""AudioKey""      text NULL,
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

    await DbSeeder.SeedAsync(scope.ServiceProvider);
}

// One-time bulk catalogue import (`dotnet run -- import-music [--path <dir>] [--dry-run]`).
// Runs after migrations/seed so the schema + genres exist, then exits without starting
// the web host. Idempotent: re-running skips tracks that already have audio.
if (args.Contains("import-music"))
{
    await MusicImporter.RunAsync(app.Services, args);
    return;
}

app.Run();
