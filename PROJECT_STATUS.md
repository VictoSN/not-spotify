# PROJECT_STATUS.md
Single source of truth for feature/bug status. Every session reads this FIRST and updates it LAST.

Last updated: 2026-06-12 by Account 3 (lyrics + storage + edit UI)

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

---

## 🔄 IN PROGRESS

### Account 1 — Bug Fixes
- [ ] Bug 1: Premium playlist/album download doesn't cascade to individual tracks
- [ ] Bug 2: Cannot delete album without deleting tracks first
- [ ] Bug 3: Chat notification badge appears even when conversation is open (admin)
- [ ] UI Bug 4: Artist dashboard tab padding inconsistent
- [ ] UI Bug 5: Header blocks library tooltip

### Account 2 — Admin Restructure
- [ ] Task 1: Restructure admin site into sidebar/topbar admin panel layout
  - [ ] Inventory existing admin pages/routes (list below once done)
  - [ ] Build layout shell
  - [ ] Migrate: Statistics dashboard
  - [ ] Migrate: Approval table
  - [ ] Migrate: Revoke artist status
  - [ ] Migrate: Rejection history
- [ ] Task 2: Move admin login to dedicated `/admin/login` route + guard middleware

### Account 3 — Stretch Features
- [ ] Task 1: "What your friends are listening to" feed
- [ ] Task 2: Dynamic theming from album art dominant color

---

## ❌ NOT STARTED
- Karaoke feature (like Spotify)
- Desktop app wrapper
- "Listen with friends" LIVE synced playback
- Expanded premium customization options
- Full library UI rehaul to match Spotify

---

## 🐛 CURRENT BUGS
| # | Bug | Status | Owner |
|---|-----|--------|-------|
| 1 | Premium download doesn't cascade to individual songs in playlist/album | Open | Account 1 |
| 2 | Can't delete album without deleting tracks first | Open | Account 1 |
| 3 | Notification still appears when chat/messages already open (admin) | Open | Account 1 |
| 4 | Artist dashboard tabs have inconsistent padding/width | Open | Account 1 |
| 5 | Header blocks library tooltip | Open | Account 1 |

---

## 📝 SESSION LOG
Each session appends an entry here (most recent on top).

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