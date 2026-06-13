# Feature Gap Analysis — not-spotify vs Spotify / Apple Music / SoundCloud / YouTube Music

Date: 2026-06-13. Based on a page-by-page pass of the actual codebase (router, all pages, player stack, stores, backend controllers) — not on PROJECT_STATUS alone.

> **Updated 2026-06-13 (same day):** the entire "quick wins" tier was implemented and verified right after this report was written — sleep timer, playback speed, play next, autoplay radio-lite, keyboard shortcuts, share fix, search-by-lyrics, weekly Top 50 charts, library sorting, playlist JSON export. Affected rows below are marked **✅ DONE**, and the roadmap section reflects what's actually left.

Constraint applied throughout: **no paid APIs, licensing, or subscription services**. Anything that requires them is flagged, with free/self-hosted alternatives noted where they exist.

Effort scale: **Low** = under a session · **Medium** = 1–3 sessions · **High** = multi-session/multi-account.

---

## 1. Current feature inventory (what not-spotify has today)

### Home (`/`)
Greeting + quick-pick grid of recent playlists · Trending now · For you today · Recently played · Recommended playlists · New music · Popular artists (each with a "show all" browse page) · hover-hue dynamic background tint · premium promo banner with promo code.

### Search (`/search` + TopBar)
Debounced live suggestions (tracks/artists/albums/playlists) · recent searches (persisted, removable, clear-all) · result tabs (all/songs/artists/albums/playlists) · genre browse grid with filter pills · dedicated mobile search UI.

### Library (sidebar + `/library`)
Resizable/expandable sidebar with filter pills (playlists/artists/albums) and recents sorting · Library page with tabs + counts (playlists, albums, artists, liked songs) · liked songs with "date added" column · create playlist.

### Playlists (`/playlist/:id`)
Create/edit (name, description, cover upload) · delete · visibility public/friends/private (enforced server-side) · **collaborative playlists with invites** · add/remove tracks · "find something for your playlist" panel (per-playlist recommendations + live catalog search) · premium ZIP download · save others' playlists · dominant-color header.

### Album / Track pages
Album: cover-color hero, play all, save, premium ZIP download, track list. Track: hero, like, play count, lyrics (plain + **karaoke synced LRC**: highlight, auto-scroll, click-to-seek, reduced-motion aware), explicit badges.

### Player
Bottom bar: play/pause/skip, seek, shuffle, repeat (off/one/all), volume + mute, PiP toggle, karaoke toggle · Now Playing right panel: resizable/collapsible, queue with premium drag-reorder, artist info + related tracks, album credits, cover-tinted, synced-lyrics card · mobile now-playing sheet · **PiP player** (canvas→video, OS auto enter/exit) · **MediaSession** (OS media keys, lock screen) · 1–5 **star rating** on the playing track · free tier = forced shuffle, no repeat/order control (gated server + client) · play tracking with dedupe + heartbeats.

### Social
Friend search/requests/accept/decline/unfriend · friends-of-friends suggestions + mutual counts · real-time online presence (SignalR) · **Friend Activity rail** (listening-now with equalizer, recently-played with timestamps) · friend profiles with public playlists · 1:1 **chat** (read receipts ✓✓, unread badges, day separators, deep links) · friends-only playlists · collaborative playlists. (E2E chat encryption is designed in `chatEncryption.ts` but not active.)

### Discovery
Trending, for-you, new releases, recents/history page, popular artists, genres, per-playlist recommendations — all self-built on `PlayHistories`.

### Premium / billing
Stripe-hosted checkout (test mode) · plan comparison table · promo code + new-user trial · subscription management in account settings · premium gates: on-demand playback, shuffle/repeat control, queue reorder, downloads (single track + album/playlist ZIP).

### Artist ecosystem
Artist application → admin review flow · artist dashboard: create albums/EPs/singles, upload audio + covers, drag-reorder track numbers, edit title/explicit/lyrics, resubmit rejected work with notes, delete, profile editing (bio, images, social links) · verified badge · auto lyrics fetch at upload (LRCLIB → Lyrics.ovh).

### Admin
Dashboard (visits, active listeners, plays trend, top tracks, pending counts) · CRUD for artists/albums/tracks · approval queue with sorting · rejection/review history (append-only audit) · revoke artist status · dedicated admin login + route guard.

### Settings / account
Light/dark theme · now-playing panel toggle · avatar upload · plan/billing management · artist application status. ⚠️ Quality / normalize / autoplay / crossfade / compact / language toggles exist in the UI but are **localStorage-only — wired to nothing**.

### Platform
Responsive web (mobile nav, tablet) · document titles · error boundaries. No PWA/service worker, no offline, no native/desktop wrapper (desktop is on the roadmap).

---

## 2. Gap analysis by category

Legend: ✅ = realistic free · ⚠️ = realistic with caveats · ❌ = not realistic for this project (paid/licensing/scope).

### 2.1 Playback

| Feature | Platforms that have it | Complexity | Effort | Free path? | Verdict |
|---|---|---|---|---|---|
| Sleep timer | All four | Frontend | Low | n/a | ✅ **DONE** |
| Playback speed control | YTM, Spotify (podcasts), SoundCloud | Frontend (`audio.playbackRate`) | Low | n/a | ✅ **DONE** |
| "Play next" (insert at queue front vs append) | Spotify, Apple, YTM | Frontend | Low | n/a | ✅ **DONE** |
| Autoplay similar music when queue ends | Spotify, Apple, YTM | Both (reuse rec endpoints) | Low–Med | self-built | ✅ **DONE** — same-artist radio-lite; `autoplay` toggle now live |
| Crossfade | Spotify, Apple, YTM | Frontend (2nd audio el or Web Audio) | Medium | n/a | ✅ — dead `crossfade` toggle exists |
| Gapless playback | Spotify, Apple, YTM | Frontend (preload next + Web Audio) | Medium | n/a | ✅ |
| Volume normalization | Spotify, Apple | Both (ffmpeg loudness scan at upload + gain client-side) | Medium | ffmpeg (free) | ✅ |
| Equalizer | Spotify (mobile), YTM | Frontend (Web Audio BiquadFilter) | Medium | n/a | ✅ |
| Quality selection / adaptive streaming | All four | Both (ffmpeg transcodes + hls.js) | High | ffmpeg + hls.js free; ~2–3× storage | ⚠️ — feasible but storage on Supabase free tier is the limit |
| Lossless audio | Apple, Spotify | Both | Medium | FLAC is free | ⚠️ — storage cost; source files are artist uploads anyway |
| Spatial audio (Dolby Atmos) | Apple, YTM | — | — | none | ❌ paid codec licensing + mastered content |
| Cast / Connect (control playback on another device) | Spotify Connect, AirPlay, Chromecast | Both | High | SignalR (already in stack) for own-devices remote | ⚠️ — own-protocol "remote control another logged-in tab" is feasible; Chromecast/AirPlay are not worth it |
| True offline playback | All four (premium) | Both (service worker + Cache API/IndexedDB) | Med–High | n/a | ✅ — natural extension of existing premium downloads |
| Music videos | YTM, Apple | — | — | no content | ❌ content problem, not tech |
| Podcasts | Spotify, Apple, YTM | Both (new entity + RSS ingest) | High | open RSS feeds are free | ⚠️ — technically free; big scope addition |

### 2.2 Discovery & recommendations

| Feature | Platforms | Complexity | Effort | Free path? | Verdict |
|---|---|---|---|---|---|
| Search by lyrics | Spotify | Backend (lyrics already in DB → full-text query) | **Low** | n/a | ✅ **DONE** — "Found in lyrics" section on search |
| Charts page (Top 50, weekly) | Spotify, Apple, YTM | Both (aggregate `PlayHistories`) | Low | n/a | ✅ **DONE** — `/charts` weekly Top 50 |
| Song/artist radio (endless station from a seed) | All four | Backend (genre + co-listen similarity) | Medium | self-built | ✅ |
| Daily mixes / Discover Weekly | Spotify, YTM | Backend (collaborative filtering on `PlayHistories`) | Med–High | self-built (small-data CF is fine) | ✅ — won't match Spotify quality, fine at project scale |
| "Fans also like" related artists | Spotify, Apple | Backend (co-listen matrix) | Medium | self-built | ✅ |
| Year-in-review / Wrapped / Replay | Spotify, Apple, YTM | Both (aggregations + showy UI) | Medium | n/a | ✅ — outstanding demo-day feature |
| New-release / followed-artist notifications | All four | Both (Notifications table **already exists**, no UI) | Medium | n/a | ✅ |
| Editorial/featured playlists | All four | Both (admin-curated + featured flag) | Low | n/a | ✅ |
| Mood/activity tagging & browse | Spotify, Apple, YTM | Both | Low–Med | n/a | ✅ |
| Audio recognition (hum/play to find) | YTM | Both | High | Chromaprint/AcoustID self-hosted | ⚠️ stretch |
| Concert/tour info | Spotify, Apple | Backend + 3rd party | Low–Med | Bandsintown/Songkick need API keys (free tiers exist, approval required) | ⚠️ flag — exists, only if a free key is granted |

### 2.3 Social & sharing

| Feature | Platforms | Complexity | Effort | Free path? | Verdict |
|---|---|---|---|---|---|
| Share links for track/playlist/artist (currently album-only copy) + Web Share API on mobile | All four | Frontend | **Low** | n/a | ✅ **DONE** — track menu shares track URL + native share sheet (playlist/artist menus still pending) |
| Share a track into chat (rich card message) | Spotify (to its DMs), others external | Both (new message type) | Low–Med | n/a | ✅ — you already have chat; nobody else in class will have this combo |
| Link previews (OG meta tags for shared URLs) | All four | Backend (meta endpoint / prerender for crawlers) | Medium | n/a | ✅ |
| Embeddable mini-player (iframe) | SoundCloud, Spotify, YTM | Both | Medium | n/a | ✅ |
| Comments on tracks | SoundCloud, YTM | Both | Medium | n/a | ✅ |
| **Timed comments on the waveform/progress bar** | SoundCloud (signature feature) | Both | Medium | n/a | ✅ — strong differentiator |
| Waveform visualization | SoundCloud | Both (precompute peaks at upload w/ ffmpeg, or wavesurfer.js) | Medium | ffmpeg / wavesurfer.js free | ✅ |
| Follow users (asymmetric, beyond mutual friends) + reposts | SoundCloud, Spotify (follow) | Both (new graph model) | Medium | n/a | ✅ — you have mutual friendship only |
| Blend (shared-taste playlist between two friends) | Spotify | Backend | Medium | n/a | ✅ |
| Group session / Jam / listen-along | Spotify Jam, Apple SharePlay | Both (SignalR sync) | High | SignalR already in stack | ⚠️ — already on your NOT STARTED roadmap; hardest part is drift correction |
| Public user profiles with top artists/tracks | Spotify, Apple | Both | Low–Med | n/a | ✅ |

### 2.4 Library management

| Feature | Platforms | Complexity | Effort | Free path? | Verdict |
|---|---|---|---|---|---|
| **Smart playlists (rule-based: genre = X AND rating ≥ 4…)** | iTunes (signature feature) | Both (rules engine + evaluator) | Medium | n/a | ✅ — pairs perfectly with your existing star ratings, which Spotify doesn't even have |
| Playlist folders | Spotify, iTunes | Both | Low–Med | n/a | ✅ |
| Pin favourites to top of library | Spotify | Both | Low | n/a | ✅ |
| Library sorting (A-Z, creator, recently added) | All four | Frontend | Low | n/a | ✅ **DONE** — Recently added / A-Z / Z-A on all tabs |
| Playlist export/import (JSON/CSV) | iTunes (export) | Both | Low | n/a | ✅ **DONE** (export); import still pending |
| Auto playlist cover mosaic (4 album covers) | Spotify | Frontend (canvas) | Low | n/a | ✅ |
| Duplicate detection in playlists | iTunes | Backend | Low | n/a | ✅ |
| Personal uploads to private locker (100k songs) | YTM, iTunes Match | Both | Medium | tech is free | ⚠️ — Supabase free-tier storage (1 GB) is the real cap; demo-scale only |
| Sync personal library across devices | iTunes Match, YTM | — | — | — | ❌ at real scale (storage); covered at demo scale by the above |

### 2.5 Personalization, accessibility, platform

| Feature | Platforms | Complexity | Effort | Free path? | Verdict |
|---|---|---|---|---|---|
| Keyboard shortcuts (space = play/pause, arrows = seek/skip) | Spotify desktop, YTM | Frontend | **Low** | n/a | ✅ **DONE** — space/arrows/ctrl-arrows/shift-arrows/M/L |
| Voice search | YTM | Frontend (Web Speech API) | Low–Med | free in Chromium | ⚠️ Chrome-only, but cheap and flashy |
| Personal listening stats page (top artists/tracks, minutes) | YTM recap, Spotify (via Wrapped/stats.fm) | Both (you already store everything needed) | Low–Med | n/a | ✅ |
| PWA (installable, offline shell) | YTM is a PWA | Frontend (vite-plugin-pwa) | Medium | free | ✅ — also the cheapest route to "desktop app" |
| Desktop app | Spotify, iTunes, YTM (wrapper) | Tauri/Electron shell | Medium | Tauri free | ✅ — already on roadmap |
| Native mobile apps | All four | — | High | Capacitor free | ⚠️ stretch; responsive web + PWA covers the demo |
| CarPlay / Android Auto / TV / Watch | All four | — | — | — | ❌ out of scope |
| Wire the dead settings toggles (autoplay, crossfade, normalize, quality, compact) | — (parity with your own UI) | Both | Low–Med each | n/a | ⚠️ partial — `autoplay` now live; crossfade/normalize/quality/compact still dead |

### 2.6 Monetization & business

| Feature | Platforms | Complexity | Effort | Free path? | Verdict |
|---|---|---|---|---|---|
| Audio ads between tracks on free tier | Spotify free | Both (self-served "house ads") | Low–Med | self-recorded ad spots, no ad network | ✅ — your premium page already promises "ad-free"; free tier currently has no ads, so the claim is hollow |
| Family / Duo / Student plans | Spotify, Apple, YTM | Both (more Stripe prices, member invites) | Medium | Stripe test mode free | ✅ |
| Artist royalties/payouts | All four | — | High | Stripe Connect demoable in test mode | ❌ for real (legal/licensing); ⚠️ as a test-mode demo with a play-count → payout dashboard |
| Real licensed catalogue | All four | — | — | — | ❌ — fundamental: your model is artist-uploaded content (SoundCloud-like), which is the correct call for a student project |
| Gift cards / merch / ticketing | Spotify, SoundCloud | — | — | — | ❌ scope |

---

## 3. Prioritized roadmap

### ✅ Quick wins — DONE (2026-06-13)
All eight shipped and browser-verified: search by lyrics · share fix (track URL + Web Share) · keyboard shortcuts · sleep timer · playback speed · play next · weekly Top 50 charts · library sorting · playlist JSON export · autoplay radio-lite. (Playlist cover mosaic, duplicate detection, and playlist *import* were the only quick-win items not yet built — small leftovers, folded into medium-term polish below.)

### Medium-term (1–3 sessions each) — IN PROGRESS
1. ✅ **Personal stats page / mini-Wrapped** — DONE (2026-06-13). `/stats`: minutes/plays/unique counts, plays-per-day chart, top artists/genres/tracks, 7/30/365-day toggle. Can be seasoned into a year-end "Wrapped" view later.
2. ✅ **Song radio** — DONE (2026-06-13). `GET /tracks/{id}/radio` blends co-listen similarity + genre overlap + same-artist boost; "Go to song radio" in the track menu. The co-listen matrix here also makes "Fans also like" cheap to add next.
3. ✅ **Playlist import** — DONE (2026-06-13). Library → Import reads an exported JSON and rebuilds the playlist by matching titles to the catalog. (Pairs with the export quick win.)
4. **Notifications center** ← *next up* — ⚠️ no `Notifications` table actually exists yet (the earlier note was wrong); needs a new entity + **migration** (coordinate — migrations on the shared Supabase DB have conflicted before). Surface friend-request + new-release-from-followed-artist + approval events, bell in TopBar.
5. **Smart playlists** — iTunes-style rules over genre/rating/play-count/date-added; differentiates from a plain Spotify clone (pairs with existing star ratings). Needs a rules-storage column → migration.
6. **Crossfade + gapless** via Web Audio (also makes the EQ nearly free afterwards) → wires the dead `crossfade` toggle. Frontend-only but reworks the singleton audio engine; verify carefully.
7. **"Fans also like" related artists** — cheap now that the co-listen matrix exists (radio).
8. **Waveform + timed comments** — ffmpeg peaks at upload, comments pinned to timestamps; the SoundCloud signature no other team will have.
9. **Playlist folders + pinning**; small leftovers: cover mosaic, duplicate detection.
10. **House ads on free tier** + Family plan via extra Stripe test prices.
11. **PWA** — installable + offline cache of downloaded tracks; doubles as your desktop story.
12. **Asymmetric follows + public profiles** (followers/following, top tracks this month).

### Stretch goals
- **Listen-along / Jam** (already on your roadmap) — SignalR room + host clock sync; high effort, very high demo value.
- **Daily mixes** via simple collaborative filtering on `PlayHistories`.
- **Desktop wrapper** (Tauri) — roadmap item; PWA first makes it nearly free.
- **Adaptive streaming / quality selection** — ffmpeg + hls.js, gated by storage budget.
- **Blend playlists**, **embeddable player**, **voice search**.
- **Personal uploads locker** — demo-scale only (storage).

### Not realistic for this project (flagged per the no-paid-services rule)
- **Licensed major-label catalogue** — the defining gap vs all four platforms; artist-upload model is the right substitute.
- **Spatial audio / Dolby Atmos** — paid codec + mastered content.
- **Real ad-network monetization, artist royalties at scale** — legal/financial infrastructure (test-mode Stripe Connect demo is the free approximation).
- **CarPlay/Android Auto/TV/Watch apps**, native iOS/Android at store quality.
- **Concert/tour data** — needs third-party API keys (Bandsintown/Songkick free tiers exist but require approval; revisit only if granted).
- **Shazam-grade audio recognition** — AcoustID/Chromaprint self-hosting exists but is disproportionate effort.

---

## 4. Summary

not-spotify already covers a surprising share of the big four's core: full catalog browsing/search, playlists (incl. collaborative + friends-only — Spotify doesn't have friends-only), karaoke synced lyrics, PiP, OS media integration, star ratings (iTunes-only among the four), a friend activity rail, real-time chat (none of the four have built-in 1:1 chat), an artist supply side with review workflow, and Stripe-gated premium. The genuinely unreachable gaps are all about money and licensing (catalogue, spatial audio, ads/royalties), not engineering.

The highest-leverage observations from the code pass:
1. **Several "features" exist as dead UI** (autoplay, crossfade, normalize, quality settings) — wiring them is cheap and removes embarrassment risk in grading.
2. **Your data already pays for features you haven't built**: lyrics in DB → lyrics search; PlayHistories → charts, stats page, Wrapped, radio; Notifications table → notification center.
3. **Differentiation beats parity**: timed comments (SoundCloud), smart playlists (iTunes), and share-to-chat exploit assets you uniquely already have, rather than chasing Spotify's ML.

Suggested order: ~~quick wins first~~ (done 2026-06-13), then **stats page → notifications → song radio → smart playlists → crossfade/gapless**, keeping listen-along as the end-of-term centerpiece if time allows.
