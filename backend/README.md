# not-spotify Backend

ASP.NET Core 8 Web API for the not-spotify music streaming app.

- **Framework:** .NET 8 LTS, ASP.NET Core Web API (Controllers)
- **Database:** PostgreSQL via EF Core (Npgsql)
- **Auth:** ASP.NET Core Identity + JWT bearer + refresh-token cookies

## Prerequisites

Install once per machine:

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- A Supabase project with PostgreSQL and Storage enabled
- Node.js/npm if you also want to run the frontend

## First-time setup

Follow the complete [Supabase local setup](../docs/supabase-local-setup.md). The application runs locally, while Supabase hosts PostgreSQL and the public media bucket.

### Store your local secrets

Secrets stay on **your machine only** — they are written to `%APPDATA%\Microsoft\UserSecrets\<id>\secrets.json` and never touch the repo.

```powershell
cd backend/src/NotSpotify.Api

dotnet user-secrets set "ConnectionStrings:Postgres" "Host=<session-pooler-host>;Port=5432;Database=postgres;Username=<session-pooler-user>;Password=<database-password>;SSL Mode=Require;Trust Server Certificate=true"

dotnet user-secrets set "Jwt:SigningKey" "<any-random-string-32+-chars>"
dotnet user-secrets set "SupabaseStorage:ProjectUrl" "https://msounbcyosxzypmewacy.supabase.co"
dotnet user-secrets set "SupabaseStorage:BucketName" "not-spotify-media"
dotnet user-secrets set "SupabaseStorage:ServiceRoleKey" "sb_secret_your_server_only_key"

# Optional: enable Stripe Billing in local dev/test mode
dotnet user-secrets set "Stripe:SecretKey" "sk_test_your_real_secret_key"
dotnet user-secrets set "Stripe:WebhookSecret" "whsec_your_real_webhook_secret"
dotnet user-secrets set "Stripe:MonthlyPriceId" "price_your_monthly_recurring_price_id"
dotnet user-secrets set "Stripe:YearlyPriceId" "price_your_yearly_recurring_price_id"
dotnet user-secrets set "Stripe:SuccessUrl" "http://localhost:5173/premium?checkout=success"
dotnet user-secrets set "Stripe:CancelUrl" "http://localhost:5173/premium?checkout=cancelled"
dotnet user-secrets set "Stripe:PortalReturnUrl" "http://localhost:5173/account"
```

For Stripe setup details, including installing Stripe CLI on Windows, creating recurring test prices, and forwarding webhooks to `/stripe/webhook`, see the root `README.md`.

#### Stripe promotional codes (e.g. 5OFF)

Stripe separates *coupons* (the discount rule) from *promotion codes* (the customer-facing code string). You need to create both.

1. **Create the coupon**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Billing → Coupons → Create coupon**
   - Set:
     - **Type:** Percentage discount
     - **Percent off:** `5`
     - **Duration:** Once (applies to the first billing period only)
     - **Redemption limits:** Check **Limit the number of times this coupon can be redeemed** if you want a hard cap, or leave unchecked for unlimited
     - **Redemption date:** Set expiry date to **August 1, 2026** (or your desired date) — tick "Redeem by" and pick the date
   - Click **Create coupon**

2. **Create the promotion code**
   - On the coupon detail page, click **Add promotion code**
   - **Code:** `5OFF` (exact, case-insensitive in Stripe)
   - **First-time orders only:** Enable "Limit to first-time orders" so it only applies once per customer
   - Click **Save**

3. **Enable codes at checkout**
   - Already done. `StripeBillingService.cs` passes `allow_promotion_codes=true` to every checkout session, so the Stripe-hosted checkout page already shows a "Promo code" field automatically. No code changes needed.

You can generate a JWT signing key with PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | % { Get-Random -Max 256 }))
```

### Database schema (auto-applied on startup)

**You don't need to run any migration command.** On boot, `Program.cs` calls `MigrateAsync()` to apply all EF Core migrations, then runs idempotent `CREATE TABLE / COLUMN IF NOT EXISTS` guards for the newest schema. Starting the API is enough to create every table in a new Supabase database.

Use the Supabase **Session pooler** host and username on port `5432`. The direct `db.<project-ref>.supabase.co` endpoint may be IPv6-only and fail on an IPv4-only network.

> ⚠️ **Do not `dotnet ef migrations add`.** This project patches newer tables/columns with idempotent raw SQL in `Program.cs`; regenerating migrations produces a broken full-schema diff. If you genuinely need a schema change, add an idempotent raw-SQL guard rather than a new migration.

### Run the API

```powershell
cd backend/src/NotSpotify.Api
dotnet run
```

The API listens on `https://localhost:7045` (and `http://localhost:5166`).

On first boot the seeder populates the database with the same demo data the frontend uses in mock mode (12 tracks, 5 artists, 5 albums, 3 playlists, 18 genres, and a demo user).

### Try it

- **Swagger UI:** <https://localhost:7045/swagger>
- **Seed user:** `alex@example.com` / `Password123!`
- **Sample endpoints:**
  - `GET /genres`
  - `GET /tracks/featured`
  - `GET /artists`
  - `POST /auth/login` → returns `{ accessToken, user }`

## Pointing the frontend at the local API

Edit `frontend/.env.development`:

```
VITE_USE_MOCK=false
VITE_API_URL=https://localhost:7045
```

Then `npm run dev` in the `frontend/` directory.

> Because the refresh-token cookie is `Secure`, you must use the **HTTPS** URL, not HTTP. If your browser complains about the dev cert, run `dotnet dev-certs https --trust` once.

For Google OAuth setup, use the localhost instructions in [`../docs/auth-setup.md`](../docs/auth-setup.md). The Google OAuth client must be configured as **External**, use the exact localhost callback URI, and be enabled under **Admin → Dev Tools → Social login providers** after its credentials are saved.

## Project layout

```
backend/
└── src/NotSpotify.Api/
    ├── Controllers/   AuthController + resource controllers (Tracks, Artists, Albums, Playlists, Genres, Search)
    ├── Data/          AppDbContext, DbSeeder
    ├── Dtos/          Request/response shapes (camelCase JSON matches frontend types)
    ├── Models/        EF entities (ApplicationUser, Artist, Album, Track, Genre, Playlist, RefreshToken, join tables)
    ├── Services/      TokenService, JwtOptions, Mapper
    ├── Migrations/    EF Core migrations (committed, applied on startup)
    └── Program.cs     DI + middleware wiring
```

## Common tasks

| Task | Command |
|---|---|
| Apply schema | (automatic on `dotnet run` — see [Database schema](#database-schema-auto-applied-on-startup)) |
| Change the schema | Add an idempotent raw-SQL guard in `Program.cs` — **not** `dotnet ef migrations add` |
| List saved secrets | `dotnet user-secrets list` |
| Remove a saved secret | `dotnet user-secrets remove "Key:Path"` |

## Configuration reference

| Key | Where | Notes |
|---|---|---|
| `ConnectionStrings:Postgres` | user-secrets | Supabase PostgreSQL connection string |
| `Jwt:SigningKey` | user-secrets | Must be 32+ chars |
| `Jwt:Issuer`, `Jwt:Audience` | `appsettings.json` | Safe to commit |
| `Jwt:AccessTokenMinutes` | `appsettings.json` | Default 15 |
| `Jwt:RefreshTokenDays` | `appsettings.json` | Default 30 |
| `Cors:AllowedOrigins` | `appsettings.json` | Defaults to Vite's `http://localhost:5173` |
| `Stripe:SecretKey` | user-secrets | Stripe test secret key for Checkout and Portal |
| `Stripe:WebhookSecret` | user-secrets | `whsec_...` signing secret for `/stripe/webhook` |
| `Stripe:MonthlyPriceId` | user-secrets | Stripe recurring monthly Price ID |
| `Stripe:YearlyPriceId` | user-secrets | Stripe recurring yearly Price ID |
| `Stripe:SuccessUrl`, `Stripe:CancelUrl`, `Stripe:PortalReturnUrl` | user-secrets | Frontend redirects for Checkout and Customer Portal |
| `Authentication:Google:ClientId` | user-secrets | Google Web OAuth client ID for localhost login |
| `Authentication:Google:ClientSecret` | user-secrets | Matching Google OAuth client secret |
| `Authentication:Google:RedirectUri` | user-secrets | Normally `https://localhost:7045/auth/external/google/callback` |
| `SupabaseStorage:ProjectUrl` | appsettings / user-secrets | Supabase project URL |
| `SupabaseStorage:BucketName` | appsettings / user-secrets | Public Supabase Storage bucket, normally `not-spotify-media` |
| `SupabaseStorage:ServiceRoleKey` | user-secrets / env var | Server-only Supabase secret key |

### Stripe webhook testing

Run this while the API is running:

```powershell
stripe listen --forward-to https://localhost:7045/stripe/webhook
```

If Stripe CLI is not on `PATH`, run it from the folder where `stripe.exe` was extracted:

```powershell
cd C:\stripe
.\stripe.exe listen --forward-to https://localhost:7045/stripe/webhook
```

Copy the printed `whsec_...` value into `Stripe:WebhookSecret`, restart the API, then perform a new Checkout test.

## Media storage

The app has a storage abstraction (`IStorageService`) so media (audio, cover art, avatars) is handled consistently. This branch uses Supabase Storage exclusively and prints `[Storage] Using Supabase Storage: ...` during startup.

### Supabase Storage

Create a public bucket named `not-spotify-media`, then set the project URL, bucket name, and server-only `sb_secret_...` or legacy `service_role` key in user-secrets. The backend uses the Supabase Storage REST API directly; the frontend never receives the service key.

```
not-spotify-media/
├── audio/         # mp3 files,  e.g. audio/track-1.mp3
├── covers/        # album/playlist covers
├── avatars/       # user profile pictures
└── headers/       # artist banner images
```

The seed data still uses external URLs (`soundhelix.com` for audio, `picsum.photos` for images) where no stored object is needed.

### Storage keys vs. URLs

Every media-bearing entity has two columns:

- `*Url` (legacy) — full external URL, e.g. `https://www.soundhelix.com/.../Song-1.mp3`
- `*Key` (preferred) — a storage key, e.g. `audio/track-1.mp3`

If `*Key` is set, the API resolves it via `IStorageService`. Otherwise it falls back to `*Url`.

### Uploading local media

Admin, artist, profile, playlist, and personal uploads stream through the local API and are written to Supabase Storage. There is no separate direct cloud-upload function in this branch.

## Running

This branch is for localhost development only. Run the API with `dotnet run` or start the complete stack with `.\dev.cmd` from the repository root.
