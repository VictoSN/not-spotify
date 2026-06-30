# not-spotify Frontend

React + TypeScript + Vite user interface for the not-spotify music streaming application.

---

## Getting Started

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

   New runtime dependencies are already in `package.json` and are pulled in by `npm install`; no extra commands are needed.

   * `@fontsource-variable/montserrat` - self-hosted Montserrat, a free stand-in for Spotify's proprietary Circular typeface.
   * `node-vibrant` - extracts dominant colours from cover art for Spotify-style gradient hues.

   Browser API features do not need npm packages:

   * The tab-away mini-player uses Chrome/Edge's `documentPictureInPicture` API and the Media Session API. It works best on `localhost` or HTTPS. Unsupported browsers simply keep normal in-app playback.
   * Keep the dominant-colour import as `import { Vibrant } from 'node-vibrant/browser'`. Changing it to `import Vibrant from 'node-vibrant'` can pull the wrong package entry for the browser build.

---

### 3. Environment Configurations

Open `frontend/.env.development` to configure how the frontend interacts with data:

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

Because authentication cookies are `Secure`, you must use the HTTPS backend URL.

---

### 4. Running the Client

Start the development server:

```bash
npm run dev
```

The local development client will be available at `http://localhost:5173`.

Account, Support, and Download are independent dark-only sites. Local links open
`account.localhost:5173`, `support.localhost:5173`, and
`download.localhost:5173` in new tabs; no hosts-file entries are required.

For a deployed app, point those three DNS names (and TLS certificates) at the
same frontend build. Set `VITE_ROOT_DOMAIN=example.com` for their shared root.
If the music app itself uses a prefixed host, also set
`VITE_MAIN_APP_ORIGIN=https://app.example.com`; otherwise the root domain is
used as the main origin. The API expands each configured frontend/CORS origin
to the three corresponding subdomains.

Authentication is shared through the API's secure HTTP-only refresh cookie;
access tokens remain tab-local. A main-origin relay and the authenticated
SignalR connection propagate login/logout changes, so logging out on any one
site signs the same browser session out on every open site.

---

### Available Scripts

In the frontend directory, you can run:

* `npm run dev` - starts the Vite development server with Hot Module Replacement.
* `npm run build` - compiles the TypeScript code and bundles assets for production.
* `npm run lint` - runs ESLint to check for code issues.
* `npm run preview` - locally previews the built production bundle.

---

### Seed Login Credentials (When VITE_USE_MOCK=false)

Log in with the default development user:

* **Email:** `alex@example.com`
* **Password:** `Password123!`
