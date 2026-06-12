# CONTEXT.md
Read this file FIRST before exploring the codebase. It exists to save tokens by avoiding repeated discovery.

## Project
Spotify-clone music streaming platform (web app). Built collaboratively across multiple Claude/Fable sessions and 3 different Pro accounts. Token budget per session is limited — work efficiently, commit often, don't over-explore.

## Tech Stack
- Frontend: React 18 + TypeScript + Vite + Zustand (state) + React Router + Tailwind CSS + Heroicons
- Backend: ASP.NET Core 8 (C#) + Entity Framework Core 8
- Database: PostgreSQL hosted on Supabase, accessed via EF Core. `MigrateAsync()` runs on backend startup
- Auth: ASP.NET Identity + JWT Bearer (access + refresh tokens). SignalR uses `?access_token=` on `/hubs/*`
- File storage: Supabase Storage (REST API at `/storage/v1/object/...`). LocalStorage fallback if `SupabaseStorage:Url` is empty. Credentials live in `dotnet user-secrets` and are now force-loaded regardless of env
- Styling: Tailwind CSS with custom CSS variables (`text-primary`, `bg-surface`, `bg-elevated`, `text-accent`, etc.)
- External APIs: LRCLIB → Lyrics.ovh chain for lyrics (no API keys needed)
- Payments: Stripe (subscription/premium tier)

## Folder Structure
```
/backend/src/NotSpotify.Api
  /Controllers      — TracksController, MeController, AdminController, PlaylistsController, AuthController, FriendsController, ...
  /Models           — EF entities: Track, Album, Artist, Playlist, ApplicationUser, ArtistApplication, Friendship, ...
  /Dtos             — ResourceDtos.cs (TrackDto, AlbumDto, PlaylistDto, LyricsDto, LrclibResponse, ...) + AdminDtos.cs
  /Services         — MediaMapper, IStorageService (Supabase + Local impls), LyricsService, TokenService, StripeBillingService
  /Data             — AppDbContext, DbSeeder
  /Migrations       — EF migrations (auto-applied on startup)
  /Hubs             — SignalR (PresenceHub)
  /Properties       — launchSettings.json (Development env)
  Program.cs        — DI wiring, JWT setup, storage selection (Supabase vs Local)
  appsettings.json  — non-secret config; secrets via `dotnet user-secrets`

/frontend/src
  /components
    /player          — LyricsView, AudioPlayer, ...
    /cards           — TrackRow, TrackCard, AlbumCard, ArtistCard, ...
    /ui              — Button, Spinner, ...
  /pages             — ArtistDashboardPage, TrackDetailPage, PlaylistDetailPage, AdminPage, ...
  /services          — api.ts (axios), trackService, adminService, ...
  /stores            — Zustand stores (authStore, playerStore, ...)
  /router            — Route definitions
  /types             — Track, Album, Artist, User, ...
  /hooks             — useDominantColor, ...
```

## Database Schema (summary)
- `AspNetUsers` (Identity table): Id (Guid), Email, Name, Plan (free/premium), Country, AvatarKey/Url, ArtistId nullable
- `AspNetRoles` / `AspNetUserRoles`: Admin, Artist roles
- `Artists`: Id, Name, Bio, ImageKey/Url, HeaderImageKey/Url, Verified, IsRevoked, RevocationNote, social links
- `Albums`: Id, Title, Type (album/single/ep), ArtistId, ReleaseDate, CoverKey/Url, Status (pending/approved/rejected), ReviewNote
- `Tracks`: Id, Title, AlbumId, ArtistId, AudioKey/Url, DurationMs, TrackNumber, Explicit, **Lyrics** (text, nullable, cached), Status, ReviewNote, PlayCount, RatingSum/Count
- `TrackGenres` / `Genres`: many-to-many
- `Playlists`: Id, Name, OwnerId, IsPublic, Visibility (public/friends/private), CoverKey/Url
- `PlaylistTracks`: PlaylistId, TrackId, Position, AddedAt, AddedByUserId
- `UserSavedTracks` / `UserSavedAlbums` / `UserSavedPlaylists`: liked content
- `TrackRatings`: UserId, TrackId, Rating (1–5)
- `PlayHistories`: UserId, TrackId, PlayedAt (drives recents/trending/for-you)
- `Friendships`: RequesterId, AddresseeId, Status (Pending/Accepted/Blocked)
- `ArtistApplications`: UserId, DisplayName, Bio, Status, ReviewNote
- `ReviewHistories`: append-only audit (entity, action: approved/rejected/resubmitted, note, reviewer, timestamp)
- `RecentSearches`, `Notifications`, `Messages` (chat)

## Naming Conventions
- C#: PascalCase everywhere (classes, methods, properties, even DB columns — EF Core uses property names directly so columns are `"Title"`, `"PlayCount"`, etc., quoted in raw SQL)
- TypeScript: camelCase for variables/functions, PascalCase for components and types/interfaces
- API routes: kebab-case (`/me/artist-tracks`, `/tracks/{id}/lyrics`)
- DB joins: EF queries quote identifiers with `"` in raw SQL (Postgres requires this for PascalCase)
- Storage keys: `audio/{guid}.ext`, `covers/{guid}.ext`, `images/artists/{guid}.ext`, `avatars/{userId}/{guid}.ext`

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
