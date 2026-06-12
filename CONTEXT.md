# CONTEXT.md
Read this file FIRST before exploring the codebase. It exists to save tokens by avoiding repeated discovery.

## Project
Spotify-clone music streaming platform (web app). Built collaboratively across multiple Claude/Fable sessions and 3 different Pro accounts. Token budget per session is limited — work efficiently, commit often, don't over-explore.

## Tech Stack
> ⚠️ FILL THIS IN ONCE (first session to run should populate this section, then update this file):
- Frontend: [framework, e.g. React/Next.js/Vue + state management]
- Backend: [framework, e.g. Express/Django/Laravel]
- Database: [e.g. PostgreSQL/MySQL/MongoDB] + ORM if any
- Auth: [e.g. JWT/session-based/OAuth provider]
- File storage (audio/images): [e.g. S3/local/Cloudinary]
- Styling: [e.g. Tailwind/CSS modules/styled-components]

## Folder Structure
> ⚠️ FILL THIS IN — high-level only, don't dump full tree:
```
/src or /app
  /components
  /pages or /routes
  /admin        <- relevant for Account 2
  /api or /server
  /models or /schema
```

## Database Schema (summary)
> ⚠️ FILL THIS IN — table/collection names + key relationships only:
- Users (id, role: free/premium/artist/admin, ...)
- Tracks (id, album_id, artist_id, file_url, ...)
- Albums (id, artist_id, ...)
- Playlists (id, user_id, ...)
- PlaylistTracks / Favorites (join tables)
- Friends (user_id, friend_id, status)
- Notifications / Messages
- ArtistApplications (status: pending/approved/rejected, history)

## Naming Conventions
- [e.g. camelCase for JS variables, snake_case for DB columns]
- [Component file naming pattern]
- [API route naming pattern]

## Status Tracking
- `PROJECT_STATUS.md` (repo root) — single source of truth for what's done/in-progress/broken
- Every session MUST read PROJECT_STATUS.md first and update it before ending
- Do NOT re-verify features marked ✅ in PROJECT_STATUS.md unless explicitly assigned to fix a related bug

## Cross-Account Coordination
- Account 1 = Bug Fixes (isolated files: download logic, album/track delete, notification badge, artist dashboard tab CSS)
- Account 2 = Admin Restructure (isolated to /admin route + auth middleware + admin layout)
- Account 3 = Stretch Features (friend activity feed, dynamic theming from album art)

If your session needs to touch a file owned by another account's scope, note it in PROJECT_STATUS.md under "NOTES FOR NEXT SESSION" instead of editing it, unless the other account's work is already merged.

## End-of-Session Reporting Format
Every session ends with:
```
## COMPLETED THIS SESSION
- ...

## STILL INCOMPLETE
- ...

## CURRENT BUGS
- ...

## NOTES FOR NEXT SESSION
- ...
```
