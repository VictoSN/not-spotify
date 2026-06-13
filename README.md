# 🎵 not-spotify

Definitely not Spotify, developed using Cloud Computing. A premium music streaming web application with an ASP.NET Core Web API backend and React + TypeScript + Vite frontend.

---

## 📊 Project Status & Features

**Live status is tracked in [PROJECT_STATUS.md](PROJECT_STATUS.md)** (single source of truth — what's done, what's next, current bugs). A full competitive gap analysis and roadmap lives in [FEATURE_GAP_REPORT.md](FEATURE_GAP_REPORT.md), and architecture notes for new contributors in [CONTEXT.md](CONTEXT.md).

**What works today (highlights):**
- **Playback:** full player, queue + premium drag-reorder, PiP + OS media keys, sleep timer, playback speed, play-next, autoplay, keyboard shortcuts (`?` for help), star ratings, voice search.
- **Discovery:** trending, for-you, new music, recents, **weekly Top 50 charts**, **search by lyrics**, **song radio**, **"Fans also like"**, **Daily Mixes**.
- **Library/playlists:** create/edit/delete, public/friends/private visibility, collaborative playlists, JSON export/import, library + track sorting, cover-art mosaics.
- **Social:** friends, real-time presence, Friend Activity rail, 1:1 chat, friends-only playlists.
- **Lyrics:** karaoke synced lyrics (highlight + auto-scroll + click-to-seek).
- **Personalization:** light/dark, dynamic cover-art theming, personal listening stats (mini-Wrapped).
- **Artist/Admin:** artist dashboard (uploads, edits, resubmissions), application→review flow, admin CRUD + approval queue + audit history, dedicated `/admin/login`.

**Being worked on next:** notifications center, smart playlists, crossfade/gapless, waveform + timed comments, PWA, and a "listen-along" jam mode. See PROJECT_STATUS.md → *Next up / unfinished*.

### Run everything at once (Windows)
Instead of three manual terminals, **double-click [`dev.cmd`](dev.cmd)** (or run `./dev.sh` from Git Bash). It opens the backend, the Stripe webhook listener, and the frontend in separate windows. (Stripe CLI must be installed + `stripe login` done once.) Manual steps are below.

---

## 🚀 Getting Started

To get both the frontend and backend running locally on your machine, follow these instructions.

### 1. Prerequisites
Ensure you have the following installed:
* [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
* [Node.js (LTS)](https://nodejs.org/)

> **Database:** You do **not** need PostgreSQL installed locally. The team uses a shared **Supabase** Postgres instance — ask a teammate for the connection password (do not commit it to git). See step 2 below.

---

### 2. Backend Setup & Run

1. Open a terminal and navigate to the backend project API directory:
   ```bash
   cd backend/src/NotSpotify.Api
   ```

2. Configure your Supabase database connection and JWT secret via **dotnet user-secrets** (these stay on your machine, outside the repo):
   ```bash
   dotnet user-secrets set "ConnectionStrings:Postgres" "Host=aws-1-ap-northeast-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.nayirxkfuaiejdmeagbr;Password=aLnyRQxbaqyDfeH1;SSL Mode=Require;Trust Server Certificate=true"
   dotnet user-secrets set "Jwt:SigningKey" "a-very-long-random-string-at-least-32-chars-long"
   ```
   Replace `YOUR_SUPABASE_PASSWORD` with the password from your teammate. The values above use the **Supabase Session Pooler** (IPv4-compatible, works with EF Core migrations).

   > **Why a pooler URL, not the direct connection?** Supabase's direct connection (`db.<ref>.supabase.co`) is IPv6-only on the free tier — most home/uni networks can't reach it. The Session Pooler is IPv4-proxied and behaves the same way for our purposes.

   Verify the secrets were saved:
   ```bash
   dotnet user-secrets list
   ```

3. Trust the local HTTPS development certificate:
   ```bash
   dotnet dev-certs https --trust
   ```

4. Start the backend:
   ```bash
   dotnet run
   ```
   On first run, EF Core auto-applies all migrations and `DbSeeder` populates artists/albums/tracks/playlists/genres + the demo admin user. No manual `dotnet ef database update` needed — the schema and seed data already exist in shared Supabase.

   *The API will compile and run on **`https://localhost:7045`** (and Swagger UI will be available at [https://localhost:7045/swagger](https://localhost:7045/swagger)).*

> **Heads up — shared database.** Everyone on the team writes to the same Supabase tables. If you delete a track, your teammate sees it gone. For destructive testing, do it in a transaction you can roll back, or coordinate in the team chat first.

---

### 3. Frontend Setup & Run

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   This installs the frontend runtime packages already listed in `frontend/package.json`, including:
   - `@fontsource-variable/montserrat` for the local Montserrat font.
   - `node-vibrant` for cover-art colour extraction.

   The Picture-in-Picture mini-player (opened from the player bar's PiP button) uses browser APIs (Picture-in-Picture + Media Session). It does not require an npm dependency, but works best in Chrome or Edge on `localhost`/HTTPS. Once opened it persists as a floating window across tabs/windows until you close it.

3. Verify or configure your local environment settings in `frontend/.env.development`:
   ```env
   VITE_USE_MOCK=false
   VITE_API_URL=https://localhost:7045
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *The client will start running on **`http://localhost:5173`**.*

---

### 🔑 Seed Login Credentials

The login page shows **Dev shortcuts** buttons (visible only in `npm run dev` mode) for one-click login into any of the accounts below.

| Account | Email | Password | Role |
|---|---|---|---|
| alex | `alex@example.com` | `Password123!` | Admin + Artist |
| testing1 | `testing1@example.com` | `Testing1` | User |
| testing2 | `testing2@example.com` | `Testing2` | User |

> These are seeded accounts that already exist in the shared Supabase database. Do not change their passwords or you will break the shortcuts for your teammates.

---

## Free vs Premium Tier

### Feature Comparison

| Feature | Free | Premium |
|---|---|---|
| Listening | Playlists only, **shuffle forced on** | Any order, any source |
| Shuffle | Always on, cannot be turned off | Toggle on/off |
| Repeat | Not available (locked) | Repeat all / repeat one |
| Track selection | Random start — clicking a specific track shuffles the whole playlist | Play any track directly |
| Downloads | ✗ | Download songs, albums, and playlists as ZIP files |
| Liked Songs | Full access — like, unlike, view | Full access |
| Save albums | Full access | Full access |
| Playlist management | Create, edit, add/remove songs, set cover, visibility | Same |
| Queue | Add to queue, view next-up | Same |

### Premium capabilities

#### Downloads (`GET /albums/{id}/download-zip` · `GET /playlists/{id}/download-zip`)

Premium users can download music for offline use:

- **Album download** — Download button on every album page. Calls `GET /albums/{id}/download-zip`. Backend fetches each approved track's audio from Supabase storage and bundles them into a ZIP file returned as `application/zip`.
- **Playlist download** — Download button on every playlist page. Calls `GET /playlists/{id}/download-zip`. Same ZIP bundling logic.
- **Individual track** — "Download" option in every track's `…` context menu. Links directly to the Supabase audio URL with a `download` attribute.

All three endpoints are gated: the backend checks `user.Plan == "premium"` and returns HTTP 403 for free users. The frontend also shows a "Premium" badge on the button for free users that redirects to `/premium` on click.

### How free-tier enforcement works (frontend)

- **`user.capabilities.unlimitedPlayback`** (`false` for free, `true` for premium) is set by the backend in `MediaMapper` and included in every auth token response.
- **`playerStore.play()`** — when `isFreeUser()` is true and the queue has more than one track, the queue is shuffled immediately and playback starts from a random position rather than the tapped song.
- **`playerStore.toggleShuffle()`** — no-op for free users; `shuffleEnabled` is always forced to `true`.
- **`playerStore.cycleRepeat()`** — no-op for free users; `repeatMode` stays `'off'`.
- **`ShuffleRepeatControls`** — shuffle button is visually locked (disabled, accent-coloured with tooltip). Repeat button links to `/premium` with a tooltip explaining the restriction.

### Cancelling a subscription

Premium users see a **Cancel subscription** row in Account → Subscription. Clicking it:
1. Prompts for confirmation.
2. Calls `DELETE /billing/subscription` on the backend.
3. The backend cancels the Stripe subscription (if configured) and immediately sets `user.Plan = "free"`.
4. The frontend refreshes the auth token so the new plan takes effect without a page reload.

---

## Stripe Billing Setup For Teammates

Stripe is only needed if you want to test the Premium checkout flow. Normal browsing, login, playback, playlists, profile editing, and admin media work without it.

### 1. Install Stripe CLI

The webhook confirmation uses Stripe CLI in local development.

#### Windows manual install

1. Open the official install page: <https://docs.stripe.com/stripe-cli/install>
2. Choose **Windows** and download the Windows zip.
3. Extract it somewhere simple, for example:
   ```text
   C:\stripe
   ```
4. Open PowerShell in that folder and run:
   ```powershell
   .\stripe.exe login
   ```

If you add `C:\stripe` to your Windows `PATH`, you can run `stripe` from any terminal. Otherwise use `.\stripe.exe` from inside `C:\stripe`.

### 2. Create Stripe Test Prices

In the Stripe Dashboard:

1. Turn on **Test mode / Sandbox**.
2. Go to **Product catalog**: <https://dashboard.stripe.com/test/products>
3. Create a Premium product.
4. Add one **recurring monthly** price.
5. Add one **recurring yearly** price.
   - If monthly is MYR 70, yearly with 15% discount should be MYR 714/year.
6. Copy each price's **API ID**. Real Price IDs look like:
   ```text
   price_1Rxxxxxxxxxxxxxxxxxxxx
   ```

Do not use display labels like `price_55` or `price_200`; those are not real Stripe Price IDs.

### 3. Set Backend User Secrets

From the backend project folder:

```powershell
cd backend/src/NotSpotify.Api

dotnet user-secrets set "Stripe:SecretKey" "sk_test_your_real_secret_key"
dotnet user-secrets set "Stripe:MonthlyPriceId" "price_your_monthly_recurring_price_id"
dotnet user-secrets set "Stripe:YearlyPriceId" "price_your_yearly_recurring_price_id"
dotnet user-secrets set "Stripe:SuccessUrl" "http://localhost:5173/premium?checkout=success"
dotnet user-secrets set "Stripe:CancelUrl" "http://localhost:5173/premium?checkout=cancelled"
dotnet user-secrets set "Stripe:PortalReturnUrl" "http://localhost:5173/account"
```

Get `Stripe:SecretKey` from **Developers -> API keys** in Stripe test mode. It must start with `sk_test_`, not `pk_test_`.

### 4. Add Public Business Name

Stripe Checkout requires a public business name even in test mode. This is just the display name shown on the hosted checkout page; it is not live business verification.

In Stripe Dashboard:

1. Go to **Settings -> Business -> Public details**.
2. Set a public business name, for example:
   ```text
   Not Spotify Test
   ```
3. Save.

You do not need to add a real bank account or fully activate live payments for sandbox testing.

### 5. Run Backend And Webhook Forwarding

Terminal 1:

```powershell
cd backend/src/NotSpotify.Api
dotnet run
```

Terminal 2:

```powershell
cd C:\stripe
.\stripe.exe listen --forward-to https://localhost:7045/stripe/webhook
```

Stripe CLI prints a webhook signing secret:

```text
Your webhook signing secret is whsec_...
```

Set that value:

```powershell
cd backend/src/NotSpotify.Api
dotnet user-secrets set "Stripe:WebhookSecret" "whsec_your_real_webhook_secret"
```

Restart the backend after setting the webhook secret.

### 6. Test Checkout

1. Start backend with `dotnet run`.
2. Keep Stripe CLI running with `listen --forward-to`.
3. Start frontend:
   ```powershell
   cd frontend
   npm run dev
   ```
4. Log in as `alex@example.com` / `Password123!`.
5. Open `http://localhost:5173/premium`.
6. Choose a plan and pay with a Stripe test card:
   ```text
   4242 4242 4242 4242
   ```
   Use any future expiry date, any CVC, and any postal code.

After checkout, the account changes to Premium only after the webhook reaches `/stripe/webhook`. If the page says the subscription is waiting for webhook confirmation, make sure Stripe CLI is still running and the backend was restarted after saving `Stripe:WebhookSecret`.

---

## Recommendation Algorithms

All algorithms run server-side in [`TracksController.cs`](backend/src/NotSpotify.Api/Controllers/TracksController.cs). Each endpoint accepts a `limit` query parameter (default 10, max 50).

### Trending — `GET /tracks/trending`

Surfaces tracks that are popular *right now*, not just all-time favourites.

**Score formula:**
```
score = (plays in last 7 days × 3) + (all-time play count × 0.01)
```

- Recent plays are weighted **300×** more than the historical play count, so a song that went viral this week ranks above a song that was played a lot two years ago.
- A candidate pool of the top `8 × limit` tracks by all-time plays is fetched from the DB first, then re-ranked in memory by the trending score. This keeps the SQL query simple while still favouring recency.
- **Data used:** `PlayHistories` (last 7 days), `Tracks.PlayCount`

---

### Most Liked — `GET /tracks/most-liked`

Ranks by community ratings with a **confidence correction** to prevent single-vote outliers from topping the chart.

**Score formula:**
```
score = averageRating × log₂(ratingCount + 1)
```

- Tracks with fewer than **2 ratings** are excluded entirely.
- The log₂ factor grows slowly: 1 rating → ×1.0, 3 ratings → ×2.0, 7 ratings → ×3.0. A track with 100 ratings at 4.8 still comfortably beats one with 2 ratings at 5.0.
- `RatingCount` and `RatingSum` are stored directly on `Tracks` (denormalised) and updated atomically on every `PUT /me/track-ratings/{id}` or `DELETE /me/track-ratings/{id}`.
- **Data used:** `Tracks.RatingSum`, `Tracks.RatingCount`

---

### For You Today — `GET /tracks/for-you`

Personalised for authenticated users based on their recent listening history. Falls back to the trending feed for guests or first-time users with no history.

**Algorithm steps:**
1. Collect the **distinct track IDs** the user played in the last **30 days** from `PlayHistories`.
2. Extract the **genre IDs** of those tracks via `TrackGenres`.
3. Find tracks that **share at least one of those genres** but were **not recently played** by the user.
4. Rank by **genre-overlap count** (tracks that match more of the user's preferred genres rank higher), breaking ties by all-time play count.

- First-time users (empty play history) receive the trending feed instead.
- **Data used:** `PlayHistories`, `TrackGenres`, `Tracks.PlayCount`

---

### New Music — `GET /tracks/new-music`

Surfaces the most recently added catalogue entries before they accumulate play counts.

```
ORDER BY Tracks.CreatedAt DESC
```

- No scoring — pure recency sort.
- Ensures newly uploaded tracks are discoverable before they appear in trending or most-liked.
- **Data used:** `Tracks.CreatedAt`

---

### Recently Played — `GET /me/recents`

Returns the current user's most recently played **distinct** tracks (requires auth).

- Raw play events are de-duplicated: multiple plays of the same track in a session collapse to the single most-recent timestamp.
- **Data used:** `PlayHistories` (user-scoped)

---

### Weekly Charts — `GET /tracks/charts`

The **Top 50 this week** (`/charts` page). Pure ranking by plays in the last 7 days (from `PlayHistories`), tie-broken by all-time play count, padded with all-time top tracks when the week is quiet. Returns `rank` + `playsThisWeek` per entry.

---

### Song Radio — `GET /tracks/{id}/radio`

An endless "station" seeded from any track (the "Go to song radio" menu item). Ranks the catalogue by a blend of **co-listen similarity** (how often other listeners played a candidate in the same sessions as the seed) + **genre overlap** + a same-artist boost; seed plays first. The same co-listen matrix powers **"Fans also like"** related artists (`GET /artists/{id}/related`).

---

### Daily Mixes — `GET /tracks/daily-mixes`

The **"Made for you"** home row. Builds one mix per the listener's top genres (from their 90-day `PlayHistories`), each filled with that genre's popular tracks, lightly shuffled. Falls back to the catalogue's biggest genres for guests / no-history users.

---

### Search by Lyrics — `GET /search`

Beyond title/artist/album/playlist matches, search also returns `tracksByLyrics` — tracks whose **cached lyrics** contain the query (min 3 chars, title matches excluded). Surfaced as a "Found in lyrics" section. Free because lyrics are already stored per track.

---

### Track Ratings — `PUT /me/track-ratings/{id}` · `DELETE /me/track-ratings/{id}`

Each authenticated user can rate a track 1–5 stars from the bottom player bar. Ratings feed directly into the **Most Liked** algorithm and are stored for future use in personalised feeds.

| Table / Column | Purpose |
|---|---|
| `TrackRatings` (UserId, TrackId, Rating, RatedAt) | One row per user per track |
| `Tracks.RatingCount` | Denormalised count — updated on every write |
| `Tracks.RatingSum` | Denormalised sum — updated on every write |

`AverageRating = RatingSum / RatingCount` is derived at query time.

The frontend stores the user's own rating in `ratingStore` (Zustand + localStorage) and syncs to the backend **optimistically** — the UI updates immediately and rolls back if the API call fails.
