# not-spotify — TODO

> The remaining-work **checklist**. For what the project is, how to run it, architecture, Stripe, and the recommendation algorithms, see **[README.md](README.md)**.
>
> Phases: **finish features → storage → unit testing → finalization**. Constraint throughout: **no paid APIs / licensing / subscriptions** (free or self-hosted only).
>
> **Recently shipped (2026-06-15):** crossfade + gapless · asymmetric follows + public profiles. (Full completed-feature list is in the README.)

---

## Phase 1 — Finish features

Effort: **Low** = under a session · **Med** = 1–3 sessions · **High** = own session/migration.

### 1A — Migration-gated
⚠️ Shared Supabase DB — coordinate first. **Always `dotnet build` before `dotnet run` after `migrations add`**, and prefer idempotent `CREATE … IF NOT EXISTS` migrations.
- [x] **Smart playlists** — **done (2026-06-18)**. JSONB rules on `Playlists` with AND-combined genre / minimum rating / minimum play-count / recently-added filters plus a result cap. Tracks resolve dynamically from the approved catalogue; Library has a smart-playlist builder, detail pages show/edit rule chips, and manual add/remove is disabled while rules are active. Migration is idempotent and covered by backend unit tests.
- [x] **Waveform + timed comments** — **done**. `Track.Waveform` (peaks JSON) column via `AddTrackWaveforms`; timed comments via `TrackComment` model + `AddTrackComments` migration, `trackService` endpoints, and the `CommentSection` UI (timestamp-pinned). Backend + frontend build clean (verified 2026-06-19). ⚠️ Peak *extraction* runs at upload via ffmpeg — when ffmpeg isn't on the host (e.g. some dev envs) peaks are simply absent and the bar falls back gracefully; the column, render, and comments work regardless.
- [x] **Featured playlist flags / manual ordering** — Med. Optional hardening beyond the shipped admin-owned public playlist curation; add featured/sort fields on `Playlists`.
- [x] **Mood / activity tagging taxonomy** — **done (2026-06-19)**. Real `MoodTags` taxonomy (mood vs activity `Kind`, color, heroicon, search-query fallback) with `TrackMoodTags` / `PlaylistMoodTags` join tables. Idempotent migration seeds 9 canonical tags + a one-time genre-derived backfill so `/moods` has content on the shared DB. Public `MoodsController` (list/get/tracks/playlists), admin `AdminMoodTagsController` (taxonomy CRUD + track/playlist assignment). Frontend: `/moods` loads the real taxonomy (grouped, search fallback) and links to a new `/moods/:slug` detail page; admin track form has a mood-tag chip picker.

### 1B — No migration (frontend / query only)
- [x] **Admin restructure** *(Account 2)* — dedicated admin sidebar/topbar layout (`/adminlogin` guard already exists).
- [x] **Equalizer** — Web Audio `BiquadFilter` graph (separate from the crossfade engine; mind cross-origin tainting).
- [x] **Wire remaining dead toggles** (disabled with "Coming soon" in Settings): **all wired (2026-06-20)** — normalize, language, and streaming quality are now live; no "Coming soon" pills remain in Settings.
  - [x] Volume normalization (`normalize`) — **done (2026-06-16)**: client-side real-time loudness leveler (a shared `DynamicsCompressorNode` + makeup `GainNode` after the EQ chain in `audioEngine.ts`); no backend/ffmpeg. Settings toggle now live & honest ("Even out the loudness between songs"). Off = transparent (ratio 1).
  - [x] Streaming quality (`quality`) — **done (2026-06-20)**. Live, honest, client-side: with one source file per track we can't fetch a smaller transcode, so the two-deck `audioEngine` delivers the *perceptual* side of lower quality — a per-deck low-pass after the EQ chain whose cutoff tracks the tier (low 8 kHz → veryhigh/auto 22 kHz), so lower tiers roll off the highs like a lower bitrate would. Reads `ns-pref-quality` live via the existing `ns-pref-change` event; Settings selector is enabled (no more "Coming soon"), sub-text made honest ("lower tiers trade fidelity for less data"), en/es/fr. Layers under the HLS level cap from the adaptive-streaming item.
  - [x] Language (`language`) — **infra + core app coverage done (2026-06-16)**: dependency-free i18n (`i18n/translations.ts` + `stores/localeStore.ts` + `i18n/useTranslation.ts`, en/es/fr) — chose no-library since node_modules is committed. The **Settings page is fully translated** and its Language selector is live (sets `<html lang>`, persists to `ns-pref-language`, no more "Coming soon"). **Coverage added:** sidebar library UI, top search/nav bar, mobile nav, voice-search labels, shared section headers, and the Home/Search/Library pages. **Extended (2026-06-18):** added ~100 new keys across player/track/album/artist/profile/auth/admin/premium (all 3 languages); CommentSection, TrackDetailPage, PlayerControls, and LoginPage now use `t()`. Remaining views are incremental.
- [x] **PiP fast-forward / rewind** — Media Session seek handlers drive the real audio player and clamp to track duration.
- [x] **Genre browse playlists + tracks** — `/genres/{slug}/playlists` + genre detail rows for public playlists and popular tracks. *(Mood/activity tagging remains migration-gated above.)*
- [x] **Editorial / featured playlists** — admin-curated via public playlists owned by Admin users; falls back to top public playlists (no migration/flag).
- [x] **Mood / activity browse** — `/moods` now backed by the real mood/activity tag taxonomy (see 1A) with a search fallback; mood-like browse cards route there.
- [x] **Track comments** (non-timed) — precursor to waveform timed comments.
- [x] **Full "Wrapped"** — year-end view on top of the existing `/stats` mini-Wrapped.
- [x] **New-release / followed-artist notifications** — add producers for releases by followed artists (pairs with the follow graph).
- [x] **Reposts** — extension of the follow graph.
- [x] **Share-to-chat rich cards** — send a track into 1:1 chat as a rich message. Track menu → "Share to chat" → friend picker modal sends a sentinel-token message (zero backend change); recipient's thread renders a rich `SharedTrackBubble` (cover/title/artist + play). `utils/chatShare.ts` encode/parse is unit-tested.
- [x] **Playlist folders + pinning** — **done (2026-06-16)**, client-side / no migration. Pinning (`utils/pinnedLibrary.ts`) floats items to the top of the sidebar; **folders** (`utils/libraryFolders.ts`) are collapsible groups created via the Create dropdown (Playlist/Folder), renamed/deleted from a folder menu, with items moved in/out from each row's ⋯ menu (menu-based, **not** drag-and-drop). All localStorage; sidebar syncs on `ns-pinned-change` / `ns-folders-change`. *(Duplicate detection is moot — backend 409s duplicate adds.)*
- [x] **Discover Weekly** — collaborative filtering over `PlayHistories`.

### 1C — Large subsystems (each its own session + migration)
- [x] **RBAC** — **done (2026-06-20)**. Role tier `Master` above `Admin` (JWT role claims already wired, so `user.roles` exposes it client-side); DbSeeder seeds exactly one master (the demo admin) + ensures the role. `PendingAction` approval queue via idempotent Program.cs guard. `AdminTeamController` (`[Authorize(Roles=Admin)]`): `GET /admin/team` roster, `POST /admin/team/grant` (by email), `POST /admin/team/{id}/revoke` — a **master executes immediately (200)** while a **regular admin's request enqueues (202)**; can't revoke a master or yourself. `GET /admin/approvals` (master sees all, admins see their own), `POST /admin/approvals/{id}/approve|reject` (master-only; approve runs the action) — both notify the target. Frontend: `/admin/team` (grant input + roster with Master/Admin badges + revoke) and `/admin/approvals` (filterable queue, master-only approve/reject), a new "Governance" admin-nav section, role-aware copy via `user.roles.includes('Master')`. *(Granular per-action permission matrix simplified to the Master/Admin tier + grant/revoke + approval flow — the high-value, risk-reducing core.)*
- [x] **Location-based discovery** — **done (2026-06-20)**. `Country` (ISO alpha-2) on `Artists`/`Albums` via idempotent `AddContentCountry` migration (`ADD COLUMN IF NOT EXISTS` + a one-time spread/inherit backfill so the shared DB has market content). `GET /tracks/popular?country=XX` ranks by 30-day plays from users in that country (+0.5 same-market boost), padding with market then global top tracks; falls back to the caller's country or `US`. DbSeeder sets per-artist/album countries; artist/album submit + update write paths accept `Country`; `ArtistDto`/`AlbumDto` expose it. Frontend: `trackService.getPopularInCountry` + a "Popular in {country}" Home row (ISO→region name via `Intl.DisplayNames`), en/es/fr. *(Admin/artist form Country inputs not added — API accepts it; seed/backfill provides data.)*
- [x] **Ads engine** — **done (2026-06-20)**. `Advertisement` + singleton `AdSettings` (ads-per-N-tracks + global on/off) via idempotent Program.cs guard that one-time-seeds the settings row + two house ads (audio borrowed from the catalogue so they play). Public `AdsController`: `GET /ads/next` (active + flight-window + country match → **weighted random**), `GET /ads/settings`, `POST /ads/{id}/impression`. `AdminAdsController` (`[Authorize(Roles=Admin)]`): ad CRUD + settings GET/PUT. Frontend: free-tier player inserts one audio ad every N tracks — a separate `AdPlayer` element (two-deck engine untouched) plays a **non-skippable** ad (transport locked in `playerStore` until it ends; autoplay-block/error safely release it), records the impression, and shows a "Go ad-free" → `/premium` banner; **premium never hears ads** (gated on `isFreeUser()`), making the perk real. i18n en/es/fr. *(Admin ads UI page deferred — API + seed complete.)*
- [x] **Podcasts** — **done (2026-06-20)**. `Podcast` + `Episode` models with an idempotent Program.cs guard (`CREATE TABLE IF NOT EXISTS` + FK/indexes, same pattern as Reposts/TrackComments) that also one-time-seeds two shows whose episodes draw audio straight from the existing approved catalogue, so they play through the unchanged two-deck audio engine. Public `PodcastsController` (list / get-with-episodes / episodes). Frontend: `episodeToTrack` adapter (episode → `Track` shape, zero player changes), `/podcasts` catalogue + `/podcasts/:id` detail page with per-episode play/pause, a "Podcasts" Home row (en/es/fr). *(Artist-upload/review flow for podcasts deferred — admin/seed creates shows; catalogue + playback are complete.)*
- [x] **Music videos** — **done (2026-06-20)**. `MusicVideo` (artist FK + optional track link, video/thumbnail url-or-key, view count) via idempotent Program.cs guard that one-time-seeds 4 videos linked to top tracks using **public sample footage** (Google `gtv-videos-bucket` MP4s) with the track's album cover as thumbnail. Public `MusicVideosController` (list / get-with-view-count). Frontend: `/videos` catalogue (16:9 thumbnail grid) + `/videos/:id` watch page (`<video controls autoPlay>` that **pauses the audio player on play** so the two don't overlap; links to the artist + accompanying track), a "Music videos" Home row, en/es/fr. *(Open to all tiers — the premium gate is optional and left off to avoid a paywall on demo content.)*

### 1D — Stretch
- [x] **Desktop wrapper (Tauri)** — **done (2026-06-20)**. Tauri v2 shell in `frontend/src-tauri` that embeds the existing built `dist/` in a native window (no second UI copy, no web server). `npm run tauri:dev` (loads the Vite dev server, hot reload) / `npm run tauri:build` (runs `build:desktop` = `vite build --mode development` so the packaged app points at `.env.development`'s `https://localhost:7045` — it's a client of the local backend, start `dotnet run` first). Icons derived from the PWA icons via `src-tauri/icons/generate-icons.mjs` (no image tooling needed — wraps the 192px PNG in an ICO). `@tauri-apps/cli` added to devDependencies; `src-tauri/target/` git-ignored, `Cargo.lock` committed. Verified: `cargo build` compiles the shell to `not-spotify-desktop.exe`.
- [ ] **Adaptive streaming / quality selection** — ffmpeg + hls.js; storage-gated.
- [x] **Embeddable iframe mini-player** — **done (2026-06-20)**, frontend-only. Standalone `/embed/track/:id` route (`EmbedTrackPage`) renders bare — outside AppShell, no auth — with its own `<audio>` element and explicit (theme-independent) colors so it looks right inside any host page. Cover/title/artist link out via `target="_top"`. TrackDetailPage's action bar gains a "Copy embed code" button (CodeBracketIcon) that copies a ready `<iframe>` snippet; i18n keys added (en/es/fr).
- [x] **Personal uploads locker** — **done (2026-06-20)**. `UserUpload` (per-user private audio) via idempotent Program.cs guard; `MeUploadsController` (`[Authorize]`): `GET/POST/DELETE /me/uploads` — file goes through the existing `IStorageService` (`uploads/{userId}/{guid}.ext`), resolved for the owner only, never in the public catalogue/search/recs. Frontend: `/uploads` page (multi-file picker, client-side duration probe, list with play/pause + delete), `uploadToTrack` adapter (plays through the unchanged engine), "Your uploads" entry in the user menu, en/es/fr.
- [x] **Family / Duo / Student plans** — **done (2026-06-20)**. Three extra env-gated Stripe tiers (Duo=2 seats, Family=6, Student=discounted/1) added to the billing catalogue in `StripeBillingService` (each its own recurring Price; Checkout Sessions + Prices, quantity 1, no `payment_method_types` per Stripe best practices). `/billing/plans` + checkout now take a `plan` key (legacy `interval` still accepted); `BillingPlanDto` exposes plan/tier/maxMembers; PremiumPage renders all tiers with seat counts. **Member invites:** `PlanMembership` model + idempotent Program.cs guard (table + `AspNetUsers.PlanTier`/`PlanOwnerId` columns); `PlanController` (`/me/plan` overview, invite-by-email, accept/decline, remove/leave). Accepting syncs the member's `Plan="premium"` + `PlanOwnerId` so **every existing premium check keeps working** with no gating changes; seats are released back to free on cancel (BillingController) and on Stripe downgrade (webhook). Webhook records the tier from price-id/metadata. Frontend `PlanMembersCard` on Account → Subscription (seat management + incoming invites, refreshes auth on change). Verified: backend CoreCompile + frontend tsc/vite build. *(Runtime not exercised against the shared DB / live Stripe; price IDs are env-gated.)*
- [x] **Audio recognition** (play to find) — **done (2026-06-20)**, 100% client-side, no plugin/install/API. A dependency-free Shazam-style constellation fingerprinter (`utils/audioFingerprint.ts`: radix-2 FFT → per-band spectral peaks → (anchor,target) hash pairs → time-offset-coherence match) — unit-tested (FFT correctness + noisy-clip match among several tracks + unrelated-audio rejection). `services/recognitionService.ts` decodes catalogue audio with the browser's built-in Web Audio `decodeAudioData` (no ffmpeg), caches per-track fingerprints in IndexedDB (one-time index build), and matches a mic recording (`getUserMedia`/`MediaRecorder`) or uploaded clip. `/recognize` page (mic "Listen" + file upload, honest index/coverage status, links the matched track) + a "Identify a song" user-menu entry (en/es/fr). *(Hum-to-find left out — needs melody DB; AcoustID skipped — it matches the commercial MusicBrainz catalogue, not our uploads, and needs a key. Index covers the top ~50 tracks; end-to-end mic match depends on catalogue audio being CORS-fetchable for analysis and is best verified in the running app.)*
- [ ] **Concert/tour info** — needs a third-party API key (free tiers require approval); revisit only if granted.

### 1E — ❌ Not realistic (no-paid-services — out of scope on purpose)
Licensed major-label catalogue · spatial audio · real ad-network/royalties at scale · native iOS/Android + CarPlay/Android Auto/TV/Watch · Shazam-grade recognition · lossless/hi-res at real scale. The artist-upload model is the intended substitute for a licensed catalogue.

---

## Phase 2 — Storage (temporary R2/B2 → permanent student-account S3)

**Goal:** move audio/media off Supabase Storage (1 GB free tier — the ceiling) to a free object store now, then to the student S3 at the end.

**Why low-risk:** already abstracted behind `IStorageService` (`GetAudioUrl`, `GetPublicUrl`, `Upload`, `Delete`, `Read`) with Supabase + Local impls — a new provider is one class + DI wiring.

**Plan:** Cloudflare R2 now (10 GB, **$0 egress forever** — every play downloads the file, so egress is what kills streaming budgets; R2 is S3-compatible). Later → real S3 by changing only endpoint + keys (no code rework; protects the **$50 budget** since S3 egress ≈ $0.09/GB). If S3 isn't a hard requirement, R2 could be the final home.

| Option | Free tier | Egress | S3-compat | Notes |
|---|---|---|---|---|
| **Cloudflare R2** ⭐ | 10 GB + ops | **$0 always** | ✅ | Best fit; trivial swap to S3 later. |
| **Backblaze B2** | 10 GB | free via Cloudflare CDN | ✅ | Pair with Cloudflare for free bandwidth. |
| **Cloudinary** | ~25 GB credits | in credits | ⚠️ own API | Audio + transforms; not S3. |
| **Supabase (current)** | 1 GB | 2 GB/mo | partial | The ceiling we're hitting. |

- [ ] Create a free Cloudflare R2 (and/or B2) account.
- [ ] Add `R2StorageService : IStorageService` + config selection + user-secrets (keys/endpoint/bucket).
- [ ] Migrate / re-upload the seed catalogue to R2; verify playback + downloads.
- [ ] At the end: repoint the same adapter at the student S3 (endpoint + keys only).

---

## Phase 3 — Unit testing (3-way split)

**Harness + smoke layer are now in place (2026-06-15).** Deepening per the 3-way split below is still open.

**Setup (once, together):**
- [x] Backend: xUnit project `backend/test/NotSpotify.Api.Tests` (registered in `NotSpotify.slnx`); EF Core **InMemory** so tests never touch the shared DB; `IStorageService` mocked, `NotificationService` built over InMemory + no-op hub, `IHubContext` mocked. `dotnet test` → **9 passing** (Friends + Chat controller guards/persistence/real-time push).
- [x] Frontend: **Vitest** + jsdom + Testing Library wired via a standalone `vitest.config.ts` (kept separate from `vite.config.ts` to avoid the vite-8/vitest-3 plugin-type clash); test files excluded from `tsc -b`. `npm run test` → **9 passing** (formatNumber, formatTime, chatStore reducers). `npm run build` + lint stay clean.
- [x] `test` / `test:watch` scripts wired (frontend); backend via `dotnet test`. Smoke layer done — now **deepen** by the split below.

**Split (each person owns unit tests for their slice):**

- [ ] **Part A — Playback / Player / Discovery / Lyrics — Owner: ____**
  - Backend: recommendation endpoints (trending/most-liked/for-you/charts/radio/daily-mixes/search-by-lyrics) ranking + empty/guest fallbacks; `LyricsService`.
  - Frontend: `playerStore` (transport, free-vs-premium shuffle/repeat gating, queue/play-next/reorder, sleep timer, rate), two-deck `audioEngine` transitions, keyboard-shortcut hook, rating store.
- [ ] **Part B — Library / Playlists / Search / Social — Owner: ____**
  - Backend: playlist CRUD + visibility 403 matrix, collaborative add/remove, friends graph (mutual/suggestions/blend), **follows** (follow/idempotent/unfollow/self-403/counts/lists), search.
  - Frontend: `libraryStore`, `friendStore`, export/import matching, `FollowListModal`, search debounce/recents.
- [ ] **Part C — Artist / Admin / Auth / Billing / Platform — Owner: ____**
  - Backend: auth (signup/login/refresh, rate-limit 429), role/route guards (401/403), artist application→review, admin CRUD + approval/revoke + `ReviewHistory`, `AudioDownloadService` premium gating, Stripe webhook (mocked), `NotificationService`.
  - Frontend: `authStore` (login/logout/refresh, capabilities), wired settings toggles, admin guards, offline-audio save/resolve.

> Two-browser manual checks are still required for real-time features (presence, chat, collaborative playlists, listen-along). Seed logins in the README.

---

## Phase 4 — Finalization

- [ ] Collect minor feedback from teammates + lecturer; triage into quick fixes vs out-of-scope.
- [ ] UX polish pass — visual states (hover/disabled/free-locked/empty), light & dark, responsive (≤640px + tablet), a11y (aria-labels, modal focus trap/Esc/return-focus).
- [ ] Honesty pass — no toggle/button that lies; surface caught errors via `notify` instead of silent `catch {}`.
- [ ] Clear any **new** red console errors (the known empty-`<img src>` and SignalR reconnect noise are pre-logged).
- [ ] Final build/deploy check; confirm PWA/offline via `npm run build` + `npm run preview`.
- [ ] Keep this checklist + the README's feature/known-issues lists current as items land.
