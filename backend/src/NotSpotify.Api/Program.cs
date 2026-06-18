using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
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

var supabaseStorageSection = builder.Configuration.GetSection("SupabaseStorage");
var supabaseUrl = supabaseStorageSection["Url"];
if (!string.IsNullOrWhiteSpace(supabaseUrl))
{
    builder.Services.Configure<SupabaseStorageOptions>(supabaseStorageSection);
    builder.Services.AddHttpClient();
    builder.Services.AddSingleton<IStorageService, SupabaseStorageService>();
    Console.WriteLine($"[Storage] Using Supabase: {supabaseUrl} (bucket: {supabaseStorageSection["Bucket"]})");
}
else
{
    builder.Services.Configure<LocalStorageOptions>(builder.Configuration.GetSection("LocalStorage"));
    builder.Services.AddSingleton<IStorageService, LocalStorageService>();
    Console.WriteLine("[Storage] Using LocalStorage (Supabase URL is empty — user-secrets not loaded?)");
}
builder.Services.AddScoped<MediaMapper>();
builder.Services.AddScoped<AudioDownloadService>();
builder.Services.AddScoped<LyricsService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.Configure<StripeBillingOptions>(builder.Configuration.GetSection("Stripe"));
builder.Services.AddHttpClient<StripeBillingService>();

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
    await db.Database.MigrateAsync();

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

    await DbSeeder.SeedAsync(scope.ServiceProvider);
}

app.Run();
