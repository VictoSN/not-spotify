# 🎨 not-spotify Frontend

React + TypeScript + Vite user interface for the not-spotify music streaming application.

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed locally:
* [Node.js (LTS)](https://nodejs.org/)

---

### 2. Setup and Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install the package dependencies:
   ```bash
   npm install
   ```
   > **New runtime dependencies (already in `package.json`, pulled in by `npm install` — no extra steps):**
   > - [`@fontsource-variable/montserrat`](https://www.npmjs.com/package/@fontsource-variable/montserrat) — self-hosted **Montserrat**, a free stand-in for Spotify's proprietary "Circular" typeface (no CDN, works offline).
   > - [`node-vibrant`](https://www.npmjs.com/package/node-vibrant) — extracts the dominant colour from cover art to render Spotify-style gradient hues (home header, now-playing panel, album pages).

---

### 3. Environment Configurations

Open [frontend/.env.development](file:///c:/Main/Project/Cloud/not-spotify/frontend/.env.development) to configure how the frontend interacts with data:

#### Running with Mock Data (No Backend Required)
If you want to run the frontend independently using mock service workers:
```env
VITE_USE_MOCK=true
VITE_API_URL=http://localhost:5000
```

#### Running with the Local Backend API (C# PostgreSQL)
If you are running the actual database and .NET Web API:
```env
VITE_USE_MOCK=false
VITE_API_URL=https://localhost:7045
```
*(Note: Because authentication cookies are `Secure`, you must use the HTTPS backend URL).*

---

### 4. Running the Client

Start the development server:
```bash
npm run dev
```
*The local development client will be available at **`http://localhost:5173`**.*

---

### 🛠️ Available Scripts

In the frontend directory, you can run:

* `npm run dev` — Starts the Vite development server with Hot Module Replacement (HMR).
* `npm run build` — Compiles the TypeScript code and bundles the asset files for production.
* `npm run lint` — Runs ESLint to check for code issues.
* `npm run preview` — Locally previews the built production bundle.

---

### 🔑 Seed Login Credentials (When VITE_USE_MOCK=false)
Log in with the default development user:
* **Email:** `alex@example.com`
* **Password:** `Password123!`
