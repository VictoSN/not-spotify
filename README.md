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
   dotnet user-secrets set "ConnectionStrings:Postgres" "Host=aws-1-ap-northeast-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.nayirxkfuaiejdmeagbr;Password=YOUR_SUPABASE_PASSWORD;SSL Mode=Require;Trust Server Certificate=true"
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
