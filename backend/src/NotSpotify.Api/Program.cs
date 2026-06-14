using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
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
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<PresenceHub>("/hubs/presence");

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

    await DbSeeder.SeedAsync(scope.ServiceProvider);
}

app.Run();
