# TEST_PLAN.md — 3-way QA split + storage notes

Companion to [PROJECT_STATUS.md](PROJECT_STATUS.md) (status/bugs) and [FEATURE_GAP_REPORT.md](FEATURE_GAP_REPORT.md) (roadmap).

---

## 0. Before you start (everyone)

**Run the stack:** double-click [`dev.cmd`](dev.cmd) (or `./dev.sh` in Git Bash). Backend on `https://localhost:7045`, frontend on `http://localhost:5173`. Stripe listener only needed for Part C billing.

**Seed logins** (dev-shortcut buttons on the login page in dev mode):

| Account | Email | Password | Role |
|---|---|---|---|
| alex | `alex@example.com` | `Password123!` | Admin + Artist + **Premium** |
| testing1 | `testing1@example.com` | `Testing1` | User (free) |
| testing2 | `testing2@example.com` | `Testing2` | User (free) |

**Shared DB warning:** everyone writes to the same Supabase DB. Coordinate destructive tests (deleting albums/tracks/playlists) in chat. Prefer creating your own throwaway data.

**Cross-cutting checks (do these in your own area, don't assume someone else did):**
- **Free vs Premium** — log in as `testing1` (free) AND `alex` (premium); free tier should force shuffle, block repeat/queue-reorder/downloads.
- **Responsive** — resize to mobile width (≤640px) and tablet; check the mobile nav + mobile now-playing sheet.
- **Light & dark theme** — toggle and look for unreadable text / wrong colors.
- **Console** — keep DevTools open; report any red errors (ignore the known `<img src="">` warning and the SignalR "stopped during negotiation" reconnect noise — already logged).
- **Bug report format:** `[Part X] page/flow · steps · expected vs actual · screenshot · console error`. Add to PROJECT_STATUS "Known issues" or the team tracker.

---

## Part A — Playback, Player, Discovery & Lyrics
**Owner: ________**

### Features in scope
Audio playback, bottom player bar, Now Playing panel + queue, PiP, sleep timer, playback speed, play-next, autoplay, keyboard shortcuts, star ratings, karaoke/lyrics, voice search, and all discovery surfaces (Home, charts, radio, daily mixes, for-you, trending, new music, recents, genres).

### Key flows to test
1. **Transport:** play/pause, next/prev, seek by clicking the progress bar, volume, mute. Repeat off/one/all (premium). Shuffle.
2. **Queue:** add-to-queue, play-next ordering, premium drag-reorder; "now playing" + up-next correct.
3. **Player extras:** sleep timer (15/30/45/60 → pauses when it elapses), playback speed cycler (0.75–2×, audio actually changes speed), star rating writes/persists.
4. **Keyboard shortcuts:** space / ← → / Ctrl+← → / Shift+↑ ↓ / M / L, and `?` opens the help overlay. Confirm they're ignored while typing in a search box.
5. **Lyrics/karaoke:** open lyrics on a playing track → active line highlights + auto-scrolls + click-a-line seeks. Navigate away → lyrics overlay closes (regression check for the old bug).
6. **Voice search** (Chrome/Edge): mic button → speak a title → it searches without a trailing period.
7. **Discovery:** Home rows load; "Made for you" daily mixes play; `/charts` Top 50; "Go to song radio" from a track menu loads a station; "Fans also like" on an artist page; search-by-lyrics shows a "Found in lyrics" section.

### Known-fragile spots to probe hard
- **PiP** (Chrome/Edge): open it from the player bar → switch tabs/windows (should **stay** open) → play/pause and **mute** buttons should control the real audio. ⚠️ **Known broken:** fast-forward/rewind-10s does nothing (logged). Confirm play/pause/mute DO work.
- **Pause then navigate** to another page and back — must **stay paused** (old bug, fixed; re-verify).
- Free-tier playback should start from a **random** track (forced shuffle), not the one clicked.

---

## Part B — Library, Playlists, Search & Social
**Owner: ________**

### Features in scope
Library page (+ sorting), playlists (create/edit/delete, visibility, collaborative, cover mosaic, export/import, track sorting), liked songs, follow artists, search + recent searches + browse, friends (requests/suggestions/presence), Friend Activity rail, chat, friends-only playlists.

### Key flows to test
1. **Library:** filter chips (playlists/albums/artists/liked) + counts; sort (recent / A-Z / Z-A) across all tabs.
2. **Playlist CRUD:** create, rename, edit description, upload a cover, delete. Visibility public / friends / private — confirm a **private** playlist is 403 to a non-friend (test with two accounts).
3. **Collaborative playlists:** invite a friend, both can add/remove tracks.
4. **Cover mosaic:** a coverless playlist with ≥4 distinct-album tracks shows a 2×2 mosaic; with a custom cover shows the cover.
5. **Export/Import:** Export a playlist to JSON → Import it back (Library → Import) → matched-track count is sensible; fake tracks are skipped.
6. **Track sorting** on a playlist: Custom / Title / Artist / Album / Date / Duration reorders both the list and what plays.
7. **Add/remove tracks** via the `…` menu; "already in playlist" should be rejected (no duplicates).
8. **Search:** debounced suggestions in the top bar; result tabs; recent searches add/remove/clear.
9. **Social:** send/accept/decline friend request (two accounts), online dot updates, Friend Activity rail shows listening-now (play something as the friend) vs recently-played; suggestions + mutual counts.
10. **Chat:** send messages between two accounts; unread badge; read receipts; deep-link `/messages?u=<id>`.

### Known-fragile spots to probe hard
- Navigating **Library → a playlist** (the page once crashed on unsynced data — re-verify it loads).
- Liked Songs "date added" column + ordering.
- Friend Activity timestamps ("2 min", "1 hr") update; only online friends show "listening now".
- Two-browser test for anything real-time (presence, chat, collaborative playlists).

---

## Part C — Artist, Admin, Auth, Billing & Platform
**Owner: ________**

### Features in scope
Auth (signup/login/logout/refresh), account & settings pages, artist application + dashboard, admin panel (dashboard/CRUD/approvals/revoke/history), Stripe premium checkout + cancel, premium gating (downloads), and platform basics.

### Key flows to test
1. **Auth:** sign up a new user; log in/out; refresh persistence (reload keeps you logged in after a moment); guest → "log in to continue" prompts.
2. **Account/Settings:** edit profile, upload avatar; theme + now-playing toggles; confirm the settings that are wired (autoplay, compact library) actually do something, and note which are still cosmetic (crossfade/normalize/quality).
3. **Artist dashboard** (alex — reach via **profile icon → Artist Dashboard** at the bottom):
   - Album/release CRUD; **add track** + audio upload; **drag-reorder** track numbers; edit title/explicit/lyrics; delete; resubmit a rejected item.
   - Album header row expands/collapses; the action buttons (edit/delete/download/history) are aligned (regression check for the nesting bug).
4. **Artist application flow:** apply as a non-artist user → it appears in the admin queue.
5. **Admin** (alex → profile → Admin Dashboard): stats dashboard; artists/albums/tracks CRUD; approval queue (approve/reject with note); revoke artist status; review/rejection history; `/admin/login` route guard (a non-admin hitting `/admin` is redirected).
6. **Billing (needs Stripe CLI):** upgrade to premium with test card `4242 4242 4242 4242` → account becomes premium after the webhook; cancel subscription → reverts to free.
7. **Premium gating:** as free, downloads show a Premium badge + redirect; as premium, single-track + album/playlist ZIP downloads work.

### Known-fragile spots to probe hard
- Deleting an album that has tracks (was a bug — should cascade now).
- Premium download cascading to individual songs.
- Admin chat/notification badge not showing when the conversation is already open.
- Upload errors should surface a real message (not silent failure).
- The plan change should take effect **without** a manual reload (token refresh).

---

## Storage — answer to "is everything left blocked by paid APIs / storage?"

**No.** Most of the remaining roadmap is free to build — see [FEATURE_GAP_REPORT.md](FEATURE_GAP_REPORT.md) §3. Genuinely free, high-value items still open:
- **Listen-along / Jam** (SignalR is already in the stack) — the best demo centerpiece.
- **Notifications center**, **Smart playlists**, **Asymmetric follows** — each needs only a small DB migration (no money, no storage).
- **Crossfade / gapless / EQ**, **PWA** (installable + offline shell) — pure frontend.
- **Waveform + timed comments** — ffmpeg is free; the peaks JSON is tiny.
- **House ads on the free tier** — self-recorded spots, no ad network.

**Only these are truly blocked by money/storage** (the "Not realistic" list): licensed major-label catalogue, lossless/hi-res + adaptive quality (transcoding storage), personal-upload locker, podcasts (content), spatial audio, real ad networks / royalties, native + CarPlay/Auto apps, concert-data APIs, Shazam-grade recognition.

### Free / cheap larger object storage (for when audio outgrows Supabase's 1 GB)

The storage layer is already abstracted behind `IStorageService` (5 methods: `GetAudioUrl`, `GetPublicUrl`, `Upload`, `Delete`, `Read`) with Supabase + Local implementations — so adding another provider is a single new class + DI wiring.

| Option | Free tier | Egress (the cost that kills streaming) | S3-compatible? | Notes |
|---|---|---|---|---|
| **Cloudflare R2** ⭐ | 10 GB storage, 1M Class-A + 10M Class-B ops/mo | **$0 — always free** | ✅ Yes | Best fit: no egress fees ever, so streaming stays free; S3 API = trivial later swap to AWS S3. |
| **Backblaze B2** | 10 GB storage | First 3× storage/day free; **free via Cloudflare CDN** | ✅ Yes | Close second; pairs with Cloudflare for free bandwidth. |
| **Cloudinary** | ~25 GB storage/bandwidth credits | Included in credits | ⚠️ own API | Handles audio + transforms; not S3-API. |
| **Supabase (current)** | 1 GB storage | 2 GB/mo | partial | Fine for the demo dataset; the ceiling you're hitting. |
| **Wasabi** | none (trial) | $0 egress | ✅ Yes | Cheap ($6.99/TB/mo) but no free tier — skip for now. |

**Recommendation:**
1. **Use Cloudflare R2 now (free).** 10 GB covers the dev catalogue, and **zero egress** means every play (which downloads the file) costs nothing — Supabase and S3 both charge for that.
2. **It's S3-compatible**, so write the adapter once with the AWS SDK pointed at R2's endpoint. When you move to real S3 at the end, you only change the endpoint URL + keys — **no code rework**, and you've already validated the S3 code path. This also protects the **$50 budget**: S3's egress (~$0.09/GB) is the line item that blows budgets on streaming workloads; R2 avoids it entirely. (If S3 isn't a hard course requirement, R2 could even be the final home.)
3. Keep the abstraction: add `R2StorageService : IStorageService` and select it via config, exactly like the Supabase/Local split today.
