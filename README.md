# 🎵 not-spotify

Definitely not Spotify, developed using Cloud Computing. A premium music streaming web application with an ASP.NET Core Web API backend and React + TypeScript + Vite frontend.

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

   The Spotify-style tab-away mini-player uses browser APIs (`documentPictureInPicture` and Media Session). It does not require an npm dependency, but it works best in Chrome or Edge on `localhost`/HTTPS.

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
Once both servers are running, log in with the following default developer account:
* **Email:** `alex@example.com`
* **Password:** `Password123!`

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
