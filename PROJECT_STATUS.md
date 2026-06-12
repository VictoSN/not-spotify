# PROJECT_STATUS.md
Single source of truth for feature/bug status. Every session reads this FIRST and updates it LAST.

Last updated: [DATE] by [ACCOUNT]

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

### [DATE] — Account [N] — [Brief title]
**Completed:**
- ...

**Still incomplete:**
- ...

**New bugs found:**
- ...

**Notes for next session:**
- ...

---
<!-- New entries go above this line -->