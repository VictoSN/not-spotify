# PROJECT_STATUS.md
Single source of truth for feature/bug status. Every session reads this FIRST and updates it LAST.

Last updated: 2026-06-12 (karaoke synced lyrics — feature complete; see session log for an important DB/environment warning)

---

## ✅ COMPLETED FEATURES (verified working — do not re-implement)
- User accounts with playlists/favorites stored in DB
- Follow artist (with search & sort)
- Extended "more options" menu for songs
- Discovery algorithms: trending, most liked, for you today, new music, recents
- Free tier restrictions: shuffle-only playback, limited customization
- PiP (Picture-in-Picture) player
- Premium queue reordering
- Admin site (basic, pre-restructure)
- Artist dashboard: playlist/song management (edit/delete)
- Artist/admin dashboard statistics (albums/tracks)
- Premium song downloads (single track)
- Friends: add friends
- Friend profiles + online status
- Friends-only playlists
- Chat with friends
- New user promo/free trial
- Admin approval table with sorting
- Mobile/tablet responsive UI
- Admin can revoke artist status
- History log for rejected albums/tracks/applications
- Lyrics transcription (non-AI)
- "Friend Activity" feed (Spotify-style right rail: listening-now + recently-played per friend)
- Dynamic theming from cover art on album/playlist/track pages (incl. fix for broken gradient on album/track)
- Karaoke synced lyrics (Spotify-style: highlight + auto-scroll + seek-on-click; LRC from LRCLIB; plain-text fallback)

---

## 🔄 IN PROGRESS

### Account 1 — Bug Fixes
- [x] Bug 1: Premium playlist/album download doesn't cascade to individual tracks ✅ (2026-06-12, commit 3592fb0d)
- [x] Bug 2: Cannot delete album without deleting tracks first ✅ (2026-06-12, commit 27610f0f)
- [x] Bug 3: Chat notification badge appears even when conversation is open (admin) ✅ (2026-06-12, commit 5b5636e5)
- [ ] UI Bug 4: Artist dashboard tab padding inconsistent — **blocked on repro**: no tab component exists in ArtistDashboardPage (searched current + historical versions); reporter needs to point at the exact screen/element (screenshot)
- [x] UI Bug 5: Header blocks library tooltip ✅ (2026-06-12, commit 0d45c82f)

### Account 2 — Admin Restructure
- [ ] Task 1: Restructure admin site into sidebar/topbar admin panel layout
  - [ ] Inventory existing admin pages/routes (list below once done)
  - [ ] Build layout shell
  - [ ] Migrate: Statistics dashboard
  - [ ] Migrate: Approval table
  - [ ] Migrate: Revoke artist status
  - [ ] Migrate: Rejection history
- [x] Task 2: Move admin login to dedicated `/admin/login` route + guard middleware ✅ (2026-06-12)

### Account 3 — Stretch Features
- [x] Task 1: "What your friends are listening to" feed ✅ (2026-06-12)
- [x] Task 2: Dynamic theming from album art dominant color ✅ (2026-06-12)

---

## ❌ NOT STARTED
- Desktop app wrapper
- "Listen with friends" LIVE synced playback
- Expanded premium customization options
- Full library UI rehaul to match Spotify

---

## 🐛 CURRENT BUGS
| # | Bug | Status | Owner |
|---|-----|--------|-------|
| 1 | Premium download doesn't cascade to individual songs in playlist/album | **Fixed** 2026-06-12 (3592fb0d) | Account 1 |
| 2 | Can't delete album without deleting tracks first | **Fixed** 2026-06-12 (27610f0f) | Account 1 |
| 3 | Notification still appears when chat/messages already open (admin) | **Fixed** 2026-06-12 (5b5636e5) | Account 1 |
| 4 | Artist dashboard tabs have inconsistent padding/width | Open — needs repro/screenshot (no tab component found in code) | Account 1 |
| 5 | Header blocks library tooltip | **Fixed** 2026-06-12 (0d45c82f) | Account 1 |

---

## 📝 SESSION LOG
Each session appends an entry here (most recent on top).

### 2026-06-13 — Account 3 — Dev launcher + CORS fix + "Fans also like"

**Completed (commits 936009c, e539bd1, f0a19b8, 46121a2, c25e29b9):**
- **Dev launcher** — [dev.cmd](dev.cmd) (double-click in Explorer) and [dev.sh](dev.sh) (Git Bash) open three terminals: backend `dotnet run`, `stripe listen --forward-to https://localhost:7045/stripe/webhook`, and frontend `npm run dev`. Both prepend the tool dirs (`C:\Program Files\dotnet`, `C:\nvm4w\nodejs`) to PATH because a double-clicked window inherits Explorer's possibly-stale PATH. `.gitattributes` forces LF on `*.sh`.
- **CORS fix (the "blank home / login network error")** — backend only allowed `http://localhost:5173`; when Vite fell back to **:5174** (5173 was busy) every credentialed request was blocked by CORS. Widened `Cors:AllowedOrigins` in [appsettings.json](backend/src/NotSpotify.Api/appsettings.json) to 5173–5176 + 127.0.0.1 variants. **Requires a backend restart to take effect.**
- **"Fans also like" related artists** — `GET /artists/{id}/related` ranks artists by shared listeners (co-listen frequency) with a shared-genre fallback; carousel added to the artist page (loads independently). Verified: Justin Bieber → 7 related artists rendered.

**Stopped here intentionally (budget).** Remaining medium features each have a real blocker for a safe end-of-session:
- Notifications center, Smart playlists, Waveform+timed comments → all need a **new EF migration**, which has conflicted on the shared Supabase DB before — coordinate before adding.
- Crossfade/gapless → reworks the singleton `audioEngine` and can't be verified audibly in the preview harness; do it when you can listen.

**Notes for next session:**
- If login still fails after pulling: restart the backend so the new CORS origins load. The frontend may open on 5174 — that's now allowed.
- A throwaway `fable-test@example.com` (Password123!) may still exist from earlier feed testing; inert.

---

### 2026-06-13 — Account 3 — Medium-term features: stats page, song radio, playlist import

**Completed (commits 7b5e33a, 020075b, 5c792ce; report update 131ff1f):**
- **Personal listening stats / mini-Wrapped** — `GET /me/stats?days=` aggregates the caller's PlayHistories into totals (plays, est. minutes, unique tracks/artists), top tracks/artists/genres, and a zero-filled per-day series. New `/stats` page (protected) with summary cards, plays-per-day bar chart, top-artist bars, genre pills, top-track list with counts, and a 7/30/365-day toggle. Linked from the user menu. Verified in-browser as alex (78 min, 23 plays, top artist Justin Bieber, range switch works).
- **Song radio** — `GET /tracks/{id}/radio` builds an endless station: co-listen similarity (other listeners' tracks for the seed) × 3 + genre overlap + same-artist boost, seed first, trending pad. "Go to song radio" in the track ⋯ menu loads the station into the queue and plays. Verified: seeded from ALL I CAN TAKE → 15-track station, playback started, queue populated.
- **Playlist import (JSON)** — Library header Import button reads a file exported by the existing Export button, creates a private playlist, matches each entry to a catalog track by title (preferring artist match), and reports N matched. Verified: 2/3 matched (fake track correctly skipped), tracks present after import. **Bug fixed in same change:** `addTrackToPlaylist` was used but not destructured from the store; the per-track try/catch swallowed the ReferenceError so every track silently skipped (0 matched) before the fix.
- Updated FEATURE_GAP_REPORT.md: quick-wins marked done, roadmap re-ordered, and **corrected the false claim that a `Notifications` table exists** — it does not; a notifications center now needs a new entity + migration.

**Notes for next session:**
- All three features verified in the live browser preview against the real DB; test playlists created during verification were deleted afterward (alex's list is back to Night Drive / Evening Chill / R&B Vibes).
- Next medium features per the report: notifications center (needs migration — coordinate on shared DB), smart playlists (needs migration), crossfade (frontend audio-engine rework), "fans also like" (cheap now that the radio co-listen matrix exists).
- `/me/stats` estimates minutes by summing full track durations per play (no partial-play tracking) — fine for a demo metric.

---

### 2026-06-13 — Account 3 — Feature-gap report + 12 quick-win features

**Completed (commits e2c14cd, 278a291, 3932361, f86e7b8):**
- **[FEATURE_GAP_REPORT.md](FEATURE_GAP_REPORT.md)** — page-by-page inventory + gap analysis vs Spotify/Apple Music/SoundCloud/YTM with feasibility (free-only constraint) and a prioritized roadmap. Read it before picking new features.
- **Sleep timer** — moon icon in player bar (15/30/45/60 min), pauses playback when it elapses (checked on the playback clock in `tick`).
- **Playback speed** — cycler button (1 → 1.25 → 1.5 → 2 → 0.75×) wired through audioEngine; reapplied on track change.
- **Play next** — new queue-front insert in the track ⋯ menu (above Add to queue).
- **Autoplay radio-lite** — when the queue runs out (premium, repeat off), playback continues with same-artist top tracks; honors the previously-dead `ns-pref-autoplay` Settings toggle.
- **Keyboard shortcuts** ([useKeyboardShortcuts.ts](frontend/src/hooks/useKeyboardShortcuts.ts)) — Space play/pause, ←/→ seek ±5 s, Ctrl+←/→ skip, Shift+↑/↓ volume, M mute, L like; disabled while typing.
- **Share fix** — track menu Share now copies the *track* URL (was album) and uses the native Web Share sheet on mobile.
- **Search by lyrics** — `/search` returns `tracksByLyrics` (ILIKE over cached lyrics, ≥3 chars, title matches excluded); SearchPage shows a "Found in lyrics" section. Verified: "you" finds ALL I CAN TAKE via lyrics only.
- **Weekly Top 50 charts** — `GET /tracks/charts` (rank + plays-this-week from PlayHistories, padded with all-time tops) + `/charts` page with ranked rows; linked from Home's "Trending now" header.
- **Library sorting** — Recently added / A-Z / Z-A select on the Library page, all four tabs.
- **Playlist JSON export** — free Export button on playlist pages (metadata only, no audio).
- **SectionHeader** gained an optional `subtitle` prop.

**Bug found & fixed:** PlaylistDetailPage crashed (`undefined.map` in findCandidates memo) when the store-mirror effect copied an *unsynced* summary (no `tracks`) over local state — e.g. navigating Library → playlist. Now skipped until `syncPlaylistTracks` has run.

**Notes for next session:**
- All four commits verified in browser (charts page, lyrics search section, speed/sleep/space-shortcut behavior, library sort reorder, export blob).
- Settings toggles still dead: crossfade, normalize, quality, compact, language (autoplay is now live). Candidates per the gap report: stats page/Wrapped, notifications center, crossfade via Web Audio, smart playlists.
- PowerShell 5.1 mangles quotes in `git commit -m` here-strings — use `git commit -F <file>` (ASCII encoding, not utf8 — BOM ends up in the subject).

---

### 2026-06-12 — Karaoke synced lyrics (Spotify-style)

**Completed this session:**
- **Karaoke feature, end to end (commits 50fcd83e, e30772d7, 72db3584, 2aa5287c).** Key insight: LRCLIB (already our primary lyrics source) returns time-synced lyrics in LRC format in its `syncedLyrics` field — the backend DTO parsed it and threw it away. No manual timestamping needed.
  - **Backend:** new `Tracks.SyncedLyrics` column (migration `AddTrackSyncedLyrics`; null = never looked up, `""` = provider has no timed version, so we never re-query per view). `LyricsService.FetchResult` now carries `SyncedLyrics`; synced-only LRCLIB entries derive plain text by stripping LRC tags. `GET /tracks/{id}/lyrics` returns `syncedLyrics` and backfills legacy tracks once on first view. Upload + title-change refetch paths store it too.
  - **Frontend:** [parseLrc.ts](frontend/src/utils/parseLrc.ts) (multi-tag lines, 1–3 digit fractions, ♪ for instrumental gaps; <2 timed lines → fallback). [LyricsView.tsx](frontend/src/components/player/LyricsView.tsx) reworked: karaoke mode (active line bright/bold/slightly scaled, past medium-dim, upcoming dimmest, auto-scroll keeps active line centered with a 3 s user-scroll grace period, click a line to seek, respects prefers-reduced-motion) activates only when the viewed track is the playing track AND timed lyrics exist; otherwise static text exactly as before. New [NowPlayingLyrics.tsx](frontend/src/components/player/NowPlayingLyrics.tsx) self-fetching card (tinted with the dominant cover color from Account 3's theming) wired into NowPlayingPanel + MobileNowPlayingSheet; TrackDetailPage passes synced lyrics through.
  - **Verified** via DEV-only harness at `/dev/karaoke` (real Coldplay LRC payload, simulated playback clock): highlight index correct at jumped timestamps, past/future dimming correct, seek-on-click sets currentTime to the line timestamp, auto-scroll computes the exact centered target, fallback static for untimed lyrics. Backend compiles; migration generated.
- **Config fix ([Program.cs](backend/src/NotSpotify.Api/Program.cs)):** restored standard .NET config precedence (env vars > user-secrets). The earlier force-load of user-secrets had appended them last, silently overriding env vars, making per-run overrides (e.g. `ConnectionStrings__Postgres`) impossible.

**Still incomplete:**
- Nothing — live-DB verification completed later the same session (below).

**Live verification against the real DB (same session, after the user supplied the Supabase pooler connection string):**
- User-secret `ConnectionStrings:Postgres` re-set to the Supabase session pooler; backend starts cleanly.
- **Backfill path verified:** Vaundy 怪獣の花唄 had plain lyrics cached pre-feature; first `GET /tracks/{id}/lyrics` fetched + persisted 1443 chars of synced LRC from LRCLIB.
- **Full in-app karaoke verified in browser** (logged in as alex): track page + now-playing rail card both render synced lines, active line highlights in time with **real audio**, card is tinted with the cover's dominant color, clicking a lyric line seeks the actual audio (active line follows). Screenshot-confirmed.
- ⚠️ **Unexplained observation:** on first connect, the shared DB reported `AddTrackSyncedLyrics` (this session's migration, exact ID `20260612122839_...`) as **already applied** — before this machine ever connected to that DB. Either another account ran an identical migration today or someone applied this one. **Other accounts: check for a duplicate/conflicting karaoke implementation before building on this.**

**~~ENVIRONMENT WARNING~~ (RESOLVED same session):**
- This machine's user-secrets had pointed at `localhost:5432/notspotify` — an **empty, abandoned scaffold DB** with drifted migration history (any backend start crashed in `MigrateAsync`). Re-set to the Supabase pooler string; backend now starts fine. The stale localhost DB still exists untouched if anyone wants to inspect/drop it.
- The Supabase **database password was pasted in chat** this session (like the service key before it) — consider rotating it in Supabase → Settings → Database.

**New bugs found:**
- None in the karaoke scope. (The DB/secret drift above was config, not code.)

**UX rework (same session, commit ab561f58, user-requested):**
- Track detail page now shows **static** lyrics always; karaoke moved to a **fullscreen view** (Spotify-style) opened by a **mic button beside the volume control** (accent-colored while open, X or mic again to close). Backdrop is a gradient from the album cover's dominant color; it fills the main card only (right rail + player bar stay visible); the page underneath stays mounted. New [KaraokeView.tsx](frontend/src/components/player/KaraokeView.tsx), `isKaraokeOpen`/`toggleKaraoke` in playerStore, lyrics fetching extracted to [useLyrics.ts](frontend/src/hooks/useLyrics.ts), `variant="full"` in LyricsView.
- **Star rating moved** from the player bar's right cluster to under the song title/artist on the left (`NowPlayingInfo`).
- All verified in-browser against the live backend (play → mic → synced fullscreen lyrics on purple Vaundy gradient → close restores page; no new console errors).

**LRCLIB script roulette fixed (commit 00a3ac38):** LRCLIB keeps duplicate entries per song in different scripts (kanji vs romanized) and durations; `/api/get` returns whichever duplicate the upload's duration lands on (a re-upload of 怪獣の花唄 at 3:44 matched the 225s **romanized** entry). LyricsService now uses `/api/search` and scores all candidates: synced lyrics +4, lyrics script matches the title's script (CJK check) +3, duration within 2s +2 / 10s +1. The lyrics endpoint also treats stored synced lyrics that fail the script check as suspect and re-picks (self-heals poisoned rows; keeps them if LRCLIB truly has nothing better — note: that rare case re-queries once per lyrics view). Verified: re-uploaded Vaundy track healed romaji → kanji; English tracks unaffected.

**Lyrics consistency (commits a27b559d, 86c38f62):** when a track has synced lyrics, they are now **canonical everywhere** — new fetches derive plain text from the LRC, the lyrics endpoint self-heals mismatched cached rows on read, and the frontend prefers synced-derived text. Fixes romaji-plain vs kanji-synced mismatches (e.g. Vaundy). **Policy note:** this also means artist-pasted plain lyrics get overwritten by the provider's timed transcription on first view if LRCLIB has one for that artist+title — accepted for now, revisit if artists complain.

**Notes for next session:**
- `/dev/karaoke` (DEV builds only) is a no-backend harness for the lyrics UI — useful for styling tweaks.
- audioEngine ignores seeks within 1.5 s of the current position, so clicking the currently-active lyric line may not re-snap audio — harmless.
- Free users can seek via lyrics clicks (same as the progress bar, which is also ungated). Confirm against business intent for the free tier.

### 2026-06-12 — Account 1 — Bug fixes 1, 2, 3, 5 (one commit each)

**Completed this session:**
- **Bug 1 (3592fb0d)** — zip endpoints HTTP-fetched our own `GetPublicUrl` per track; in LocalStorage mode that URL points at dead port 7080 → every fetch threw → silently-empty zips. Added `IStorageService.ReadAsync` (disk read for local, authed object fetch for Supabase), controllers use it with an absolute-URL fallback for seeded tracks, all-failed downloads now return 502 instead of an empty archive, and `LocalStorage.PublicBaseUrl` corrected to `http://localhost:5166`.
- **Bug 2 (27610f0f)** — `PlaylistTracks → Tracks` is ON DELETE RESTRICT. Admin album delete now removes playlist links + tracks first (rest cascades), single-track delete clears its playlist links too, confirm dialog states the cascade.
- **Bug 3 (5b5636e5)** — `fetchConversations` could land a stale unread>0 snapshot after the optimistic zero whenever it raced the mark-read POST (repro: first message from a "Start a chat" partner). It now clamps the active visible thread's unread to 0; MessagesPage also marks read on tab-visible return.
- **Bug 5 (0d45c82f)** — sidebar header tooltips (Collapse/Create/Expand) opened upward out of the `overflow-hidden` aside and were clipped at the card edge under the TopBar. Flipped to `spotify-tooltip-bottom` (+ right-aligned Create), matching Spotify.

**Still incomplete:**
- **Bug 4 (tab padding)** — could not locate any tab component in ArtistDashboardPage (searched current code and git history; no `border-b-2`/tab arrays/segmented controls). Needs the reporter's screenshot or the exact page/element before it can be fixed.

**New bugs found:**
- Single-track admin delete had the same playlist-FK failure as Bug 2 (fixed in the same commit).

**Notes for next session:**
- Backend changes (Bugs 1+2) need a backend restart to take effect — `dotnet run` was left running during this session, so restart it.
- Verification was build-level + code-trace; end-to-end checks (premium zip download, album delete with playlisted tracks, two-account chat badge) still want a manual pass since they need logged-in premium/admin accounts.

### 2026-06-12 — Account 2 — Dedicated admin login at /admin/login (Task 2)

**Completed this session:**
- **New page** [AdminLoginPage.tsx](frontend/src/pages/admin/AdminLoginPage.tsx) at **`/admin/login`** — minimal console-style sign-in (brand row matching AdminShell, email/password card, no social buttons/signup). If signed in as a non-admin it shows a "no admin access" panel with Switch account / Back to app instead of redirect-looping.
- **Guard changes** [AdminRoute.tsx](frontend/src/components/common/AdminRoute.tsx): unauthenticated visits to any `/admin/*` now redirect to `/admin/login` (was `/login`), carrying the attempted URL in `location.state.from` so login returns you there. Authenticated non-admins still bounce to `/`.
- **Router** [index.tsx](frontend/src/router/index.tsx): registered `/admin/login` top-level; removed the redundant `ProtectedRoute` wrapper around the admin branch (it intercepted first and sent admins to the member `/login`).
- Repaired two unrelated build breakers from in-flight work: `usePresenceSocket` missing new `FriendActivity` fields (`playedAt`/`isListeningNow`) and `PlaylistDetailPage` reading `.album` off a `PlaylistTrack` instead of `.track.album`.
- Verified in browser as guest: `/admin` and `/admin/tracks` both land on `/admin/login` and render the form; build + lint clean on touched files.

**Still incomplete:**
- Post-login return-to-`from` not browser-verified with real admin credentials (code path in place) — one manual admin login recommended.
- Task 1 sub-checkboxes (inventory/migrations) look mostly done in code (AdminShell topbar + Dashboard/Applications/etc. all migrated) but are unchecked above — owner should confirm and tick.

**New bugs found:**
- None in this slice. (Pre-existing lint errors elsewhere remain, e.g. PlaylistDetailPage effect patterns.)

**Notes for next session:**
- `/admin/login` deliberately keeps NO dev-shortcut buttons (unlike member LoginPage) — admin area stays credential-only.
- If an admin-only "remember last admin page" is wanted later, the `from` state in AdminRoute is the hook point.

**Completed:**
- **Friend Activity feed (Task 1)** — Spotify-style right rail showing what friends are listening to.
  - Backend: reworked `GET /friends/activity` ([FriendsController.cs](backend/src/NotSpotify.Api/Controllers/FriendsController.cs)). "Listening now" comes from `ActivePlaybackSessions` (heartbeat fresh within 90 s); offline/idle friends fall back to their latest `PlayHistories` row (last 7 days). `FriendActivityDto` gained `PlayedAt` + `IsListeningNow`.
  - Frontend: new [FriendActivityPanel.tsx](frontend/src/components/friends/FriendActivityPanel.tsx) — avatar + online dot, name, track · artist, album line, "x min/hr/d" timestamp or animated equalizer bars for live listening. Sorted live-first then most recent. Empty states for no-friends / no-activity.
  - Toggle button (RSS icon) in TopBar next to the Friends menu; the panel shares the right-rail slot with Now Playing (friend activity takes priority while open, closing it restores Now Playing). New `friendActivityOpen` state in uiStore. New util [formatRelativeTime.ts](frontend/src/utils/formatRelativeTime.ts).
  - FriendPanel dropdown now only shows the ▶ live line for `isListeningNow` (since `nowPlaying` can be a recent track now).
  - Verified end-to-end: created a throwaway user via API, friended alex, sent playback-heartbeat → appeared at top with equalizer; real friends (genzyy 21 hr, Nomnom 1 d) showed recently-played. Test friendship removed afterwards.
- **Dynamic theming from cover art (Task 2)** — mostly existed via `useDominantColor` (node-vibrant) but was **silently broken** on album/track pages: code appended hex alpha (`b3`/`33`/`cc`/`26`) to `hsl()` strings → invalid CSS → browser dropped the style and every page showed the generic accent gradient.
  - Added `withAlpha(color, alpha)` (uses `color-mix(in srgb, …)`) to [useDominantColor.ts](frontend/src/hooks/useDominantColor.ts); fixed AlbumDetailPage, TrackDetailPage, NowPlayingPanel, MobileNowPlayingSheet.
  - Added the missing dominant-color hero gradient to **PlaylistDetailPage** (was static accent before); falls back to first track's album art when the playlist has no cover, and to the existing Tailwind accent gradient when no color can be extracted.
  - Verified in browser: album (green from SWAG cover), playlist (olive from Night Drive photo), track (blue from Drive Forever) all render distinct cover-derived gradients.

**Still incomplete:**
- Nothing from this session's scope.

**New bugs found (pre-existing, not from this session):**
- React "empty string passed to src" warnings on Home — tracks/covers with empty `coverUrl` render `<img src="">` (e.g. "asdf", "1234" test tracks). Cosmetic console noise.
- SignalR presence socket logs "connection stopped during negotiation" bursts on page reload — reconnect race, presence still works afterwards.

**Notes for next session:**
- A throwaway account `fable-test@example.com` (name "Fable Test", password `Password123!`) exists in the DB from feed verification — friendship with alex was removed; account is inert. Delete it if/when an admin user-delete endpoint exists.
- Friend activity polls every 20 s via the existing `useFriendPolling`; the relative timestamps re-render every 30 s client-side.
- `withAlpha` relies on CSS `color-mix` (all evergreen browsers since 2023). If older browser support is ever needed, change `normalizeHue` to emit hex instead.

---

### 2026-06-12 — Account 3 — Lyrics pipeline, Supabase storage fix, track edit UI

**Completed:**
- **Lyrics — added LRCLIB as primary source before Lyrics.ovh.** Chain is now `DB → LRCLIB → Lyrics.ovh → not_found`. Fixes the Japanese/Korean coverage gap (verified: Vaundy "怪獣の花唄" now resolves on LRCLIB).
- **Created `LyricsService`** ([backend/.../Services/LyricsService.cs](backend/src/NotSpotify.Api/Services/LyricsService.cs)) encapsulating the full chain, registered as scoped service. Used by both upload + view endpoints.
- **Lyrics fetched at upload time**, not on first view — listeners get instant page load. `MeController.SubmitArtistTrack` now calls LyricsService after track creation if the artist didn't paste lyrics.
- **Duration tolerance** — LyricsService falls back to LRCLIB without `duration` param if the exact match fails (handles cases where uploaded file duration doesn't match LRCLIB's stored value within ±2s).
- **Lyrics field on `TrackDto`** so frontend can prefill the edit textarea.
- **Track edit UI** ([ArtistDashboardPage.tsx](frontend/src/pages/ArtistDashboardPage.tsx)) — pencil icon on every track row opens an inline form for **Title / Explicit / Lyrics**. `PATCH /me/artist-tracks/{id}` already supported these fields; only UI was missing.
- **Auto-refetch lyrics on title change** — if artist edits the title and leaves Lyrics blank, backend re-runs the LRCLIB→Lyrics.ovh chain with the new title. Useful when the original title was wrong (e.g. romanized vs original script).
- **Relaxed approved-track edit guard** in `UpdateArtistTrack` — artists can now edit metadata on live tracks too.
- **Supabase storage fix** — uploads were silently going to LocalStorage because user-secrets only auto-load in Development env, and the user's `dotnet run` runs in Production. Added `builder.Configuration.AddUserSecrets<Program>(optional: true)` in [Program.cs](backend/src/NotSpotify.Api/Program.cs) to force-load. Verified Supabase upload works directly via curl with the service key. Added `[Storage]` and `[Env]` startup log lines for visibility.
- **Upload error logging** — wrapped `_storage.UploadAsync` in try/catch + `ILogger` on all four upload endpoints (avatar, album cover, artist image, track audio). Real errors now surface in the backend console **and** the frontend error message.
- **Filled in CONTEXT.md placeholders** — Tech Stack, Folder Structure, DB Schema, Naming Conventions are now populated so future sessions skip rediscovery.

**Still incomplete:**
- Restart backend to apply the Supabase storage fix + new lyrics flow (user runs it themselves; not done in-session).
- `AddTrackLyrics` migration already in tree; runs on next startup via `MigrateAsync()`.

**New bugs found:**
- None during this session. The "uploads not landing in Supabase" issue turned out to be config (user-secrets not loading), not a code bug.

**Notes for next session:**
- The `media` bucket in Supabase must be set to **Public** for the public URL pattern to work (already done by user).
- Service-role key is in `dotnet user-secrets` under `SupabaseStorage:ServiceKey`. User shared it once in this chat; consider rotating in Supabase → Settings → API → Regenerate before sharing repo/screen.
- LRCLIB matches on artist + title (Japanese-script titles only for JP catalogue; romanized misses). Artist+title accuracy in the DB matters more than duration.
- Lyrics edit UI works for any track status. The previous "Cannot edit a live track" guard was removed in this session — confirm this matches business intent.
- Potential follow-up: surface `[Storage]` log at higher level (ILogger instead of `Console.WriteLine`) so it shows up in proper logging output, not just stdout.

---
<!-- New entries go above this line -->