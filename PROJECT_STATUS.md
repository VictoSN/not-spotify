# PROJECT_STATUS.md
Single source of truth for feature/bug status. Every session reads this FIRST and updates it LAST.

Last updated: 2026-06-14 (PWA — installable app + offline shell)

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
- **Platform:** **PWA** ✅ — installable (manifest + maskable icons), offline app shell + asset cache via service worker, in-app install prompt.

---

## 🔄 NEXT UP / UNFINISHED (ordered by value; see FEATURE_GAP_REPORT §3)

**Needs a DB migration (⚠️ coordinate first — shared Supabase migrations have conflicted before; never use `--no-build`):**
- [ ] **Smart playlists** — iTunes-style rules (genre/rating/play-count/date-added); pairs with star ratings.
- [ ] **Waveform + timed comments** — ffmpeg peaks at upload + timestamp-pinned comments (SoundCloud signature).
- [ ] **Asymmetric follows + public profiles** — one-way follows, follower/following counts, public "top tracks".

**No migration (frontend / query only):**
- [ ] **Crossfade + gapless** (Web Audio) — wires the dead `crossfade` toggle; unlocks EQ. *Audio-engine rework; verify audibly.*
- [ ] **Offline audio playback** (PWA follow-up) — "save for offline" store caching full audio files + HTTP Range replay (deliberately out of scope of the current SW, which skips audio to avoid breaking seeking).
- [ ] Wire remaining **dead settings toggles**: `crossfade`, `normalize`, `quality`.
- [ ] **Account 2 — Admin restructure:** dedicated sidebar/topbar admin-panel layout (the `/adminlogin` guard is ✅; layout shell migration still open).

**Stretch:** [ ] Desktop wrapper (Tauri) — now nearly free on top of the PWA.

---

## 💡 FUTURE WORK BACKLOG (full reasoning in FEATURE_GAP_REPORT)
- **Audio:** Equalizer (Web Audio); volume normalization (wires `normalize`); PiP FF/rewind (needs seekable PiP rendering).
- **Discovery:** Discover Weekly (collaborative filtering over PlayHistories); editorial/featured playlists; mood/activity tagging.
- **Social:** share-to-chat rich cards.
- **Platform:** embeddable iframe mini-player; hardening (rate-limit auth/chat, global error toast, thin test suite).
- **Large subsystems (each its own session + migration; designed in gap report §6):** RBAC (master admin + roles); location-based discovery ("Popular in <country>"); ads engine (inventory/cadence/scheduling/targeting); podcasts + music videos.

## ❌ NOT REALISTIC (no-paid-services constraint)
Licensed major-label catalogue, spatial audio, real ad-network monetization / royalties at scale, native iOS/Android + CarPlay/Auto/TV/Watch, concert/tour data, Shazam-grade recognition.

---

## 🐛 CURRENT BUGS
None open — bugs 1–11 all fixed (see git history). **Known minor cosmetic issues (low priority):** PiP FF/rewind buttons inert (canvas-stream video isn't seekable); React "empty string passed to `src`" warning on Home (blank seed `coverUrl`); SignalR "stopped during negotiation" burst on reload (reconnects fine); in-memory access token → brief logout flash on hard reload (expected).

---

## 📝 SESSION LOG (most recent on top; keep ≤2 entries + summary)

**Previous sessions summary (through 2026-06-14):** Built out the full feature set above across 3 Pro accounts. Highlights: lyrics pipeline + karaoke synced lyrics; dynamic cover-art theming + friend activity feed; 12+ quick-wins (sleep timer, speed, play-next, shortcuts, charts, lyrics search, library/track sorting, JSON export/import); listening stats, song radio, daily mixes, "fans also like", voice search; dedicated `/adminlogin` + guard; pro dashboards (AreaChart); notifications center (`AddNotifications` migration — applied to shared DB); backlog burndown (share, admin-decision notifications, Blend). Fixed bugs 1–11 (downloads, album/track delete, chat badge, artist-dashboard nesting, lyrics-nav overlay, PiP/Edge handlers, voice-search punctuation). **Migration lesson:** never pass `--no-build` to `ef migrations add/remove`. Inert test accounts remain in the shared DB (`notify-test*@example.com`, `fable-test@example.com`, all `Password123!`); a standing alex↔testing2 friendship was left for blend testing.

### 2026-06-14 — Account 3 — PWA (installable + offline shell)
**Completed (this session):**
- **PWA, frontend-only, no migration.** New `public/manifest.webmanifest` (standalone, theme `#000000`, 192/512 + maskable icons, 3 app shortcuts) linked from `index.html` with theme-color + apple-touch-icon meta. New `public/sw.js` service worker: precaches the app shell, network-first navigations with offline fallback to the cached shell, stale-while-revalidate for same-origin assets + cover art. Registered via `src/utils/registerSW.ts` (**PROD-only** — never in dev, so Vite HMR is untouched). Dismissible in-app `InstallPrompt` (`beforeinstallprompt`) mounted in `App.tsx`.
- **Icons generated from scratch** (no image libs): `scripts/generate-icons.mjs` rasterizes the brand beamed-eighth-note and PNG-encodes via zlib → `public/icons/{icon-192,icon-512,icon-maskable-512}.png`. Re-run if brand colors change.
- **Verified** against a production build + `vite preview` (`frontend-preview` launch config) in-browser: manifest parses (standalone, 3 icons, 3 shortcuts), SW **activated & controlling**, shell cache holds all 6 precache URLs + `/index.html` (offline shell available), asset cache populated with hashed JS/CSS, icons serve `image/png` 200, no console errors.
- **Scoped out (logged in NEXT UP):** true offline *audio* playback — audio uses HTTP Range, whose 206 partials break seeking if naively cached; needs a dedicated "save for offline" full-file store. The SW deliberately skips audio + API.

**Notes for next session:** PWA is installable on Chromium (Chrome/Edge) over https/localhost; Safari/Firefox get the manifest but no `beforeinstallprompt` (expected). Desktop wrapper (Tauri) is now nearly free. Next no-migration feature is crossfade/gapless (audio-engine rework, verify audibly — can't be checked in this headless harness).

### 2026-06-14 — Account 3 — Listen-along / Jam ("play together")
**Completed (afcdfe5 backend, a8c6ce1 frontend):** `SessionHub` (`/hubs/session`) in-memory relay — host `StartSession` opens `jam-{hostId}`, guests `JoinSession`, host `Sync` relays full playback state to others + participant-count/`JamEnded`/`JamJoined` + disconnect cleanup. Frontend `jamStore` + `useJamSocket` (host broadcasts on change + every 2s; guest mirrors w/ drift>1.5s + latency correction; re-registers on reconnect), `JamBar` banner, player-bar host toggle, "Listen along" on a friend's profile. **Verified** via two raw SignalR connections (host `Sync` → guest `JamSync` exact track/position, `participants=2`) + app host flow. No migration. **Caveat:** hub `accessTokenFactory` reads the in-memory access token, so a tab left past the 15-min token lifetime 401s until an API call refreshes — pre-existing across all hubs.

<!-- New entries go above this line -->
