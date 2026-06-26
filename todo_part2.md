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
| **Bugs** | 1 (MV playback #3,#6), 2 (MV/podcast interactions #5,#8), 3 (recents #4), 4 (recommendations #1,#2), 5 (ads #7,#9), 8 (detail headers #10), 10 (lyrics close) |
| **Settings / account "coming soon"** | 6 |
| **Admin: advertisement for free tier** | 7 |
| **Search results page redesign** | 9 |
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

---

## Phase 1 — Music videos as first-class playable items · Opus: max · Codex: xhigh
Covers bugs **#3** (MV not registered in the sidebar) and **#6** (an MV played on its
own should get its own now-playing sidebar, like a live-event "track").

Goal: when an MV is played independently (not as the video for an audio track) it
behaves like its own track — it registers in recents/library and drives the dedicated
music-video now-playing panel instead of the audio one.

- [ ] Playing an MV registers it where audio tracks register (recents + saved library), so it appears in the left sidebar / Your Library.
- [ ] An independently-played MV shows the **music-video** now-playing right panel, not the audio `NowPlayingPanel`.
- [ ] Confirm `playbackMode === 'video'` is set/cleared correctly on independent MV play vs. an audio track that merely *has* a video.
- [ ] No "song + ad" / "audio + MV audio" double-playback when switching between an MV and an audio track (coordinate with Phase 4).

Likely files: `frontend/src/stores/playerStore.ts` (`playVideo`, `playbackMode`,
`isVideoPlaying`), `frontend/src/stores/libraryStore.ts` (`saveVideo`, recents),
`frontend/src/components/player/MusicVideoNowPlayingPanel.tsx`,
`frontend/src/components/player/NowPlayingPanel.tsx`,
`frontend/src/components/layout/AppShell.tsx` (panel selection by `playbackMode`),
`frontend/src/pages/MusicVideoPage.tsx`, `frontend/src/components/player/VideoPlaybackSurface.tsx`,
`frontend/src/components/layout/Sidebar.tsx` (library rows for `kind: 'video'`).

Tests (this session):
- [ ] `playerStore` unit test: `playVideo()` sets `playbackMode = 'video'` and records the MV in recents/library; playing an audio track resets it.
- [ ] Selector/logic test that the dedicated MV panel is chosen when `playbackMode === 'video'`.

---

## Phase 2 — MV/podcast discovery & home interactions · Opus: high · Codex: high
Covers bugs **#5** (MVs & podcasts not draggable / right-clickable on All/Home) and
**#8** (Home top panel has no Music Video category).

Goal: MVs and podcasts behave like other media cards on Home — context menu + drag —
and there's a Music Video category chip on the Home top panel.

- [ ] MV and podcast cards on Home/All support right-click → context menu (reuse `VideoMenu` / `PodcastMenu`).
- [ ] MV and podcast cards are draggable (to library/playlist where it makes sense), consistent with track/album cards.
- [ ] Add a **Music Video** category to the Home top panel/category chips.
- [ ] Verify the category surfaces real MV content (not an empty/placeholder list).

Likely files: `frontend/src/pages/HomePage.tsx` (top category chips + sections),
`frontend/src/components/cards/VideoMenu.tsx`, `frontend/src/components/cards/PodcastMenu.tsx`,
`frontend/src/components/cards/TrackTile.tsx` (drag/right-click pattern to mirror),
`frontend/src/hooks/useTrackDrop.ts` / `frontend/src/stores/dragStore.ts`,
`frontend/src/data/browseContent.ts`, `frontend/src/components/cards/PlaylistRowMenu.tsx`
(`openMenuAtPointer` pattern).

Tests (this session):
- [ ] Component/interaction test: MV & podcast cards expose a context-menu trigger and a drag handler.
- [ ] Home renders the Music Video category chip and a non-empty section when MV data exists.

---

## Phase 3 — Recents context menu (bug #4) · Opus: med · Codex: medium
Goal: right-clicking a song on the Recents page opens the track dropdown menu like
other lists.

- [ ] Right-click on a Recents row opens the track context menu (`TrackRowMenu` via `openMenuAtPointer`).
- [ ] Keyboard/`⋯` access stays consistent with other track rows.

Likely files: `frontend/src/pages/browse/RecentsPage.tsx`,
`frontend/src/components/cards/TrackRowMenu.tsx`, `frontend/src/components/cards/TrackRow.tsx`,
`frontend/src/utils/contextMenu.ts` (`openMenuAtPointer`).

Tests (this session):
- [ ] Interaction test: a Recents row's `onContextMenu` opens the menu handle.

> Small phase — fine to fold into Phase 2 if doing both in one session, since both are
> about enabling right-click menus on media rows.

---

## Phase 4 — Recommendations correctness (bugs #1, #2) · Opus: max · Codex: xhigh
Goal: Daily Mix assigns the right genre, and a discover/showcase "Show all" opens the
underlying songs instead of running a text search.

- [ ] **#1 Daily Mix genre:** a song shows up under the correct genre/mix; fix the mis-assignment in the mix/recommendation build.
- [ ] **#2 "Show all" in a discover playlist:** clicking "Show all" on a showcase (e.g. *New Music Friday*) opens that playlist's tracks, **not** a search for the playlist's name.
  - Current (buggy) logic: each showcase list is turned into a search query, so "Show all" runs `search("New Music Friday")` instead of navigating to the playlist's songs.
  - Replace the name→search-query routing with a real playlist/track-list destination (id-based route).

Likely files: `frontend/src/services/trackService.ts`, `frontend/src/pages/MixDetailPage.tsx`,
`frontend/src/components/cards/MixTile.tsx`, `frontend/src/data/browseContent.ts`,
`frontend/src/components/common/SectionHeader.tsx` (the "Show all" link target),
`frontend/src/pages/browse/RecommendedTracksPage.tsx`, `frontend/src/pages/HomePage.tsx`,
backend: `backend/src/NotSpotify.Api/Controllers/TracksController.cs`,
`backend/src/NotSpotify.Api/Controllers/MeController.cs`,
`backend/src/NotSpotify.Api/Dtos/ResourceDtos.cs`.

Tests (this session):
- [ ] Backend: extend `RecommendationEndpointsTests` so a track's genre/mix assignment is asserted (reproduce #1, then prove fixed).
- [ ] Frontend: "Show all" resolves to a playlist/track-list route, not a `/search?q=` URL.

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

- [ ] Inventory every "coming soon"/greyed-out control in Settings & Account and decide per item: implement vs. keep-disabled-with-reason.
- [ ] Implement the agreed subset; for the rest, make the disabled state consistent and accessible (tooltip/aria-disabled), not just visually faded.

Likely files: `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/AccountSettingsPage.tsx`,
`frontend/src/i18n/translations.ts` (the "coming soon" strings).

> Needs a product decision on *which* items to build this session — split into multiple
> sessions if the list is long. Keep the deferred-features roadmap in sync.

Tests (this session):
- [ ] For each newly-implemented setting: a test that the control persists/applies its value.

---

## Phase 7 — Admin: advertisement management for free tier · Opus: high · Codex: high
Goal: an admin can create/manage advertisements that are served to free-tier users.
(Backend ad models/controllers exist; a frontend **admin ads** page appears to be
missing and must be added + wired.)

- [ ] Admin UI to create/edit/list advertisements (new admin page under `frontend/src/pages/admin/`, following the existing admin form pattern).
- [ ] Wire it to the admin ads API; confirm created ads are the ones served to free-tier accounts (ties into Phase 5).
- [ ] Gate the page behind the admin role / existing admin entrance.

Likely files (frontend, new): `frontend/src/pages/admin/AdminAdsPage.tsx` (+ form),
patterns from `frontend/src/pages/admin/AdminTrackFormPage.tsx` / `AdminDashboardPage.tsx`,
`frontend/src/services/adService.ts`, `frontend/src/router/index.tsx`.
Backend (exists): `backend/src/NotSpotify.Api/Controllers/Admin/AdminAdsController.cs`,
`backend/src/NotSpotify.Api/Dtos/AdminDtos.cs`, `backend/src/NotSpotify.Api/Models/Advertisement.cs`.

Tests (this session):
- [ ] Backend: `AdminAdsController` create/list/update covered (extend ad tests).
- [ ] Frontend: admin ads form submits and renders the created ad in the list.

---

## Phase 8 — Detail page header consistency (bug #10) · Opus: med · Codex: medium
Goal: the **Album** and **Track** detail page headers look/behave the same (currently
"somewhat different").

- [ ] Diff the Album vs. Track hero/header markup and reconcile (spacing, meta row, hero gradient usage, action bar).
- [ ] Factor shared header structure where reasonable so they can't drift again.

Likely files: `frontend/src/pages/AlbumDetailPage.tsx`, `frontend/src/pages/TrackDetailPage.tsx`,
`frontend/src/hooks/useDominantColor.ts` (`heroGradient`), any shared detail-header component.

Tests (this session):
- [ ] Snapshot/structure test asserting both headers share the same key elements/classes.

---

## Phase 9 — Search results page redesign (Spotify-style) · Opus: max · Codex: xhigh
Reworks the `/search` results view from the current minimal sectioned layout
(screenshot **before**) to Spotify's richer results page (screenshot **after**).

Current → target:
- **Current:** isolated card sections (Songs, *Found in lyrics*, Artists, Albums, Playlists); filter chips All/Songs/Artists/Albums/Playlists; no top result, no per-row type label, no inline add/follow/save.
- **Target:** a **Top result** hero card (best match + big play button) next to a Songs list; an **All** tab that *interleaves* songs/artists/albums/music-videos as **rows**, each with a right-side **type badge** ("Song" / "Artist" / "Music video") and a **contextual inline action** (＋/✓ save for songs·albums·videos, **Follow/Following** for artists, ▶ play on hover); filter chips add **Podcasts & Shows** and **Profiles**, and Music videos surface inline.

Goal: make the full results page match the dropdown's richness and Spotify's layout.

- [ ] Add a **Top result** hero card for the strongest match (track/artist/album) with a play button, reusing the existing playback gates.
- [ ] Build a unified result **row**: artwork · title · subtitle (`Song • Artist` / `Music video • Artist`) · type **badge** · inline action.
  - Reuse the inline-action patterns already in `TopBar`'s `SearchSuggestionRow` (like / follow / save, hover-play) so the page and the search dropdown stay consistent — lift them into a shared component if practical.
- [ ] Make the **All** tab a mixed/interleaved list (top result + songs + artists + videos), not separate card grids.
- [ ] Add the missing filter chips — **Podcasts & Shows**, **Profiles** — and ensure **Music videos** appear (`searchService` already returns `musicVideos`).
- [ ] Wire each chip to filter the list; keep **Found in lyrics** as a sub-section under Songs/All.
- [ ] Keep guest behaviour consistent (auth prompts on save/follow), matching the dropdown.

Likely files: `frontend/src/pages/SearchPage.tsx` (main rework),
`frontend/src/components/layout/TopBar.tsx` (`SearchSuggestionRow` + inline-action handlers to lift/share),
`frontend/src/services/searchService.ts` & `backend/src/NotSpotify.Api/Dtos/ResourceDtos.cs` (result shape: `tracks`, `tracksByLyrics`, `artists`, `albums`, `playlists`, `musicVideos`),
`frontend/src/i18n/translations.ts` (new strings: Top result, Music video, Podcasts & Shows, Profiles),
backend `backend/src/NotSpotify.Api/Controllers/SearchController.cs` (only if Profiles/Podcasts results aren't returned yet).

> If **Profiles** (user profiles) and **Podcasts & Shows** aren't in the search API yet,
> this phase either extends `SearchController` + the results DTO, or scopes those two
> chips to a follow-up — decide at session start.

Tests (this session):
- [ ] Unit test on the **Top result** ranking helper: picks the strongest match deterministically.
- [ ] Row renders the correct type badge + action per kind (song→save, artist→follow, video→save).
- [ ] Filter chips narrow the list to the chosen kind; **All** interleaves results.

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

- [ ] Clicking the top-left **home** button and the **logo** closes the lyrics/karaoke view, even when already on that route.
- [ ] Keep the existing close-on-route-change behaviour for all other navigation.
- [ ] (Optional, Spotify-parity) any primary navigation click closes the lyrics view.

Likely files: `frontend/src/components/layout/AppShell.tsx` (`setKaraokeOpen`, the
route-change effect), `frontend/src/components/layout/TopBar.tsx` (home button + logo
`onClick`/`Link`), `frontend/src/stores/playerStore.ts` (`isKaraokeOpen`,
`setKaraokeOpen`, `toggleKaraoke`), `frontend/src/components/player/KaraokeView.tsx`.

Tests (this session):
- [ ] Clicking home/logo while already on the same route calls `setKaraokeOpen(false)`.

---

## Phase 11 — Cross-cutting test hardening (dedicated) · Opus: high · Codex: high
A focused pass after the feature phases to lock in behaviour and catch regressions.

- [ ] Player state machine: audio ↔ MV ↔ ad transitions (no overlap, correct `playbackMode`, correct now-playing panel). Consolidates Phases 1, 4, 5.
- [ ] Library/recents registration across media types (track, MV, podcast). Consolidates Phases 1, 2.
- [ ] Recommendation/genre + "Show all" routing. Consolidates Phase 4.
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
- [ ] Settings "coming soon" items are either functional or cleanly disabled.
- [ ] Search results page shows a Top result card + interleaved rows with type badges and inline add/follow/save; Podcasts/Profiles/Music-video filters work.
- [ ] With lyrics open, clicking the top-left home button or logo closes it (incl. when already on Home).
