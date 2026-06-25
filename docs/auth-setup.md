# Auth: Change Password, Reset Password & Social Login

Three account-recovery / login features, all wired into the existing JWT + refresh-cookie auth. This doc covers how each works and what (if anything) you must configure.

> **Restart the backend after pulling these changes** (`dotnet run`) — the new endpoints (`/auth/change-password`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/external/*`) don't exist in an older running instance.

---

## 1. Change password — works out of the box

- **Endpoint:** `POST /auth/change-password` (auth required) — body `{ currentPassword, newPassword }`.
- Uses ASP.NET Identity `ChangePasswordAsync` (verifies the current password; 8-char minimum, same as signup).
- **On success it revokes every refresh token for the user, then issues a fresh session for the current device** — so other devices/tabs are signed out, but the tab you used stays logged in (the response returns a new `{ accessToken, user }` which the client swaps in).
- **Where:** Account → *Security and privacy* → **Change password** opens a modal ([`ChangePasswordModal.tsx`](../frontend/src/components/settings/ChangePasswordModal.tsx)).

No configuration needed.

---

## 2. Reset password ("forgot password") — works in dev, needs a mailer for prod

- **Endpoints:** `POST /auth/forgot-password` `{ email }` → `POST /auth/reset-password` `{ email, token, newPassword }`.
- Uses Identity's `GeneratePasswordResetTokenAsync` / `ResetPasswordAsync`.
- **Anti-enumeration:** `forgot-password` always returns the same generic message whether or not the email exists.
- **A successful reset revokes all of the user's sessions** (a reset means "I lost access").
- **Where:** login page → **Forgot your password?** → `/forgot-password` → email → `/reset-password?email=&token=`.

### The email gap (by design, for now)
There is **no mailer** configured in this project. So:

- **In Development** (`ASPNETCORE_ENVIRONMENT=Development`), `forgot-password` **returns the reset link in the JSON response** and logs it to the console. The forgot-password page shows a clickable "Open reset link →" so the whole flow is testable without email. This is the same "feature degrades gracefully until configured" pattern as Stripe/S3.
- **In Production**, the link is **never** returned or logged. Until you add a mailer, prod users can't self-serve a reset.

### To make it real later
Add an `IEmailSender` (SMTP via `System.Net.Mail`, or SendGrid/SES), inject it into `AuthController`, and in `ForgotPassword` send `resetUrl` by email instead of returning it. Everything else already works.

---

## 3. Google login (OAuth) — implemented, gated until you add credentials

Implemented as a **manual OAuth 2.0 code flow over `HttpClient`** (no extra NuGet package, no build risk). It's **disabled until `Authentication:Google:ClientId` + `ClientSecret` are set** — the login page checks `GET /auth/external/providers` and only lights up the Google button when configured. Facebook/Apple remain "not available" (they need far more setup).

### Flow
1. Google button → `GET /auth/external/google` → sets a short-lived CSRF `state` cookie, redirects to Google.
2. Google → `GET /auth/external/google/callback?code&state` → backend validates `state`, exchanges the code for tokens, reads the user's email/name from Google's userinfo endpoint.
3. **Find-or-create** an `ApplicationUser` by email (new accounts are created password-less, `EmailConfirmed = true`, `Country = "US"`).
4. Backend sets the `rt` refresh cookie and redirects to `${FrontendUrl}/?oauth=google`. The SPA's normal hydrate-from-cookie flow then logs the user in — **no access-token handoff in the URL**.

### Setup (Google Cloud Console)
1. <https://console.cloud.google.com> → create/select a project → **APIs & Services → Credentials**.
2. Configure the **OAuth consent screen** (External, add your email as a test user).
3. **Create credentials → OAuth client ID → Web application.**
4. **Authorized redirect URI** — must match exactly:
   ```
   https://localhost:7045/auth/external/google/callback
   ```
   (For a deployed API, add `https://<your-api-host>/auth/external/google/callback` too.)
5. Copy the **Client ID** and **Client secret**.

### Backend user-secrets (from `backend/src/NotSpotify.Api`)
```powershell
dotnet user-secrets set "Authentication:Google:ClientId" "xxxx.apps.googleusercontent.com"
dotnet user-secrets set "Authentication:Google:ClientSecret" "GOCSPX-xxxx"
# Optional — only if your callback host differs from the request host (e.g. behind a proxy):
dotnet user-secrets set "Authentication:Google:RedirectUri" "https://your-api-host/auth/external/google/callback"
# Optional — single fallback frontend URL:
dotnet user-secrets set "App:FrontendUrl" "http://localhost:5173"
```
Restart the backend. The Google button activates automatically.

### Multiple client ports
The login buttons pass their current `window.location.origin` as `returnUrl`, and the backend only accepts it if it is allowlisted. Add every web/desktop dev origin you use to `App:FrontendUrls` or `Cors:AllowedOrigins`.

Example:
```json
"App": {
  "FrontendUrls": [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:1420"
  ]
}
```

You do **not** need a separate Google/Facebook callback for every frontend port. Provider callbacks still point to the backend, for example `https://localhost:7045/auth/external/google/callback`; the backend then posts/redirects back to the allowed client that started the login.

---

## 4. Facebook login (OAuth) — implemented, gated until you add credentials

Facebook uses the same hosted-provider pattern as Google: the app redirects to Meta/Facebook, the user logs in on Facebook's page, and the backend callback creates or signs in the local Not Spotify user.

### Setup (Meta for Developers)
1. <https://developers.facebook.com/apps/> → create/select an app.
2. Add **Facebook Login** for web.
3. Add this valid OAuth redirect URI:
   ```
   https://localhost:7045/auth/external/facebook/callback
   ```
   For production, also add `https://<your-api-host>/auth/external/facebook/callback`.
4. Request/use the `email` and `public_profile` permissions. Facebook accounts that do not expose an email cannot be auto-registered by this app.

### Backend user-secrets (from `backend/src/NotSpotify.Api`)
```powershell
dotnet user-secrets set "Authentication:Facebook:AppId" "your-facebook-app-id"
dotnet user-secrets set "Authentication:Facebook:AppSecret" "your-facebook-app-secret"
# Optional — only if your callback host differs from the request host:
dotnet user-secrets set "Authentication:Facebook:RedirectUri" "https://your-api-host/auth/external/facebook/callback"
```

Restart the backend, then enable Facebook in Admin → Dev Tools → Social login providers. The Facebook button only appears when both credentials and the admin toggle are enabled.

### Notes
- The `state` cookie and `rt` cookie use `SameSite=None; Secure`, so OAuth works across the api↔frontend origin hop (matches the existing refresh-cookie setup). HTTPS is required (you already trust the dev cert).
- Cross-origin cookie note: if you deploy api and frontend on different subdomains, set the `rt` cookie `Domain=.<domain>` (see [`support-aws-roadmap.md`](support-aws-roadmap.md) Part 2).
- To add another provider (e.g. GitHub), copy the two Google actions, swap the authorize/token/userinfo URLs, and add a flag to `ExternalProvidersResponse`.

---

## Support articles these unblock
With these shipped, the support center can document them as **real** instead of removing them (see [`support-content-roadmap.md`](support-content-roadmap.md) §1):
- "Reset or change your password" ✅
- "Change your password" (from Account) ✅
- "Log in with Google" ✅
- "Log in with Facebook" ✅ once Meta credentials are configured
