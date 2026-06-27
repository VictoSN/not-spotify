# NotSpotify TODO — Part 2

Backlog organised into **session-sized phases**. Each phase is scoped to be finishable
in a single Claude/Codex prompt session, and ends with its own unit-test tasks. There
are also two dedicated **testing phases** for cross-cutting regression work.

> This is a planning doc only — nothing here is implemented yet. The "Likely files"
> under each phase are starting points found by search; **verify before editing**, the
> real fix may touch more.

## How to run things
- **Frontend tests:** `cd frontend && npm test` (vitest) — scope with `npm test -- <name>`.
- **Frontend types:** `cd frontend && npx tsc --noEmit`.
- **Backend tests:** `cd backend && dotnet test` (xUnit, `NotSpotify.Api.Tests`).
- Tick `- [ ]` → `- [x]` as work lands; keep the matching roadmap docs in sync.

## Buckets → phases
| Bucket | Phases |
|---|---|
| **Bugs** | 1 (MV playback #3,#6), 2 (MV/podcast interactions #5,#8), 3 (recents #4), 4 (recommendations #1,#2), 5 (ads #7,#9), 8 (detail headers #10), 10 (lyrics close), 13 (follow/unfollow), 14 (library MV/podcast navigation) |
| **Settings / account "coming soon"** | 6 |
| **Admin: advertisement for free tier** | 7 |
| **Search results page redesign** | 9 |
| **Navigation / UI polish** | 15 (home/library clickability + empty-space create menu), 16 (playlist add-track hover affordance) |
| **Testing** | 11 (unit hardening), 12 (manual QA) |

## Recommended reasoning effort per phase
Suggested effort to spend per session, for both **Opus 4.8** (med / high / max / ultra)
and **Codex** (medium / high / xhigh — "extra high"). Tune to taste — bump up a level if
a phase fights back, drop one if it's going smoothly.

Opus 4.8:
- **med** — small, isolated, reuses an existing pattern, low blast radius.
- **high** — moderate scope, several files, but well understood.
- **max** — complex or correctness-critical logic spanning multiple files.
- **ultra** — the hardest: subtle timing / race / state-machine bugs or large redesigns.

Codex has 3 tiers, so the mapping collapses the top two Opus levels:
- **medium** ↔ Opus med · **high** ↔ Opus high · **xhigh** ↔ Opus max / ultra (anything complex or correctness-critical).

| Phase | Opus 4.8 | Codex | Why |
|---|---|---|---|
| 1 — MV first-class playback | **max** | **xhigh** | player state machine, panel selection, no double-play |
| 2 — MV/podcast interactions | **high** | **high** | repeat drag/menu patterns across card types |
| 3 — Recents context menu | **med** | **medium** | small, reuse `openMenuAtPointer` |
| 4 — Recommendations correctness | **max** | **xhigh** | genre assignment + "Show all" routing, FE + BE |
| 5 — Ads reliability | **ultra** | **xhigh** | timing/race; 2nd-ad state leak + simultaneous playback |
| 6 — Settings "coming soon" | **high** | **high** | product judgement + varied controls |
| 7 — Admin ads | **high** | **high** | new page + CRUD wiring to existing API |
| 8 — Detail header consistency | **med** | **medium** | UI diff & reconcile two pages |
| 9 — Search results redesign | **max** | **xhigh** | large UI rework, shared row component, maybe BE |
| 10 — Lyrics close on nav | **med** | **medium** | small, clear root cause (close-on-same-route) |
| 11 — Test hardening | **high** | **high** | cross-cutting suites + green run |
| 12 — Manual QA | **med** | **medium** | mostly human verification, little reasoning |
| 13 — Follow/unfollow regression | **high** | **high** | auth + optimistic state + FE/BE follow endpoints can disagree |
| 14 — Library MV/podcast navigation | **med** | **medium** | likely sidebar row/link wiring, low blast radius |
| 15 — Home/library clickability + empty-space create menu | **high** | **high** | pointer-event routing across cards, blank areas, menus, and drag/drop without conflicts |
| 16 — Playlist add-track hover affordance | **med** | **medium** | mostly UI placement; reuse existing hover/action pattern with low-to-medium blast radius |

---

## Phase 1 — Music videos as first-class playable items · Opus: max · Codex: xhigh
Covers bugs **#3** (MV not registered in the sidebar) and **#6** (an MV played on its
own should get its own now-playing sidebar, like a live-event "track").

Goal: when an MV is played independently (not as the video for an audio track) it
behaves like its own track — it registers in recents/library and drives the dedicated
music-video now-playing panel instead of the audio one.

- [x] Playing an MV registers it where audio tracks register (recents + saved library), so it appears in the left sidebar / Your Library. `playerStore.playVideo` now calls `registerVideoPlay` → `libraryStore.saveVideo` (auth-gated like `recordPlay`). There's no server video-history endpoint, and `savedVideos` is most-recent-first, so the saved library doubles as the recents ordering.
- [x] An independently-played MV shows the **music-video** now-playing right panel, not the audio `NowPlayingPanel`.
- [x] Confirm `playbackMode === 'video'` is set/cleared correctly on independent MV play vs. an audio track that merely *has* a video.
- [x] No "song + ad" / "audio + MV audio" double-playback when switching between an MV and an audio track (coordinate with Phase 4).

Likely files: `frontend/src/stores/playerStore.ts` (`playVideo`, `playbackMode`,
`isVideoPlaying`), `frontend/src/stores/libraryStore.ts` (`saveVideo`, recents),
`frontend/src/components/player/MusicVideoNowPlayingPanel.tsx`,
`frontend/src/components/player/NowPlayingPanel.tsx`,
`frontend/src/components/layout/AppShell.tsx` (panel selection by `playbackMode`),
`frontend/src/pages/MusicVideoPage.tsx`, `frontend/src/components/player/VideoPlaybackSurface.tsx`,
`frontend/src/components/layout/Sidebar.tsx` (library rows for `kind: 'video'`).

Tests (this session):
- [x] `playerStore` unit test: `playVideo()` sets `playbackMode = 'video'` and records the MV in recents/library; playing an audio track resets it. (`playerStore.test.ts` — plus a guest case proving the library side effect is auth-gated.)
- [x] Selector/logic test that the dedicated MV panel is chosen when `playbackMode === 'video'`. (Extracted `selectNowPlayingPanel` into `components/player/nowPlayingPanel.ts`, used by `AppShell`; tested in `nowPlayingPanel.test.ts`.)

---

## Phase 2 — MV/podcast discovery & home interactions · Opus: high · Codex: high
Covers bugs **#5** (MVs & podcasts not draggable / right-clickable on All/Home) and
**#8** (Home top panel has no Music Video category).

Goal: MVs and podcasts behave like other media cards on Home — context menu + drag —
and there's a Music Video category chip on the Home top panel.

- [x] MV and podcast cards on Home/All support right-click → context menu (reuse `VideoMenu` / `PodcastMenu`).
- [x] MV and podcast cards are draggable (to library/playlist where it makes sense), consistent with track/album cards.
- [x] Add a **Music Video** category to the Home top panel/category chips.
- [x] Verify the category surfaces real MV content (not an empty/placeholder list).

Likely files: `frontend/src/pages/HomePage.tsx` (top category chips + sections),
`frontend/src/components/cards/VideoMenu.tsx`, `frontend/src/components/cards/PodcastMenu.tsx`,
`frontend/src/components/cards/TrackTile.tsx` (drag/right-click pattern to mirror),
`frontend/src/hooks/useTrackDrop.ts` / `frontend/src/stores/dragStore.ts`,
`frontend/src/data/browseContent.ts`, `frontend/src/components/cards/PlaylistRowMenu.tsx`
(`openMenuAtPointer` pattern).

Tests (this session):
- [x] Component/interaction test: MV & podcast cards expose a context-menu trigger and a drag handler.
- [x] Home renders the Music Video category chip and a non-empty section when MV data exists.

---

## Phase 3 — Recents context menu (bug #4) · Opus: med · Codex: medium
Goal: right-clicking a song on the Recents page opens the track dropdown menu like
other lists.

- [x] Right-click on a Recents row opens the track context menu (`TrackRowMenu` via `openMenuAtPointer`).
- [x] Keyboard/`⋯` access stays consistent with other track rows.

Likely files: `frontend/src/pages/browse/RecentsPage.tsx`,
`frontend/src/components/cards/TrackRowMenu.tsx`, `frontend/src/components/cards/TrackRow.tsx`,
`frontend/src/utils/contextMenu.ts` (`openMenuAtPointer`).

Tests (this session):
- [x] Interaction test: a Recents row's `onContextMenu` opens the menu handle. (`RecentsPage.test.tsx` — right-click opens the `TrackRowMenu`; also asserts the `⋯` trigger stays present.)

> Small phase — fine to fold into Phase 2 if doing both in one session, since both are
> about enabling right-click menus on media rows.

---

## Phase 4 — Recommendations correctness (bugs #1, #2) · Opus: max · Codex: xhigh
Goal: Daily Mix assigns the right genre, and a discover/showcase "Show all" opens the
underlying songs instead of running a text search.

- [x] **#1 Daily Mix genre:** a song shows up under the correct genre/mix; fix the mis-assignment in the mix/recommendation build. `BuildDailyMixTracksAsync`'s artist-dominance filter used the artist's *top-2* genres — an artist with only 2 genres has both in their top-2, so a stray/secondary tag leaked into the wrong genre's mix. Tightened to require the genre be the artist's **plurality** (most-common, ties allowed) genre, so a pop act's mis-tagged "rock" track no longer lands in the Rock mix.
- [x] **#2 "Show all" in a discover playlist:** clicking "Show all" on a showcase (e.g. *New Music Friday*) opens that playlist's tracks, **not** a search for the playlist's name.
  - Current (buggy) logic: each showcase list is turned into a search query, so "Show all" runs `search("New Music Friday")` instead of navigating to the playlist's songs.
  - [x] Replaced the name→search-query routing with real in-app track-list routes. `browseContent.ts`'s `card()` no longer emits `/search?q=<title>`; curated discover cards map to real pages (New Music Friday → `/new-releases`, Discover Weekly → `/recommended-tracks`, Release Radar → `/new-releases`), `BrowseFeatureRow` gained a `href` for its "Show all", and every other showcase card/row falls back to the themed genre page (`/genres/<slug>`). `GenreDetailPage`'s `EditorialRow` uses those real routes.

Likely files: `frontend/src/services/trackService.ts`, `frontend/src/pages/MixDetailPage.tsx`,
`frontend/src/components/cards/MixTile.tsx`, `frontend/src/data/browseContent.ts`,
`frontend/src/components/common/SectionHeader.tsx` (the "Show all" link target),
`frontend/src/pages/browse/RecommendedTracksPage.tsx`, `frontend/src/pages/HomePage.tsx`,
backend: `backend/src/NotSpotify.Api/Controllers/TracksController.cs`,
`backend/src/NotSpotify.Api/Controllers/MeController.cs`,
`backend/src/NotSpotify.Api/Dtos/ResourceDtos.cs`.

Tests (this session):
- [x] Backend: extend `RecommendationEndpointsTests` so a track's genre/mix assignment is asserted (reproduce #1, then prove fixed). `DailyMixes_OnlyIncludesTracksWhoseArtistIsDominatedByThatGenre` — a pop act's stray rock-tagged track must not appear in the Rock mix while the genuine rock act's tracks do. Fails against the old top-2 rule, passes after the plurality fix.
- [x] Frontend: "Show all" resolves to a playlist/track-list route, not a `/search?q=` URL. `GenreDetailPage.test.tsx` — renders the discover showcases and asserts the row "Show all" → `/new-releases` and cards → `/new-releases` / `/recommended-tracks` (never `/search`), plus data-level assertions over `curatedBrowseCategories` and `getBrowseFallbackRows`.

> Note: making the backend test suite compile required adding the `NotificationService` arg to two stale `MeController` test call sites (`ArtistTourTests.cs`, `MeExportControllerTests.cs`) — a pre-existing break unrelated to Phase 4. The full backend suite is now green except `ChatControllerTests.Send_ToFriend_PersistsMessageAndPushesRealtime` (pre-existing: notification deep-link is `/messages?u=<id>` but the test still expects `/messages/<id>`). The 4 failing frontend `libraryStore` follow/unfollow tests are the open Phase 13 regression.

---

## Phase 5 — Ads reliability (bugs #7, #9) · Opus: ultra · Codex: xhigh
Goal: the ad countdown is correct, and the **2nd+** ad plays cleanly (no double audio,
no glitchy timer). The 1st ad is currently OK; subsequent ones are buggy.

- [ ] **#7** Fix the broken seconds countdown (timer drift / wrong remaining seconds).
- [ ] **#9** Fix the 2nd-and-later ad: never play song + ad simultaneously; reset the timer/state fully between ads; ensure exactly one active ad at a time.
- [ ] Audit ad lifecycle: start → countdown → end → resume music, and what state leaks between ads (likely a not-reset interval/ref or stale `playbackMode`).

Likely files: `frontend/src/components/player/PromoPlayer.tsx`,
`frontend/src/stores/playerStore.ts` (ad gating vs. playback), `frontend/src/services/adService.ts`,
`frontend/src/types/ad.ts`, `frontend/src/components/layout/AppShell.tsx` (PromoPlayer mount),
backend: `backend/src/NotSpotify.Api/Controllers/AdsController.cs`,
`backend/src/NotSpotify.Api/Models/Advertisement.cs`.

Tests (this session):
- [ ] `playerStore`/PromoPlayer logic test: timer counts down to 0 once per ad; music is paused for the whole ad and resumes after.
- [ ] Regression test for "second ad": two ads back-to-back never overlap and the timer resets between them.
- [ ] Backend `AdsControllerTests` covers the ad-selection/sequence path used by free tier.

---

## Phase 6 — Settings / account "coming soon" features · Opus: high · Codex: high
Goal: implement (or properly gate) the greyed-out / "coming soon" items in
Settings/Account so they're either functional or clearly, intentionally disabled.

- [x] Inventory every "coming soon"/greyed-out control in Settings & Account and decide per item: implement vs. keep-disabled-with-reason.
- [x] Implement the agreed subset; for the rest, make the disabled state consistent and accessible (tooltip/aria-disabled), not just visually faded.

Decisions per row (commit `22f0809d`):
- [x] **Private listening** (Privacy) — implemented. `ns-pref-private-listening` gates `POST /me/plays` in `playerStore.recordPlay`, so no PlayHistory rows or LastSeenAt bumps while on.
- [x] **Media cache** (Storage and cache) — implemented. Live `navigator.storage.estimate()` readout + working **Clear cache** button via the Cache Storage API.
- [x] **Open at login** (Display, Tauri-only) — implemented. `tauri-plugin-autostart` added to Cargo + capabilities; `useAutostart` hook lazy-imports `@tauri-apps/plugin-autostart` and hides the row in the browser build (no fake control surface).
- [x] **Allow notifications** (Notifications master) — implemented. Calls `Notification.requestPermission()` and only enables the master when granted; persists in `ns-notif-enabled`.
- [x] **New release alerts** — implemented end-to-end. New artist follow API (`POST/DELETE /artists/{id}/follow`, `GET /artists/following`) writes `UserFollows` rows, feeding the existing `NotifyArtistFollowersOfReleaseAsync` pipeline. `libraryStore` syncs both ways; `services/notifications.ts` polls `/notifications` every 60s and fires desktop alerts for unseen `new_release` rows.
- [x] **Friend activity** (master + 4 sub-toggles) — implemented end-to-end. Backend `NotifyAsync` calls added to `ChatController.Send` (`chat_message`) and `MeController.SavePlaylist` (`playlist_saved`); `new_follower` and `jam_invite` were already wired. Poller filters by enabled sub-toggles.
- [x] **Friend activity (image's other 3 rows)** — removed: "send me a song" / "likes my playlist" / "starts listening live" have no backend endpoint to hook into, and the closest equivalent ("joins my session") is exposed as the existing `jam_invite`.
- [x] **Push notifications (real OS-level Web Push)** — backend `WebPush` package + `WebPushService`, VAPID keys stored in user-secrets, `PushSubscriptions` table created via the raw-SQL guard pattern, new `PushController` (`vapid-public-key` / `subscribe` / `unsubscribe` / `test`). `NotificationService.NotifyAsync` and the two bulk paths (repost, new-release) now also call `_push.SendToUserAsync` so every in-app notification fires a real OS push to every subscribed browser. Frontend `services/webPush.ts` handles subscribe/unsubscribe + the SW `push` + `notificationclick` handlers render & route the alert. Settings shows a "Push notifications" toggle with a "Send test" button. **Note:** the SW is only registered in production builds (`registerSW.ts` skips dev) — for browser verification run `npm run build && npm run preview` (port 4173).

Likely files: `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/AccountSettingsPage.tsx`,
`frontend/src/i18n/translations.ts` (the "coming soon" strings).
Touched in this phase: also `frontend/src/services/notifications.ts` (new), `frontend/src/hooks/useAutostart.ts` (new), `frontend/src/stores/playerStore.ts`, `frontend/src/stores/libraryStore.ts`, `frontend/src/services/artistService.ts`, `frontend/src/App.tsx`, `frontend/src-tauri/*`, `backend/src/NotSpotify.Api/Controllers/ArtistsController.cs`, `backend/src/NotSpotify.Api/Controllers/ChatController.cs`, `backend/src/NotSpotify.Api/Controllers/MeController.cs`.

Tests (this session):
- [ ] For each newly-implemented setting: a test that the control persists/applies its value.
- Live-verified end-to-end via curl: follow→`new_release` (Justin Bieber), follow→`new_follower`, chat→`chat_message`, save→`playlist_saved` all landed in the recipient's `/notifications` feed.

---

## Phase 7 — Admin: advertisement management for free tier · Opus: high · Codex: high
Goal: an admin can create/manage advertisements that are served to free-tier users.
(Backend ad models/controllers exist; a frontend **admin ads** page appears to be
missing and must be added + wired.)

- [x] Admin UI to create/edit/list advertisements (`AdminAdsPage` includes create/edit/delete, targeting, flight windows, impression totals, and serving settings).
- [x] Wire it to the admin ads API; created ads persist to the same `Advertisements` table queried by `/ads/next` for free-tier playback. Admin/public no-row serving defaults are aligned to disabled until explicitly enabled.
- [x] Gate the page behind the admin role / existing admin entrance (`/admin/ads` is nested under `AdminRoute` and linked from the admin Monetization navigation).

Likely files (frontend, new): `frontend/src/pages/admin/AdminAdsPage.tsx` (+ form),
patterns from `frontend/src/pages/admin/AdminTrackFormPage.tsx` / `AdminDashboardPage.tsx`,
`frontend/src/services/adService.ts`, `frontend/src/router/index.tsx`.
Backend (exists): `backend/src/NotSpotify.Api/Controllers/Admin/AdminAdsController.cs`,
`backend/src/NotSpotify.Api/Dtos/AdminDtos.cs`, `backend/src/NotSpotify.Api/Models/Advertisement.cs`.

Tests (this session):
- [x] Backend: `AdminAdsController` create/list/update and settings defaults/round-trip covered in `AdminAdsControllerTests`.
- [x] Frontend: `AdminAdsPage.test.tsx` verifies listing, required validation, settings, and that form submission renders the created ad.

---

## Phase 8 — Detail page header consistency (bug #10) · Opus: med · Codex: medium
Goal: the **Album** and **Track** detail page headers look/behave the same (currently
"somewhat different").

- [x] Diff the Album vs. Track hero/header markup and reconcile (spacing, meta row, hero gradient usage, action bar). Differences were: eyebrow (`font-black tracking-wide text-primary` vs `font-semibold tracking-wider text-secondary`), cover md size (`md:w-56` vs `md:w-52`), title margin (`mb-2` vs `mb-3`), and action-bar wrapper (`gap-3 …flex-wrap` vs `gap-4`). All reconciled to one canonical set.
- [x] Factor shared header structure where reasonable so they can't drift again. New `frontend/src/components/common/DetailHero.tsx` owns the gradient wrapper, cover, eyebrow, title, meta slot, and action-bar wrapper; both `AlbumDetailPage` and `TrackDetailPage` now render their headers through it (page-specific meta/actions passed as slots).

Likely files: `frontend/src/pages/AlbumDetailPage.tsx`, `frontend/src/pages/TrackDetailPage.tsx`,
`frontend/src/hooks/useDominantColor.ts` (`heroGradient`), any shared detail-header component.
Added: `frontend/src/components/common/DetailHero.tsx` (+ `DetailHero.test.tsx`).

Tests (this session):
- [x] Snapshot/structure test asserting both headers share the same key elements/classes. `DetailHero.test.tsx` pins the canonical cover sizing, eyebrow styling, hero heading classes, action-bar wrapper spacing, and gradient background — since both pages route their header through `DetailHero`, this locks the shared structure for both. `npx tsc --noEmit` clean.

---

## Phase 9 — Search results page redesign (Spotify-style) · Opus: max · Codex: xhigh
Reworks the `/search` results view from the current minimal sectioned layout
(screenshot **before**) to Spotify's richer results page (screenshot **after**).

Current → target:
- **Current:** isolated card sections (Songs, *Found in lyrics*, Artists, Albums, Playlists); filter chips All/Songs/Artists/Albums/Playlists; no top result, no per-row type label, no inline add/follow/save.
- **Target:** a **Top result** hero card (best match + big play button) next to a Songs list; an **All** tab that *interleaves* songs/artists/albums/music-videos as **rows**, each with a right-side **type badge** ("Song" / "Artist" / "Music video") and a **contextual inline action** (＋/✓ save for songs·albums·videos, **Follow/Following** for artists, ▶ play on hover); filter chips add **Podcasts & Shows** and **Profiles**, and Music videos surface inline.

Goal: make the full results page match the dropdown's richness and Spotify's layout.

- [x] Add a **Top result** hero card for the strongest match (track/artist/album) with a play button, reusing the existing playback gates.
- [x] Build a unified result **row**: artwork · title · subtitle (`Song • Artist` / `Music video • Artist`) · type **badge** · inline action.
  - Reuse the inline-action patterns already in `TopBar`'s `SearchSuggestionRow` (like / follow / save, hover-play) so the page and the search dropdown stay consistent — lift them into a shared component if practical.
- [x] Make the **All** tab a mixed/interleaved list (top result + songs + artists + videos), not separate card grids.
- [x] Add the missing filter chips — **Podcasts & Shows**, **Profiles** — and ensure **Music videos** appear (`searchService` already returns `musicVideos`).
- [x] Wire each chip to filter the list; keep **Found in lyrics** as a sub-section under Songs/All.
- [x] Keep guest behaviour consistent (auth prompts on save/follow), matching the dropdown.

Likely files: `frontend/src/pages/SearchPage.tsx` (main rework),
`frontend/src/components/layout/TopBar.tsx` (`SearchSuggestionRow` + inline-action handlers to lift/share),
`frontend/src/services/searchService.ts` & `backend/src/NotSpotify.Api/Dtos/ResourceDtos.cs` (result shape: `tracks`, `tracksByLyrics`, `artists`, `albums`, `playlists`, `musicVideos`),
`frontend/src/i18n/translations.ts` (new strings: Top result, Music video, Podcasts & Shows, Profiles),
backend `backend/src/NotSpotify.Api/Controllers/SearchController.cs` (only if Profiles/Podcasts results aren't returned yet).

> If **Profiles** (user profiles) and **Podcasts & Shows** aren't in the search API yet,
> this phase either extends `SearchController` + the results DTO, or scopes those two
> chips to a follow-up — decide at session start.

Tests (this session):
- [x] Unit test on the **Top result** ranking helper: picks the strongest match deterministically.
- [x] Row renders the correct type badge + action per kind (song→save, artist→follow, video→save).
- [x] Filter chips narrow the list to the chosen kind; **All** interleaves results.

---

## Phase 10 — Lyrics view: close on top-left navigation (small bug) · Opus: med · Codex: medium
Goal: opening lyrics (the karaoke view) should also close when the user clicks the
top-left **home** button or **logo**, like Spotify — today it only closes via the lyrics
icon.

Root cause: `AppShell` closes the lyrics overlay on a *route change*
(`useEffect(() => setKaraokeOpen(false), [location.pathname])`), but the top-left home
button and logo navigate to `/`; when you're already on `/`, the pathname doesn't change,
so the effect never fires and the lyrics stay open. Only `toggleKaraoke` (the lyrics
`MicVocal` icon in `BottomPlayerBar`) closes it.

- [x] Clicking the top-left **home** button and the **logo** closes the lyrics/karaoke view, even when already on that route. (`TopBar` now calls `setKaraokeOpen(false)` from both home controls before navigating.)
- [x] Keep the existing close-on-route-change behaviour for all other navigation. (`AppShell`'s route-change effect remains in place.)
- [x] (Optional, Spotify-parity) any primary navigation click closes the lyrics view. (`TopBar`, `MobileNav`, and authenticated `Sidebar` link navigation now close karaoke on click.)

Likely files: `frontend/src/components/layout/AppShell.tsx` (`setKaraokeOpen`, the
route-change effect), `frontend/src/components/layout/TopBar.tsx` (home button + logo
`onClick`/`Link`), `frontend/src/stores/playerStore.ts` (`isKaraokeOpen`,
`setKaraokeOpen`, `toggleKaraoke`), `frontend/src/components/player/KaraokeView.tsx`.

Tests (this session):
- [x] Clicking home/logo while already on the same route calls `setKaraokeOpen(false)`. (`TopBar.test.tsx`)

---

## Phase 11 — Cross-cutting test hardening (dedicated) · Opus: high · Codex: high
A focused pass after the feature phases to lock in behaviour and catch regressions.

- [ ] Player state machine: audio ↔ MV ↔ ad transitions (no overlap, correct `playbackMode`, correct now-playing panel). Consolidates Phases 1, 4, 5.
- [ ] Library/recents registration across media types (track, MV, podcast). Consolidates Phases 1, 2.
- [ ] Recommendation/genre + "Show all" routing. Consolidates Phase 4.
- [ ] Clickability/context-menu regressions: Home playlist/mix rows navigate correctly; empty-space right-click opens create actions without stealing media right-clicks. Consolidates Phase 15.
- [ ] Playlist add-track hover affordance: the in-cover plus action works with mouse, keyboard, and existing add-song flows. Consolidates Phase 16.
- [ ] Run full suites green: `cd frontend && npm test` and `cd backend && dotnet test`.
- [ ] `npx tsc --noEmit` clean.

---

## Phase 12 — Manual QA checklist (dedicated) · Opus: med · Codex: medium
End-to-end verification the unit tests can't cover (needs the running app + backend).

- [ ] Play an MV standalone → it shows the MV now-playing panel and appears in the sidebar/library.
- [ ] Home shows a Music Video category; MV/podcast cards right-click + drag.
- [ ] Recents rows right-click open the menu.
- [ ] Daily Mix genres look correct; a discover "Show all" opens songs, not a search.
- [ ] Watch 3+ ads in a row on a free account: countdown correct, no double audio, clean resume.
- [ ] Admin can create an ad and it serves to a free-tier session.
- [ ] Album and Track headers look identical in structure.
- [x] Settings "coming soon" items are either functional or cleanly disabled. (Phase 6 — commit `22f0809d`; live-verified via curl, manual QA still pending in the running UI.)
- [ ] Search results page shows a Top result card + interleaved rows with type badges and inline add/follow/save; Podcasts/Profiles/Music-video filters work.
- [ ] With lyrics open, clicking the top-left home button or logo closes it (incl. when already on Home).
- [ ] Follow and unfollow work from every artist/profile surface and persist after reload.
- [ ] Saved podcasts and MVs in the left library sidebar navigate to their detail pages.
- [ ] Home playlist cards, Daily Mix cards, mix tracks, and playlist rows are clickable and open the correct destination instead of feeling like dead UI.
- [ ] Right-clicking blank/free space in the sidebar/library area opens the clean create menu (**Create playlist** / **Create folder**) while right-clicking media still opens the correct media menu.
- [ ] When adding songs to a playlist, the plus button appears inside/on the track cover on hover, close to the artwork, instead of far away on the row.

---

## Phase 13 — Follow/unfollow regression · Opus: high · Codex: high
Bug: user cannot follow or unfollow.

Goal: following/unfollowing should work consistently from artist pages, search rows/dropdowns,
menus, and profile/social surfaces; the visible state should update optimistically and persist
after refresh.

- [x] Reproduce where follow/unfollow is failing: the 4 `libraryStore.test.ts` follow/unfollow tests failed because `followArtist`/`unfollowArtist` fired real API calls (unmocked) that reverted optimistic state. Auth gate was also missing from the store methods (safety net) and `NowPlayingPanel.tsx` (the only UI follow surface lacking a guest check).
- [x] Fix the broken path while preserving optimistic update + rollback semantics: added auth gate to `libraryStore.followArtist`/`unfollowArtist` (like `registerVideoPlay`); added auth gate to `NowPlayingPanel.toggleFollow`; replaced `ExecuteUpdateAsync` in `ArtistsController.Follow`/`Unfollow` with tracked-entity updates so EF InMemory tests work.
- [x] Ensure follow state refreshes correctly — all UI surfaces already auth-gated (verified: ArtistMenu, TopBar, SearchPage, ArtistProfilePage, UserProfilePage, FollowListModal); `NowPlayingPanel` was the sole missing gate (fixed).
- [x] Guest clicks still open the auth prompt instead of firing a failing request — confirmed on all surfaces; store-level auth gate provides safety net.

Likely files: `frontend/src/stores/libraryStore.ts`, `frontend/src/services/artistService.ts`,
`frontend/src/services/friendService.ts`, `frontend/src/pages/ArtistDetailPage.tsx`,
`frontend/src/pages/SearchPage.tsx`, `frontend/src/components/layout/TopBar.tsx`,
backend `backend/src/NotSpotify.Api/Controllers/ArtistsController.cs`,
`backend/src/NotSpotify.Api/Controllers/UsersController.cs`, `backend/src/NotSpotify.Api/Models/UserFollow.cs`.

Tests (this session):
- [x] Frontend: follow button toggles to Following, unfollow toggles back, and failed API calls revert state. (9 total — 4 guest/local, 4 authenticated success/failure/rollback, 1 logout reset; all green.)
- [x] Backend: follow/unfollow endpoint is idempotent and returns success for the current authenticated user. (9 new `ArtistFollowTests` — follow idempotent, unfollow idempotent, guest 401, not-found 404, no-owner no-op, following list; all green.)

---

## Phase 14 — Library sidebar MV/podcast navigation · Opus: med · Codex: medium
Bug: podcasts and MVs are unclickable once saved in the left library sidebar.

Goal: saved podcasts and music videos in Your Library should behave like albums/playlists:
clicking the row opens the detail page, while drag/drop and context-menu behaviour remain intact.

- [x] Confirm saved podcast rows navigate to `/podcasts/{id}` from every sidebar layout state.
- [x] Confirm saved MV rows navigate to `/videos/{id}` from every sidebar layout state.
- [x] Prevent row navigation from being swallowed by menu buttons, drag handles, collapse controls, or minimized-sidebar chrome.
- [x] Keep existing library filters, drag/drop, and right-click menu behaviour for these media types.

Likely files: `frontend/src/components/layout/Sidebar.tsx`,
`frontend/src/stores/libraryStore.ts`, `frontend/src/components/cards/PodcastMenu.tsx`,
`frontend/src/components/cards/VideoMenu.tsx`, `frontend/src/pages/PodcastPage.tsx`,
`frontend/src/pages/MusicVideoPage.tsx`, router definitions.

Tests (this session):
- [x] Sidebar render/navigation test: saved podcast and saved MV rows call the expected routes.
- [x] Interaction test: menu trigger/right-click still opens the menu without also navigating.

---

## Phase 15 — Home/library clickability + empty-space create menu · Opus: high · Codex: high
Bug / polish: some Home-page items feel dead or inconsistent — for example playlist cards,
Daily Mix/mix track surfaces, or rows that visually look clickable but do not navigate.
Also, right-clicking a clean empty area in Your library/left sidebar should feel professional by opening a simple
creation menu, like the screenshot: **Create playlist** and **Create folder**.

Goal: make the Home and library surfaces feel consistently interactive, while adding a
safe empty-space context menu that does **not** conflict with album/artist/track/card
menus, buttons, drag/drop, text inputs, or existing playlist actions.

- [x] Audit Home-page cards/rows: playlists, Daily Mix tiles, mix tracks, recent items, and any tile that visually looks clickable.
- [x] Make each clickable surface navigate to the correct destination:
  - playlist → playlist detail
  - Daily Mix / generated mix → mix detail or generated-track list
  - track → track detail or play/open row, matching the existing app pattern
  - album/artist/MV/podcast → their existing detail pages
- [x] Preserve hover-play behaviour, drag/drop, and right-click media menus; do not let navigation fire when clicking menu buttons, play buttons, drag handles, or inline actions.
- [x] Add an empty-space right-click handler for the Your library/left sidebar area that opens a compact create menu with:
  - **Create playlist**
  - **Create folder**
- [x] Only show the empty-space create menu when the event target is genuinely blank/non-interactive space.
- [x] Do not override existing context menus for tracks, albums, artists, playlists, podcasts, MVs, inputs, modals, or browser text selection.
- [x] Keep the create actions wired to the same logic used by the current **Create** dropdown, so there is no duplicate creation path.

Likely files: `frontend/src/pages/HomePage.tsx`, `frontend/src/components/layout/Sidebar.tsx`,
`frontend/src/components/layout/AppShell.tsx`, `frontend/src/components/cards/MixTile.tsx`,
`frontend/src/components/cards/TrackTile.tsx`, `frontend/src/components/cards/PlaylistRowMenu.tsx`,
`frontend/src/components/cards/TrackRow.tsx`, `frontend/src/stores/libraryStore.ts`,
`frontend/src/router/index.tsx`, `frontend/src/utils/contextMenu.ts`.

Recommended intelligence / effort:
- **Opus 4.8: high** — the code is not algorithmically hard, but it touches several interaction layers. The main risk is pointer-event conflict: blank-space right-click must not steal media context menus, and click navigation must not fire when pressing play/menu/drag controls.
- **Codex: high** — use high because it needs careful regression checks across Home, sidebar, library rows, and playlist/mix cards.

Tests (this session):
- [x] Home interaction test: clicking playlist/mix/card surfaces navigates to the expected route.
- [x] Interaction test: clicking nested buttons/menu/play controls does **not** trigger row navigation.
- [x] Context-menu test: right-click blank sidebar/library space opens the create menu.
- [x] Context-menu test: right-click on media opens the media menu, not the blank-space create menu.
- [x] Creation test: **Create playlist** and **Create folder** call the existing creation handlers/store actions.

---

## Phase 16 — Playlist add-track hover affordance · Opus: med · Codex: medium
Polish: when adding songs inside a playlist, the current **+** button is too far from
the track cover/artwork. It should feel closer to Spotify / Your Library behaviour:
hover near the cover and the action appears directly inside or over the artwork area.

Goal: move the add-song affordance into the track-cover hover zone, while keeping the
row clean, readable, and usable for mouse + keyboard users.

- [x] In playlist add/search/recommendation rows, place the **+** action inside/on top of the track cover area on hover/focus.
- [x] Reuse the existing Your Library hover mechanics where possible, so the cover hover, play overlay, and action animation feel consistent.
- [x] Make the in-cover **+** add the song to the current playlist using the same handler as the existing far-right plus button.
- [x] After adding, remove the track from recommendations/search results and prevent duplicate adds.
- [x] Keep row click, hover-play, right-click menu, drag/drop, and mobile/touch behaviour from breaking.
- [x] Ensure the button remains keyboard-accessible: focus should reveal the action even without mouse hover.

Likely files: `frontend/src/pages/PlaylistDetailPage.tsx`,
`frontend/src/components/cards/TrackRow.tsx`, `frontend/src/components/cards/TrackTile.tsx`,
`frontend/src/components/cards/TrackRowMenu.tsx`, `frontend/src/components/player/PlaylistAddSongs.tsx`,
`frontend/src/stores/playlistStore.ts`, `frontend/src/stores/libraryStore.ts`.

Recommended intelligence / effort:
- **Opus 4.8: med** — mostly a UI placement and event-handling polish task if the existing hover/action pattern can be reused.
- **Codex: medium** — enough to implement cleanly with tests; bump to **high** only if the add-song UI is duplicated across several components or tied to playlist persistence bugs.

Tests (this session):
- [x] Render test: add-song rows show the **+** action inside/on the cover when hovered or focused.
- [x] Interaction test: clicking the in-cover **+** adds the track to the current playlist exactly once.
- [x] Regression test: row navigation/menu/play/drag actions still work and do not accidentally trigger add.

