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
- [ ] **Smart playlists** — Med. Rules engine (genre / rating / play-count / date-added); pairs with star ratings. Rules column on `Playlists`.
- [ ] **Waveform + timed comments** — Med–High. ffmpeg peak extraction at upload + a comments table pinned to timestamps. SoundCloud signature.
- [ ] **Featured playlist flags / manual ordering** — Med. Optional hardening beyond the shipped admin-owned public playlist curation; add featured/sort fields on `Playlists`.
- [ ] **Mood / activity tagging taxonomy** — Med. Optional hardening beyond the shipped search-backed mood page; add tag taxonomy/joins for tracks/playlists + admin tagging.

### 1B — No migration (frontend / query only)
- [x] **Admin restructure** *(Account 2)* — dedicated admin sidebar/topbar layout (`/adminlogin` guard already exists).
- [x] **Equalizer** — Web Audio `BiquadFilter` graph (separate from the crossfade engine; mind cross-origin tainting).
- [ ] **Wire remaining dead toggles** (disabled with "Coming soon" in Settings):
  - [x] Volume normalization (`normalize`) — **done (2026-06-16)**: client-side real-time loudness leveler (a shared `DynamicsCompressorNode` + makeup `GainNode` after the EQ chain in `audioEngine.ts`); no backend/ffmpeg. Settings toggle now live & honest ("Even out the loudness between songs"). Off = transparent (ratio 1).
  - [ ] Streaming quality (`quality`) — needs backend transcoding/adaptive bitrate (storage-gated → Phase 2).
  - [ ] Language (`language`) — i18n; large, low priority.
- [x] **PiP fast-forward / rewind** — Media Session seek handlers drive the real audio player and clamp to track duration.
- [x] **Genre browse playlists + tracks** — `/genres/{slug}/playlists` + genre detail rows for public playlists and popular tracks. *(Mood/activity tagging remains migration-gated above.)*
- [x] **Editorial / featured playlists** — admin-curated via public playlists owned by Admin users; falls back to top public playlists (no migration/flag).
- [x] **Mood / activity browse** — `/moods` search-backed rows, with mood-like browse cards routed there. *(Tag taxonomy remains migration-gated above.)*
- [ ] **Track comments** (non-timed) — precursor to waveform timed comments.
- [x] **Full "Wrapped"** — year-end view on top of the existing `/stats` mini-Wrapped.
- [x] **New-release / followed-artist notifications** — add producers for releases by followed artists (pairs with the follow graph).
- [ ] **Reposts** — extension of the follow graph.
- [x] **Share-to-chat rich cards** — send a track into 1:1 chat as a rich message. Track menu → "Share to chat" → friend picker modal sends a sentinel-token message (zero backend change); recipient's thread renders a rich `SharedTrackBubble` (cover/title/artist + play). `utils/chatShare.ts` encode/parse is unit-tested.
- [ ] **Playlist folders + pinning** — *pinning done (2026-06-16)*: client-side pin/unpin (`utils/pinnedLibrary.ts`, localStorage `ns-library-pinned`) floats items to the top of the library sidebar (list + grid) via a hover pin button; syncs app-wide on `ns-pinned-change`. **Folders (drag-to-group + collapsible) still pending.** *(Duplicate detection is moot — backend 409s duplicate adds.)*
- [x] **Discover Weekly** — collaborative filtering over `PlayHistories`.

### 1C — Large subsystems (each its own session + migration)
- [ ] **RBAC** — High. Master admin grants/revokes admin; role tiers + granular permissions; approval workflow (`PendingAction` table — flagged roles enqueue instead of executing); "Team & roles" + "Approvals" UI. Seed one master. Highest-risk.
- [ ] **Location-based discovery** — Med. Add `Country`/`Market` to `Artists`/`Albums` (users already have `Country`); `GET /tracks/popular?country=XX`; "Popular in {country}" home rows + seed values.
- [ ] **Ads engine** — High. `Advertisement` + `AdSettings` (ads-per-N-tracks); `GET /ads/next` (date window + country + weighted random); player inserts audio ads for free tier (premium = none → makes "ad-free" real); admin CRUD + scheduling + targeting + impressions. Self-recorded house ads.
- [ ] **Podcasts** — High (cheaper). `Podcast` + `Episode`; reuses the artist-upload/review flow + audio player; `/podcasts` catalogue.
- [ ] **Music videos** — High, **storage-heavy** (do alongside Phase 2). `MusicVideo` + `<video>` player + catalogue; could gate behind premium.

### 1D — Stretch
- [ ] **Desktop wrapper (Tauri)** — nearly free on top of the PWA.
- [ ] **Adaptive streaming / quality selection** — ffmpeg + hls.js; storage-gated.
- [ ] **Embeddable iframe mini-player**.
- [ ] **Personal uploads locker** — demo-scale only (storage).
- [ ] **Family / Duo / Student plans** — extra Stripe test prices + member invites.
- [ ] **Audio recognition** (hum/play to find) — AcoustID/Chromaprint; disproportionate effort.
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
