# PROJECT_STATUS.md
Single source of truth for feature/bug status. Every session reads this FIRST and updates it LAST.

Last updated: 2026-06-14 (Tier 1 hardening validated; Queue/a11y pass completed)

> **Companion docs:** [README.md](README.md) (setup) · [FEATURE_GAP_REPORT.md](FEATURE_GAP_REPORT.md) (vs competitors + roadmap) · [CONTEXT.md](CONTEXT.md) (architecture).

---

## ✅ COMPLETED FEATURES (verified — do not re-implement)

- **Accounts/billing:** DB-backed accounts; free vs premium (free = forced shuffle, gated server+client); Stripe checkout/subscribe/cancel; premium single + ZIP downloads; promo/free-trial code.
- **Player:** play/pause/skip/seek/shuffle/repeat/volume/mute; Now Playing panel (resizable) w/ queue + premium drag-reorder, artist info, credits; dedicated `/queue` Up-next view with keyboard move/remove controls; PiP + OS MediaSession; sleep timer; playback speed; play-next; autoplay radio-lite; keyboard shortcuts + `?` help; 1–5 star ratings; mobile mini-player + responsive UI.
- **Discovery/search:** trending / most-liked / for-you / new / recents; Weekly Top 50 (`/charts`); search-by-lyrics; song radio; "Fans also like"; Daily Mixes; genre browse; recent searches; voice search.
- **Library/playlists:** CRUD playlists w/ visibility (public/friends/private, server-enforced); collaborative playlists + invites; JSON export/import; library + track sorting; cover mosaic; liked songs; follow artists.
- **Social:** friends (add/accept/decline/unfriend, suggestions, mutual counts); profiles + live presence (SignalR); Friend Activity rail; 1:1 chat (read receipts, unread badges); notifications center (bell + live SignalR + 20s poll; producers for friend events + admin approve/reject); **Blend** (`/friends/{id}/blend`); **Listen-along/Jam** (`/hubs/session`); share on playlist + artist.
- **Personalization:** light/dark theme; dynamic cover-art theming; listening stats / mini-Wrapped (`/stats`); compact library layout.
- **Lyrics:** non-AI transcription (LRCLIB → Lyrics.ovh); karaoke synced lyrics.
- **Artist/admin:** artist dashboard (albums/tracks CRUD, reorder, edit, resubmit, profile, verified badge, auto-lyrics, charts); artist application → admin review; admin dashboard/CRUD/approval queue/audit/revoke; dedicated `/adminlogin` guard.
- **Platform:** **PWA** ✅ — installable (manifest + maskable icons), offline app shell + asset cache via service worker, in-app install prompt. **Offline audio** ✅ — premium "Save for offline" caches full tracks; SW serves them Range-aware (seeking works offline) at `/_offline-audio`; managed in Settings → Offline downloads.
- **Hardening/polish:** dead settings toggles (`language`, `quality`, `normalize`, `crossfade`) now **disabled with a "Coming soon" badge** instead of lying; global **toast** system; shared accessible **`ConfirmDialog`** + remaining custom modals on Headless UI Dialog; fixed-window **rate limiting** on auth/chat; unified server-side track/album/playlist downloads via `AudioDownloadService`.

---

## 🔄 NEXT UP / UNFINISHED (ordered by value; see FEATURE_GAP_REPORT §3)

**Needs a DB migration (⚠️ coordinate first — shared Supabase migrations have conflicted before; never use `--no-build`):**
- [ ] **Smart playlists** — iTunes-style rules (genre/rating/play-count/date-added); pairs with star ratings.
- [ ] **Waveform + timed comments** — ffmpeg peaks at upload + timestamp-pinned comments (SoundCloud signature).
- [ ] **Asymmetric follows + public profiles** — one-way follows, follower/following counts, public "top tracks".

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

**Previous sessions summary (through 2026-06-14):** Built the full feature set above across 3 Pro accounts, including karaoke lyrics, dynamic theming, social/chat/notifications, Blend, Listen-along/Jam, discovery/statistics features, admin/artist dashboards, PWA, and premium **offline audio** with byte-verified Range replay. Tier 1 hardening completed honest disabled settings, global toasts, a shared accessible ConfirmDialog replacing all 9 native confirms, and fixed-window rate limiting for `/auth/*` + chat-send with visible 429 errors. Fixed bugs 1–11. **Migration lesson:** never pass `--no-build` to EF migration commands; backend startup auto-migrates the shared Supabase DB. Verify PWA/offline via production build/preview, not Vite dev.

### 2026-06-14 — Tier 1 hardening — validation, Queue, a11y
**Completed this session — no migration; DB untouched:**
- Finished prior carry-over validation: `dotnet restore`, `dotnet build --no-restore`, and `npm.cmd run build` all pass. Fixed the one backend build break by restoring `IStorageService` injection in `PlaylistsController` for playlist cover uploads/deletes.
- Added dedicated `/queue` view with Now playing, Up next, recent history, desktop player-bar link, mobile nav link, premium drag reorder, and keyboard move/remove controls.
- Moved `AuthPromptModal`, `EditProfileModal`, and `InviteCollaboratorModal` onto Headless UI Dialog; invite errors now toast; playlist shuffle has an aria-label; touched hook lint in auth prompt/playlist is clean.
- Validation: focused ESLint ✅; production frontend build ✅ (same SignalR/Rolldown annotation + chunk-size warnings); backend build ✅. Browser tool was unavailable; `vite preview` starts in foreground, but background preview probing could not be kept alive in this sandbox.

**Still incomplete:** `frontend/node_modules/.tmp/tsconfig.app.tsbuildinfo` is a generated cache file still dirty because the final `git restore` escalation hit the usage gate. Restore/ignore it once usage resets. Optional visual smoke `/queue` in browser. If still present, leftover preview-attempt PIDs `10936`, `42804`, `45656` can be stopped after usage resets.

**Notes for next session:** Tier 1 hardening is otherwise complete. Next work should follow the remaining Next Up order; coordinate before DB-migration items.

### 2026-06-14 — Tier 1 hardening — unified downloads
**Implemented this session — backend + frontend, no migration; validation still incomplete:**
- Added `AudioDownloadService`, shared by album ZIP, playlist ZIP, and new `GET /tracks/{id}/download`. It reads configured storage directly first and falls back to legacy absolute URLs, preserving extension/content type.
- Track endpoint is authenticated: Premium listeners may download approved tracks; admins and the owning artist may download managed tracks. CORS exposes `Content-Disposition`.
- Replaced every direct `audioUrl` download anchor in track detail/menu, artist dashboard, and admin track views with `trackService.download()`. Blob JSON errors surface through toasts; static search confirms no direct audio download anchors remain.
- **Shared files touched:** `Program.cs`, track/album/playlist controllers, storage service docs, track service/menu/detail, artist dashboard, and Account 2 admin album/track pages.
- Validation: frontend TypeScript no-emit ✅; focused track service/menu ESLint ✅; static direct-anchor and duplicate-helper searches ✅; diff checks ✅. Admin/detail lint reports only pre-existing effect-state and missing `jsx-a11y` rule issues. **Still incomplete:** backend restore/build and production frontend build were blocked by the environment usage gate; API was not started and the DB was untouched.

**Notes for next session:** Remaining Tier 1 is frontend a11y audit plus dedicated Queue/Up-next. First rerun `dotnet restore && dotnet build --no-restore` and `npm run build` when the usage gate resets, then proceed. ConfirmDialog already covers confirmation focus/Esc; use `notify` for remaining user-facing silent catches.

<!-- New entries go above this line -->
