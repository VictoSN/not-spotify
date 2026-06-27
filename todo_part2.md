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

- [ ] Playing an MV registers it where audio tracks register (recents + saved library), so it appears in the left sidebar / Your Library.
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
- [ ] `playerStore` unit test: `playVideo()` sets `playbackMode = 'video'` and records the MV in recents/library; playing an audio track resets it.
- [ ] Selector/logic test that the dedicated MV panel is chosen when `playbackMode === 'video'`.

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

- [ ] Reproduce where follow/unfollow is failing: artist follow (`/artists/{id}/follow`), user/profile follow (`/users/{id}/follow`), or frontend state sync.
- [ ] Fix the broken path while preserving optimistic update + rollback semantics.
- [ ] Ensure follow state refreshes correctly in `libraryStore`, artist detail, search dropdown/page rows, and any Follow buttons.
- [ ] Guest clicks still open the auth prompt instead of firing a failing request.

Likely files: `frontend/src/stores/libraryStore.ts`, `frontend/src/services/artistService.ts`,
`frontend/src/services/friendService.ts`, `frontend/src/pages/ArtistDetailPage.tsx`,
`frontend/src/pages/SearchPage.tsx`, `frontend/src/components/layout/TopBar.tsx`,
backend `backend/src/NotSpotify.Api/Controllers/ArtistsController.cs`,
`backend/src/NotSpotify.Api/Controllers/UsersController.cs`, `backend/src/NotSpotify.Api/Models/UserFollow.cs`.

Tests (this session):
- [ ] Frontend: follow button toggles to Following, unfollow toggles back, and failed API calls revert state.
- [ ] Backend: follow/unfollow endpoint is idempotent and returns success for the current authenticated user.

---

## Phase 14 — Library sidebar MV/podcast navigation · Opus: med · Codex: medium
Bug: podcasts and MVs are unclickable once saved in the left library sidebar.

Goal: saved podcasts and music videos in Your Library should behave like albums/playlists:
clicking the row opens the detail page, while drag/drop and context-menu behaviour remain intact.

- [ ] Confirm saved podcast rows navigate to `/podcasts/{id}` from every sidebar layout state.
- [ ] Confirm saved MV rows navigate to `/videos/{id}` from every sidebar layout state.
- [ ] Prevent row navigation from being swallowed by menu buttons, drag handles, collapse controls, or minimized-sidebar chrome.
- [ ] Keep existing library filters, drag/drop, and right-click menu behaviour for these media types.

Likely files: `frontend/src/components/layout/Sidebar.tsx`,
`frontend/src/stores/libraryStore.ts`, `frontend/src/components/cards/PodcastMenu.tsx`,
`frontend/src/components/cards/VideoMenu.tsx`, `frontend/src/pages/PodcastPage.tsx`,
`frontend/src/pages/MusicVideoPage.tsx`, router definitions.

Tests (this session):
- [ ] Sidebar render/navigation test: saved podcast and saved MV rows call the expected routes.
- [ ] Interaction test: menu trigger/right-click still opens the menu without also navigating.

---

## Phase 15 — Home/library clickability + empty-space create menu · Opus: high · Codex: high
Bug / polish: some Home-page items feel dead or inconsistent — for example playlist cards,
Daily Mix/mix track surfaces, or rows that visually look clickable but do not navigate.
Also, right-clicking a clean empty area in Your library/left sidebar should feel professional by opening a simple
creation menu, like the screenshot: **Create playlist** and **Create folder**.

Goal: make the Home and library surfaces feel consistently interactive, while adding a
safe empty-space context menu that does **not** conflict with album/artist/track/card
menus, buttons, drag/drop, text inputs, or existing playlist actions.

- [ ] Audit Home-page cards/rows: playlists, Daily Mix tiles, mix tracks, recent items, and any tile that visually looks clickable.
- [ ] Make each clickable surface navigate to the correct destination:
  - playlist → playlist detail
  - Daily Mix / generated mix → mix detail or generated-track list
  - track → track detail or play/open row, matching the existing app pattern
  - album/artist/MV/podcast → their existing detail pages
- [ ] Preserve hover-play behaviour, drag/drop, and right-click media menus; do not let navigation fire when clicking menu buttons, play buttons, drag handles, or inline actions.
- [ ] Add an empty-space right-click handler for the Your library/left sidebar area that opens a compact create menu with:
  - **Create playlist**
  - **Create folder**
- [ ] Only show the empty-space create menu when the event target is genuinely blank/non-interactive space.
- [ ] Do not override existing context menus for tracks, albums, artists, playlists, podcasts, MVs, inputs, modals, or browser text selection.
- [ ] Keep the create actions wired to the same logic used by the current **Create** dropdown, so there is no duplicate creation path.

Likely files: `frontend/src/pages/HomePage.tsx`, `frontend/src/components/layout/Sidebar.tsx`,
`frontend/src/components/layout/AppShell.tsx`, `frontend/src/components/cards/MixTile.tsx`,
`frontend/src/components/cards/TrackTile.tsx`, `frontend/src/components/cards/PlaylistRowMenu.tsx`,
`frontend/src/components/cards/TrackRow.tsx`, `frontend/src/stores/libraryStore.ts`,
`frontend/src/router/index.tsx`, `frontend/src/utils/contextMenu.ts`.

Recommended intelligence / effort:
- **Opus 4.8: high** — the code is not algorithmically hard, but it touches several interaction layers. The main risk is pointer-event conflict: blank-space right-click must not steal media context menus, and click navigation must not fire when pressing play/menu/drag controls.
- **Codex: high** — use high because it needs careful regression checks across Home, sidebar, library rows, and playlist/mix cards.

Tests (this session):
- [ ] Home interaction test: clicking playlist/mix/card surfaces navigates to the expected route.
- [ ] Interaction test: clicking nested buttons/menu/play controls does **not** trigger row navigation.
- [ ] Context-menu test: right-click blank sidebar/library space opens the create menu.
- [ ] Context-menu test: right-click on media opens the media menu, not the blank-space create menu.
- [ ] Creation test: **Create playlist** and **Create folder** call the existing creation handlers/store actions.

---

## Phase 16 — Playlist add-track hover affordance · Opus: med · Codex: medium
Polish: when adding songs inside a playlist, the current **+** button is too far from
the track cover/artwork. It should feel closer to Spotify / Your Library behaviour:
hover near the cover and the action appears directly inside or over the artwork area.

Goal: move the add-song affordance into the track-cover hover zone, while keeping the
row clean, readable, and usable for mouse + keyboard users.

- [ ] In playlist add/search/recommendation rows, place the **+** action inside/on top of the track cover area on hover/focus.
- [ ] Reuse the existing Your Library hover mechanics where possible, so the cover hover, play overlay, and action animation feel consistent.
- [ ] Make the in-cover **+** add the song to the current playlist using the same handler as the existing far-right plus button.
- [ ] After adding, show a clear saved/added state (`✓`, disabled plus, or existing app pattern) and prevent duplicate adds.
- [ ] Keep row click, hover-play, right-click menu, drag/drop, and mobile/touch behaviour from breaking.
- [ ] Ensure the button remains keyboard-accessible: focus should reveal the action even without mouse hover.

Likely files: `frontend/src/pages/PlaylistDetailPage.tsx`,
`frontend/src/components/cards/TrackRow.tsx`, `frontend/src/components/cards/TrackTile.tsx`,
`frontend/src/components/cards/TrackRowMenu.tsx`, `frontend/src/components/player/PlaylistAddSongs.tsx`,
`frontend/src/stores/playlistStore.ts`, `frontend/src/stores/libraryStore.ts`.

Recommended intelligence / effort:
- **Opus 4.8: med** — mostly a UI placement and event-handling polish task if the existing hover/action pattern can be reused.
- **Codex: medium** — enough to implement cleanly with tests; bump to **high** only if the add-song UI is duplicated across several components or tied to playlist persistence bugs.

Tests (this session):
- [ ] Render test: add-song rows show the **+** action inside/on the cover when hovered or focused.
- [ ] Interaction test: clicking the in-cover **+** adds the track to the current playlist exactly once.
- [ ] Regression test: row navigation/menu/play/drag actions still work and do not accidentally trigger add.

