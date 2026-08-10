# Auth: Registration Verification, Password Recovery & Social Login

Three account-recovery / login features, all wired into the existing JWT + refresh-cookie auth. This doc covers how each works and what (if anything) you must configure.

> **Restart the backend after pulling these changes** (`dotnet run`) — the new endpoints (`/auth/change-password`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/external/*`) don't exist in an older running instance.

---

## Registration email verification

Password signup is a two-step flow. `POST /auth/signup` creates an inactive account and emails a six-digit OTP; `POST /auth/signup/verify` confirms the email and only then issues access/refresh tokens. Codes expire after 10 minutes, are limited to five attempts, and can be resent after 60 seconds through `POST /auth/signup/resend`.

Configure SMTP with user-secrets or environment variables in production:

```powershell
dotnet user-secrets set "Email:Smtp:Host" "smtp.example.com"
dotnet user-secrets set "Email:Smtp:Port" "587"
dotnet user-secrets set "Email:Smtp:EnableSsl" "true"
dotnet user-secrets set "Email:Smtp:FromAddress" "accounts@example.com"
dotnet user-secrets set "Email:Smtp:FromName" "not-spotify"
dotnet user-secrets set "Email:Smtp:Username" "accounts@example.com"
dotnet user-secrets set "Email:Smtp:Password" "your-smtp-password"
```

Development without SMTP logs and displays the code so the flow remains testable. Production signup fails closed if SMTP is missing; it never exposes the OTP in the API response.

---

## 1. Change password — works out of the box

- **Endpoint:** `POST /auth/change-password` (auth required) — body `{ currentPassword, newPassword }`.
- Uses ASP.NET Identity `ChangePasswordAsync` (verifies the current password; 8-char minimum, same as signup).
- **On success it revokes every refresh token for the user, then issues a fresh session for the current device** — so other devices/tabs are signed out, but the tab you used stays logged in (the response returns a new `{ accessToken, user }` which the client swaps in).
- **Where:** Account → *Security and privacy* → **Change password** opens a modal ([`ChangePasswordModal.tsx`](../frontend/src/components/settings/ChangePasswordModal.tsx)).

No configuration needed.

---

## 2. Reset password ("forgot password") — emails a code, same SMTP as signup

- **Endpoints:** `POST /auth/forgot-password` `{ email }` → `POST /auth/reset-password` `{ email, code, newPassword }`.
- `forgot-password` generates a cryptographically random **6-digit code**, stores only an **HMAC-SHA256 hash** (never the plaintext), and emails the code (plus a one-click `/reset-password?email=&code=` link) through the same SMTP mailer as signup verification. Codes expire after **10 minutes**, are **single-use**, and a fresh one can be requested after a **60-second** cooldown ([`PasswordResetService`](../backend/src/NotSpotify.Api/Services/PasswordResetService.cs)).
- `reset-password` validates + consumes the code, then uses Identity's `GeneratePasswordResetTokenAsync` / `ResetPasswordAsync` to set the new password.
- **Anti-enumeration:** `forgot-password` always returns the same generic message whether or not the email exists, and only issues/emails a code for a real account.
- **A successful reset revokes all of the user's sessions** (a reset means "I lost access").
- **Where:** login page → **Forgot your password?** → `/forgot-password` → email → "Check your email" → `/reset-password?email=&code=`.

### Configuration
Uses the **same `Email:Smtp:*` settings as registration verification** (see the top of this doc). No extra configuration.

- **In Development** without SMTP, `forgot-password` logs the code and also returns it as `developmentCode` (with a dev reset link) so the flow is testable without a mailer — the forgot-password page shows the code and an "Enter reset code" button.
- **In Production**, the code is **never** returned or logged; it's delivered only by email. If SMTP is unconfigured, the endpoint fails closed rather than leaking the code.

---

## 3. Google login (OAuth) — implemented, gated until you add credentials

Implemented as a **manual OAuth 2.0 code flow over `HttpClient`** (no extra NuGet package, no build risk). It's available only when `Authentication:Google:ClientId` + `ClientSecret` are set and the provider is enabled under **Admin → Dev Tools → Social login providers**. The login page checks `GET /auth/external/providers` before showing the button. Facebook/Apple remain unavailable until separately configured.

### Flow
1. Google button → `GET /auth/external/google` → sets a short-lived CSRF `state` cookie, redirects to Google.
2. Google → `GET /auth/external/google/callback?code&state` → backend validates `state`, exchanges the code for tokens, reads the user's email/name from Google's userinfo endpoint.
3. **Find-or-create** an `ApplicationUser` by email (new accounts are created password-less, `EmailConfirmed = true`, `Country = "US"`).
4. Backend sets the `rt` refresh cookie and redirects to `${FrontendUrl}/?oauth=google`. The SPA's normal hydrate-from-cookie flow then logs the user in — **no access-token handoff in the URL**.

### Setup (Google Cloud Console)
1. Open the [Google Auth Platform Audience page](https://console.cloud.google.com/auth/audience), select the project, and set **User type** to **External**. For local testing, keep the publishing status as **Testing** and add your Google account as a test user. If Google has locked the audience as Internal, create a new Google Cloud project and configure that project as External.
2. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) and choose **Create credentials → OAuth client ID → Web application**.
3. **Authorized redirect URI** — must match exactly:
   ```
   https://localhost:7045/auth/external/google/callback
   ```
4. Copy the **Client ID** and **Client secret** immediately after creating the client. Google may only show the full secret once.

### Backend user-secrets (from `backend/src/NotSpotify.Api`)
```powershell
dotnet user-secrets set "Authentication:Google:ClientId" "xxxx.apps.googleusercontent.com"
dotnet user-secrets set "Authentication:Google:ClientSecret" "<google-client-secret>"
dotnet user-secrets set "Authentication:Google:RedirectUri" "https://localhost:7045/auth/external/google/callback"
# Optional — single fallback frontend URL:
dotnet user-secrets set "App:FrontendUrl" "http://localhost:5173"
```
Restart the backend, sign in as `alex@example.com`, and enable Google under **Admin → Dev Tools → Social login providers** after the provider reports **credentials configured**.

If Google redirects back but the token request returns HTTP `401`, the client ID and client secret do not belong to the same OAuth client. Create or rotate the secret in Google Cloud and update the user-secret, then restart the backend.

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
4. Request/use the `email` and `public_profile` permissions. Facebook accounts that do not expose an email cannot be auto-registered by this app.

### Backend user-secrets (from `backend/src/NotSpotify.Api`)
```powershell
dotnet user-secrets set "Authentication:Facebook:AppId" "your-facebook-app-id"
dotnet user-secrets set "Authentication:Facebook:AppSecret" "your-facebook-app-secret"
dotnet user-secrets set "Authentication:Facebook:RedirectUri" "https://localhost:7045/auth/external/facebook/callback"
```

Restart the backend, then enable Facebook in Admin → Dev Tools → Social login providers. The Facebook button only appears when both credentials and the admin toggle are enabled.

### Notes
- The `state` cookie and `rt` cookie use `SameSite=None; Secure`, so OAuth works across the api↔frontend origin hop (matches the existing refresh-cookie setup). HTTPS is required (you already trust the dev cert).
- The local frontend and API both use HTTPS-compatible localhost origins; trust the local development certificate before testing OAuth.
- To add another provider (e.g. GitHub), copy the two Google actions, swap the authorize/token/userinfo URLs, and add a flag to `ExternalProvidersResponse`.

---

## Support articles these unblock
With these shipped, the support center can document them as **real** instead of removing them (see [`support-content-roadmap.md`](support-content-roadmap.md) §1):
- "Reset or change your password" ✅
- "Change your password" (from Account) ✅
- "Log in with Google" ✅
- "Log in with Facebook" ✅ once Meta credentials are configured
