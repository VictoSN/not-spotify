# not-spotify Backend

ASP.NET Core 8 Web API for the not-spotify music streaming app.

- **Framework:** .NET 8 LTS, ASP.NET Core Web API (Controllers)
- **Database:** PostgreSQL via EF Core (Npgsql)
- **Auth:** ASP.NET Core Identity + JWT bearer + refresh-token cookies

## Prerequisites

Install once per machine:

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [PostgreSQL](https://www.postgresql.org/download/) (any recent version; tested with 16)
- [pgAdmin](https://www.pgadmin.org/) (optional but handy for managing the DB)

## First-time setup

> **Which database?** The live app runs on **AWS RDS (PostgreSQL)**, and the team shares one instance for day-to-day dev — in that case you **don't install PostgreSQL locally**; you just get the connection string from a teammate (or the RDS endpoint) and skip straight to [step 2](#2-store-your-local-secrets). The steps below (installing PostgreSQL + creating a local `notspotify_app` user/DB) are only for running a fully self-contained local database on your own machine. Either way, **the schema is created automatically on startup** — see [step 3](#3-database-schema-auto-applied-on-startup).

### 1. (Local DB only) Create the dev database and app user

In **pgAdmin** (connect as `postgres` superuser):

1. **Login/Group Roles → Create → Login/Group Role**
   - General → Name: `notspotify_app`
   - Definition → Password: pick anything (e.g. `notspotify` for ease)
   - Privileges → Can login: ✅
2. **Databases → Create → Database**
   - Name: `notspotify`
   - Owner: `notspotify_app`

Or equivalent SQL:

```sql
CREATE USER notspotify_app WITH PASSWORD 'notspotify';
CREATE DATABASE notspotify OWNER notspotify_app;
```

> **Never use the `postgres` superuser** in your connection string. The dedicated app user can only touch the `notspotify` database, which limits blast radius.

### 2. Store your local secrets

Secrets stay on **your machine only** — they are written to `%APPDATA%\Microsoft\UserSecrets\<id>\secrets.json` and never touch the repo.

```powershell
cd backend/src/NotSpotify.Api

dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=notspotify;Username=notspotify_app;Password=<the-password-you-picked>"

dotnet user-secrets set "Jwt:SigningKey" "<any-random-string-32+-chars>"

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

### 3. Database schema (auto-applied on startup)

**You don't need to run any migration command.** On boot, `Program.cs` calls `MigrateAsync()` to apply all EF Core migrations, then runs idempotent `CREATE TABLE / COLUMN IF NOT EXISTS` guards for the newest schema. Starting the API in [step 4](#4-run-the-api) is enough to create every table — on a brand-new local DB *or* a fresh AWS RDS.

> ⚠️ **Do not `dotnet ef migrations add`.** This project patches newer tables/columns with idempotent raw SQL in `Program.cs`; regenerating migrations produces a broken full-schema diff. If you genuinely need a schema change, add an idempotent raw-SQL guard rather than a new migration.

### 4. Run the API

```powershell
cd backend/src/NotSpotify.Api
dotnet run
```

The API listens on `https://localhost:7045` (and `http://localhost:5166`).

On first boot the seeder populates the database with the same demo data the frontend uses in mock mode (12 tracks, 5 artists, 5 albums, 3 playlists, 18 genres, and a demo user).

### 5. Try it

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
| Apply schema | (automatic on `dotnet run` — see [step 3](#3-database-schema-auto-applied-on-startup)) |
| Change the schema | Add an idempotent raw-SQL guard in `Program.cs` — **not** `dotnet ef migrations add` |
| List saved secrets | `dotnet user-secrets list` |
| Remove a saved secret | `dotnet user-secrets remove "Key:Path"` |

## Configuration reference

| Key | Where | Notes |
|---|---|---|
| `ConnectionStrings:Postgres` | user-secrets (local) / env var (prod) | Standard Npgsql conn string |
| `Jwt:SigningKey` | user-secrets (local) / Secrets Manager (prod) | Must be 32+ chars |
| `Jwt:Issuer`, `Jwt:Audience` | `appsettings.json` | Safe to commit |
| `Jwt:AccessTokenMinutes` | `appsettings.json` | Default 15 |
| `Jwt:RefreshTokenDays` | `appsettings.json` | Default 30 |
| `Cors:AllowedOrigins` | `appsettings.json` | Defaults to Vite's `http://localhost:5173` |
| `Stripe:SecretKey` | user-secrets / env var | Stripe test/live secret key for Checkout and Portal |
| `Stripe:WebhookSecret` | user-secrets / env var | `whsec_...` signing secret for `/stripe/webhook` |
| `Stripe:MonthlyPriceId` | user-secrets / env var | Stripe recurring monthly Price ID |
| `Stripe:YearlyPriceId` | user-secrets / env var | Stripe recurring yearly Price ID, configured in Stripe as 15% cheaper annually |
| `Stripe:SuccessUrl`, `Stripe:CancelUrl`, `Stripe:PortalReturnUrl` | user-secrets / env var | Frontend redirects for Checkout and Customer Portal |
| `S3Storage:BucketName` | user-secrets / env var | S3 bucket name — enables cloud storage when set |
| `S3Storage:Region` | user-secrets / env var | AWS region (default `us-east-1`) |
| `S3Storage:AccessKeyId` | user-secrets / env var | AWS access key ID |
| `S3Storage:SecretAccessKey` | user-secrets / env var | AWS secret access key |

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

The app has a storage abstraction (`IStorageService`) so media (audio, cover art, avatars) is served the same way locally and on AWS — only the backing implementation changes. The provider is chosen at startup by **priority: S3 → Local**, and printed to the console (`[Storage] Using …`). **The live deployment uses AWS S3**; local disk is the zero-config fallback when no S3 config is present.

### Local disk (fallback when S3 isn't configured)

`LocalStorageService` serves files out of `backend/src/NotSpotify.Api/wwwroot/uploads/`:

```
wwwroot/uploads/
├── audio/         # mp3 files,  e.g. audio/track-1.mp3
├── covers/        # album/playlist covers
├── avatars/       # user profile pictures
└── headers/       # artist banner images
```

The folder structure is checked into git via `.gitkeep` markers, but the **actual media files are gitignored** — every developer drops their own copies on their machine. The seed data still uses external URLs (`soundhelix.com` for audio, `picsum.photos` for images) for zero-config local development — you don't have to provide any files to run the app.

### Storage keys vs. URLs

Every media-bearing entity has two columns:

- `*Url` (legacy) — full external URL, e.g. `https://www.soundhelix.com/.../Song-1.mp3`
- `*Key` (preferred) — a storage key, e.g. `audio/track-1.mp3`

If `*Key` is set, the API resolves it via `IStorageService`. Otherwise it falls back to `*Url`. This lets us migrate to S3 incrementally without breaking existing data.

### Trying it locally

1. Drop an mp3 at `backend/src/NotSpotify.Api/wwwroot/uploads/audio/my-song.mp3`.
2. Set a track's `AudioKey` to `audio/my-song.mp3` (via pgAdmin or `psql`):
   ```sql
   UPDATE "Tracks" SET "AudioKey" = 'audio/my-song.mp3', "AudioUrl" = NULL
   WHERE "Title" = 'Tidal Drift';
   ```
3. `GET /tracks/{id}` now returns `audioUrl = https://localhost:7080/uploads/audio/my-song.mp3`.

### S3 Storage (cloud — the live default)

`S3StorageService` handles all cloud media storage through AWS S3 (or any S3-compatible store). Enable it by setting `S3Storage:BucketName` in user secrets (setting it flips the provider to S3 on the next `dotnet run`). Files can be served via presigned URLs or public bucket URLs depending on configuration. Full walkthrough: [`../docs/aws-s3-setup.md`](../docs/aws-s3-setup.md).

## Deployment

The backend is containerized (`src/NotSpotify.Api/Dockerfile`) and deployed to **AWS ECS behind an ALB** (`https://api.not-spotify.lol`) — see [`deploy-backend.ps1`](deploy-backend.ps1). An Elastic Beanstalk path also exists (`deploy-eb.ps1`).

## What's not built yet

- **CI/CD pipeline** (deploys are run manually via the scripts above)
