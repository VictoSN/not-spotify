# PROJECT_STATUS.md
Single source of truth for feature/bug status. Every session reads this FIRST and updates it LAST.

Last updated: 2026-06-14 (Tier 1 hardening — auth/chat rate limiting)

> **Companion docs:** [README.md](README.md) (setup) · [FEATURE_GAP_REPORT.md](FEATURE_GAP_REPORT.md) (vs competitors + roadmap) · [CONTEXT.md](CONTEXT.md) (architecture).

---

## ✅ COMPLETED FEATURES (verified — do not re-implement)

- **Accounts/billing:** DB-backed accounts; free vs premium (free = forced shuffle, gated server+client); Stripe checkout/subscribe/cancel; premium single + ZIP downloads; promo/free-trial code.
- **Player:** play/pause/skip/seek/shuffle/repeat/volume/mute; Now Playing panel (resizable) w/ queue + premium drag-reorder, artist info, credits; PiP + OS MediaSession; sleep timer; playback speed; play-next; autoplay radio-lite; keyboard shortcuts + `?` help; 1–5 star ratings; mobile mini-player + responsive UI.
- **Discovery/search:** trending / most-liked / for-you / new / recents; Weekly Top 50 (`/charts`); search-by-lyrics; song radio; "Fans also like"; Daily Mixes; genre browse; recent searches; voice search.
- **Library/playlists:** CRUD playlists w/ visibility (public/friends/private, server-enforced); collaborative playlists + invites; JSON export/import; library + track sorting; cover mosaic; liked songs; follow artists.
- **Social:** friends (add/accept/decline/unfriend, suggestions, mutual counts); profiles + live presence (SignalR); Friend Activity rail; 1:1 chat (read receipts, unread badges); notifications center (bell + live SignalR + 20s poll; producers for friend events + admin approve/reject); **Blend** (`/friends/{id}/blend`); **Listen-along/Jam** (`/hubs/session`); share on playlist + artist.
- **Personalization:** light/dark theme; dynamic cover-art theming; listening stats / mini-Wrapped (`/stats`); compact library layout.
- **Lyrics:** non-AI transcription (LRCLIB → Lyrics.ovh); karaoke synced lyrics.
- **Artist/admin:** artist dashboard (albums/tracks CRUD, reorder, edit, resubmit, profile, verified badge, auto-lyrics, charts); artist application → admin review; admin dashboard/CRUD/approval queue/audit/revoke; dedicated `/adminlogin` guard.
- **Platform:** **PWA** ✅ — installable (manifest + maskable icons), offline app shell + asset cache via service worker, in-app install prompt. **Offline audio** ✅ — premium "Save for offline" caches full tracks; SW serves them Range-aware (seeking works offline) at `/_offline-audio`; managed in Settings → Offline downloads.
- **Hardening/polish:** dead settings toggles (`language`, `quality`, `normalize`, `crossfade`) now **disabled with a "Coming soon" badge** instead of lying; global **toast** system (sonner, theme-aware) surfacing previously-silent failures; shared accessible **`ConfirmDialog`** replaces native confirms; fixed-window **rate limiting** protects `/auth/*` (per IP) and chat-send (per user), with JSON 429 + `Retry-After`.

---

## 🔄 NEXT UP / UNFINISHED (ordered by value; see FEATURE_GAP_REPORT §3)

**Needs a DB migration (⚠️ coordinate first — shared Supabase migrations have conflicted before; never use `--no-build`):**
- [ ] **Smart playlists** — iTunes-style rules (genre/rating/play-count/date-added); pairs with star ratings.
- [ ] **Waveform + timed comments** — ffmpeg peaks at upload + timestamp-pinned comments (SoundCloud signature).
- [ ] **Asymmetric follows + public profiles** — one-way follows, follower/following counts, public "top tracks".

**Tier 1 hardening — remaining (do before any Tier 3; mostly backend, needs the backend running to verify):**
- [ ] **Unify single-track download** with the album/playlist ZIP server path (currently diverging). *Backend.*
- [ ] A11y pass (icon-button aria-labels + remaining non-confirm modals; shared ConfirmDialog focus/Esc is ✅) + dedicated **Queue/Up-next** view (data already in player store). *Frontend.*

**No migration (frontend / query only):**
- [ ] **Crossfade + gapless** (Web Audio) — would wire the now-disabled `crossfade` toggle; unlocks EQ. *Audio-engine rework; verify audibly.*
- [ ] **Account 2 — Admin restructure:** dedicated sidebar/topbar admin-panel layout (the `/adminlogin` guard is ✅; layout shell migration still open).

**Stretch:** [ ] Desktop wrapper (Tauri) — now nearly free on top of the PWA.

---

## 💡 FUTURE WORK BACKLOG (full reasoning in FEATURE_GAP_REPORT)
- **Audio:** Equalizer (Web Audio); volume normalization (wires `normalize`); PiP FF/rewind (needs seekable PiP rendering).
- **Discovery:** Discover Weekly (collaborative filtering over PlayHistories); editorial/featured playlists; mood/activity tagging.
- **Social:** share-to-chat rich cards.
- **Platform:** embeddable iframe mini-player; hardening (rate-limit auth/chat, thin test suite).
- **Large subsystems (each its own session + migration; designed in gap report §6):** RBAC (master admin + roles); location-based discovery ("Popular in <country>"); ads engine (inventory/cadence/scheduling/targeting); podcasts + music videos.

## ❌ NOT REALISTIC (no-paid-services constraint)
Licensed major-label catalogue, spatial audio, real ad-network monetization / royalties at scale, native iOS/Android + CarPlay/Auto/TV/Watch, concert/tour data, Shazam-grade recognition.

---

## 🐛 CURRENT BUGS
None open — bugs 1–11 all fixed (see git history). **Known minor cosmetic issues (low priority):** PiP FF/rewind buttons inert (canvas-stream video isn't seekable); React "empty string passed to `src`" warning on Home (blank seed `coverUrl`); SignalR "stopped during negotiation" burst on reload (reconnects fine); in-memory access token → brief logout flash on hard reload (expected).

---

## 📝 SESSION LOG (most recent on top; keep ≤2 entries + summary)

**Previous sessions summary (through 2026-06-14):** Built the full feature set above across 3 Pro accounts, including karaoke lyrics, dynamic theming, social/chat/notifications, Blend, Listen-along/Jam, discovery/statistics features, admin/artist dashboards, PWA, and premium **offline audio** with byte-verified Range replay. Tier 1 hardening started with honest disabled "Coming soon" settings and a global sonner toast system for formerly silent share/playlist/offline failures. Fixed bugs 1–11. **Migration lesson:** never pass `--no-build` to `ef migrations add/remove`; backend startup auto-migrates the shared Supabase DB. Verify PWA/offline via production build/preview, not Vite dev. Inert shared-DB test accounts and the alex↔testing2 friendship remain for testing.

### 2026-06-14 — Tier 1 hardening — auth/chat rate limiting
**Completed (this session) — backend + small frontend error surface, no migration:**
- Added ASP.NET Core fixed-window policies via `AddRateLimiter`: `/auth/*` gets 20 requests/minute per remote IP; `POST /chat/with/{userId}` gets 20 sends/10 seconds per authenticated user (IP fallback). Rejections return HTTP 429, JSON `{ message, retryAfterSeconds }`, and `Retry-After`.
- Added `UseRateLimiter` after routing/authentication; endpoint policies use `[EnableRateLimiting]`. Chat optimistic rollback now shows the server error through the existing toast system instead of silently losing a failed/rate-limited message.
- **Shared files touched:** backend `Program.cs`, `AuthController.cs`, `ChatController.cs`; frontend `chatStore.ts`. No API startup, DB access, or migration.
- Validation: `dotnet restore` + `dotnet build --no-restore` ✅ (0 warnings/errors); frontend TypeScript no-emit + focused chat-store ESLint + production build ✅ (existing SignalR/Rolldown and chunk-size warnings only); diff checks ✅. Runtime 429 testing intentionally skipped because API startup auto-migrates the shared DB.

### 2026-06-14 — Tier 1 hardening — shared ConfirmDialog
**Completed (this session) — frontend-only, no migration:**
- Added a promise-based shared `ConfirmProvider` + `useConfirm` hook using Headless UI Dialog. It provides a focus trap, explicit safe initial focus on Cancel, Esc/backdrop cancellation, focus restoration, danger styling, and resolves superseded/unmounted requests safely.
- Replaced all 9 native `confirm()` calls: subscription cancellation; playlist deletion; artist-dashboard album/track deletion; admin album/artist/track deletion; artist reinstatement; admin play-count reset. Static search confirms no native calls remain.
- **Shared files touched:** `App.tsx`, account/playlist/artist-dashboard pages, and Account 2 admin list/dev pages. No backend or migration changes.
- Validation: TypeScript no-emit ✅; focused ESLint on provider/hook/App ✅; production `npm run build` ✅ (existing SignalR/Rolldown and chunk-size warnings only). Full touched-file lint still reports pre-existing effect-state and missing `jsx-a11y` rule issues. The prior checkpoint visually verified confirm/cancel/Esc outcomes; this resumed environment's in-app browser could not start due a Windows sandbox process error.

**Notes for next session:** Continue Tier 1 before Tier 2/3. Next: unify single-track download with the server-backed album/playlist path. Frontend a11y audit and Queue/Up-next remain. ConfirmDialog already covers confirmation-modal focus/Esc; use `notify` for remaining user-facing silent catches.

<!-- New entries go above this line -->
