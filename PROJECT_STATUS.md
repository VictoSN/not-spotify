# PROJECT_STATUS.md
Single source of truth for feature/bug status. Every session reads this FIRST and updates it LAST.

Last updated: 2026-06-14 (Tier 1 hardening — dead toggles hidden + global toasts)

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
- **Hardening/polish:** dead settings toggles (`language`, `quality`, `normalize`, `crossfade`) now **disabled with a "Coming soon" badge** instead of lying; global **toast** system (sonner, theme-aware) surfacing previously-silent failures (share, add/remove-playlist, offline save/remove).

---

## 🔄 NEXT UP / UNFINISHED (ordered by value; see FEATURE_GAP_REPORT §3)

**Needs a DB migration (⚠️ coordinate first — shared Supabase migrations have conflicted before; never use `--no-build`):**
- [ ] **Smart playlists** — iTunes-style rules (genre/rating/play-count/date-added); pairs with star ratings.
- [ ] **Waveform + timed comments** — ffmpeg peaks at upload + timestamp-pinned comments (SoundCloud signature).
- [ ] **Asymmetric follows + public profiles** — one-way follows, follower/following counts, public "top tracks".

**Tier 1 hardening — remaining (do before any Tier 3; mostly backend, needs the backend running to verify):**
- [ ] **Rate limiting** on `/auth/*` + chat-send (ASP.NET `AddRateLimiter`, fixed-window). *Backend — can't runtime-verify without booting the backend (auto-migrates shared DB).*
- [ ] **`ConfirmDialog`** to replace native `confirm()` on admin destructive actions. *Touches Account 2 admin pages — coordinate.*
- [ ] **Unify single-track download** with the album/playlist ZIP server path (currently diverging). *Backend.*
- [ ] A11y pass (icon-button aria-labels, modal focus traps/Esc) + dedicated **Queue/Up-next** view (data already in player store). *Frontend.*

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

**Previous sessions summary (through 2026-06-14):** Built out the full feature set above across 3 Pro accounts. Highlights: lyrics pipeline + karaoke synced lyrics; dynamic cover-art theming + friend activity feed; 12+ quick-wins (sleep timer, speed, play-next, shortcuts, charts, lyrics search, library/track sorting, JSON export/import); listening stats, song radio, daily mixes, "fans also like", voice search; dedicated `/adminlogin` + guard; pro dashboards (AreaChart); notifications center (`AddNotifications` migration — applied to shared DB); backlog burndown (share, admin-decision notifications, Blend); **Listen-along/Jam** (`SessionHub` at `/hubs/session`); **PWA** (installable manifest + maskable icons, offline app-shell SW, PROD-only registration, install prompt; icons generated by `scripts/generate-icons.mjs`). Fixed bugs 1–11. **Migration lesson:** never pass `--no-build` to `ef migrations add/remove`; hubs read the in-memory access token so sockets 401 after the 15-min token lifetime until an API call refreshes. **Verify PWA/offline via `npm run build` + `vite preview` (`frontend-preview` launch config), not `npm run dev` (SW is PROD-gated).** Inert test accounts remain in the shared DB (`notify-test*@example.com`, `fable-test@example.com`, all `Password123!`); a standing alex↔testing2 friendship was left for blend testing.

### 2026-06-14 — Account 3 — Tier 1 hardening (dead toggles + toasts)
**Completed (this session) — frontend-only, no migration:**
- **Dead settings toggles hidden honestly.** `language`, `streamingQuality`, `normalizeVolume`, `crossfade` in `SettingsPage` were live switches wired to nothing — now rendered **disabled with a "Coming soon" badge** (new `Switch`/`Select` `disabled` support + `ComingSoon` pill + `Row` `badge` slot). Live prefs (compact library, autoplay, now-playing, theme) untouched. Addresses gap report §5.1 / Tier 1 #1.
- **Global toast system** (Tier 1 #5 / §5.2). Wired `sonner` (already a dep, previously unused): theme-aware `AppToaster` mounted in `App.tsx` (bottom-center, above the player bar) + `utils/toast.ts` `notify` wrapper. Converted previously-**silent** user-facing failures to toasts: track-menu **share** (was a silent clipboard copy → "Link copied"), **add/remove-playlist** (success / "Already in this playlist" on 409 / error), **offline save/remove** (replaced the inline error with success+error toasts).
- **Verified** on the dev server via a **temporary** `/dev/settings` harness (added, screenshotted, then **removed** — confirmed no leftover refs): 4 "Coming soon" badges + 4 disabled controls render correctly while live toggles stay interactive; a fired toast renders with correct text/theme. Production build + eslint clean on all touched files; PROD `vite preview` shows the toast outlet mounts with no console errors.

### 2026-06-14 — Account 3 — Offline audio playback (save-for-offline)
**Completed (this session) — frontend-only, no migration:**
- **Save tracks for offline playback**, building on last session's PWA. New `services/offlineAudio.ts`: premium "Save for offline" fetches the full audio file and stores it in a persistent `ns-offline-audio` Cache Storage bucket + a `localStorage` index; `removeTrackOffline`/`clearOffline`/`listOffline`/`offlineTotalBytes`. The SW (`public/sw.js`) gained a **Range-aware** handler for the dedicated same-origin path `/_offline-audio?id=<trackId>`: it reconstructs 206 partials from the cached full body so **seeking works offline**, returns 404 for unsaved ids, and `ns-offline-audio` is excluded from activate-cleanup so downloads survive SW updates.
- **Integration kept surgical:** `audioEngine` resolves the playback src via `resolvePlaybackSrc(track)` (offline URL only when saved **and** a SW controls the page; else the normal network URL) — **normal streaming playback is completely untouched** (the SW only ever intercepts `/_offline-audio`). UI: a premium "Save for offline / Downloaded — remove" item in the track ⋯ menu (`useOfflineTrack` hook) + a **Settings → Offline downloads** panel (`components/settings/OfflineDownloads.tsx`) listing saved tracks with sizes, per-track remove, and clear-all.
- **Verified** against a production build + `vite preview`: SW Range reconstruction is **byte-exact** — full request → 200 w/ `Accept-Ranges`; `bytes=100-199` → 206 `Content-Range: bytes 100-199/1000` w/ exact bytes; open-ended `bytes=990-` → last 10 bytes; unsaved id → 404; normal assets still 200; app renders; no console errors. tsc + eslint clean on touched files.
- **Not verifiable here / next:** the full "save a real track → go offline → play" round-trip needs a logged-in **premium** session + real audio + the media host allowing **CORS** on the save fetch (Supabase public bucket / backend static). The backend wasn't started (it auto-migrates the shared DB on boot). If saves fail in practice, check CORS on the audio host first.

**Notes for next session:** Remaining **Tier 1 hardening** is mostly backend (rate limiting, unify download path) or Account 2 scope (`ConfirmDialog` in admin) — needs the backend running to verify, which I avoided (it auto-migrates the shared DB on boot). Finish Tier 1 before any Tier 3. The toast system (`utils/toast.ts` `notify`) is now available to surface any remaining silent `catch {}` blocks across stores/pages. Next no-migration feature is crossfade/gapless (audio-engine rework, verify audibly — can't be checked headless).

<!-- New entries go above this line -->
