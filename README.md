# 🎵 not-spotify

Definitely not Spotify, developed using Cloud Computing. A premium music streaming web application with an ASP.NET Core Web API backend and React + TypeScript + Vite frontend.

---

## 🚀 Getting Started

To get both the frontend and backend running locally on your machine, follow these instructions.

### 1. Prerequisites
Ensure you have the following installed:
* [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
* [Node.js (LTS)](https://nodejs.org/)
* [PostgreSQL](https://www.postgresql.org/)

---

### 2. Backend Setup & Run

1. Open a terminal and navigate to the backend project API directory:
   ```bash
   cd backend/src/NotSpotify.Api
   ```

2. Configure your local database connection and secrets:
   ```bash
   dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=notspotify;Username=postgres;Password=YOUR_POSTGRES_PASSWORD"
   dotnet user-secrets set "Jwt:SigningKey" "a-very-long-random-string-at-least-32-chars-long"
   ```

3. Trust the local HTTPS development certificate:
   ```bash
   dotnet dev-certs https --trust
   ```

4. Apply the database schema and seed the initial mock data:
   ```bash
   dotnet ef database update
   ```
   *(If `dotnet-ef` is not installed, run `dotnet tool install --global dotnet-ef --version 8.*` first).*

5. Start the backend:
   ```bash
   dotnet run
   ```
   *The API will compile and run on **`https://localhost:7045`** (and Swagger UI will be available at [https://localhost:7045/swagger](https://localhost:7045/swagger)).*

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
