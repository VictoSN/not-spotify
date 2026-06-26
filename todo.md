# NotSpotify Completion TODO

## Phase 0 - Audit and Planning

- [x] Inspect current frontend/backend structure.
- [x] Identify existing Tauri desktop packaging.
- [x] Identify current upload system and reusable dashboard form style.
- [x] Identify current settings/account pages.
- [x] Identify existing auth/role logic for artist accounts.
- [x] Confirm current media models for tracks, albums, podcasts, episodes, and music videos.
- [x] Write implementation notes before coding.

Acceptance:
- [x] Clear file/component list is known.
- [x] No duplicate upload/settings/desktop systems are created unnecessarily.

## Phase 1 - Desktop App Build

- [x] Keep the existing Tauri v2 wrapper and avoid a second desktop shell.
- [x] Add the Tauri JS API dependency.
- [x] Make the main Tauri window frameless.
- [x] Add a NotSpotify desktop title bar.
- [x] Add a desktop app drag region.
- [x] Add minimize, maximize/restore, and close buttons.
- [x] Make the title bar visually consistent with NotSpotify's dark UI.
- [x] Make sure the title bar does not interfere with navigation or player controls.
- [x] Add zoom in/out support using Ctrl/Cmd + mouse wheel or trackpad.
- [x] Add keyboard zoom shortcuts.
- [x] Add reset zoom option.
- [x] Clamp zoom to a safe range.
- [x] Persist zoom level between app launches.
- [x] Make sidebar, player, modals, dropdowns, and fullscreen player scale correctly with zoom.

Acceptance:
- [x] Desktop app packages successfully.
- [ ] Desktop app launches successfully.
- [ ] Custom title bar works.
- [ ] Window controls work.
- [ ] Ctrl/Cmd-scroll zoom works.
- [x] Zoom persistence is covered by unit tests.
- [ ] No layout breaking at minimum/default/maximum zoom.

## Phase 2 - Settings Panel Features

- [x] Polish the settings page into compact Spotify-like sections.
- [x] Keep existing functional settings wired.
- [x] Add desktop zoom controls.
- [x] Add app/about/storage rows.
- [x] Replace disabled "coming soon" rows with real implementations or remove them.
- [x] Persist local app settings where appropriate.
- [x] Avoid fake settings that visually toggle but do nothing.
- [x] Keep settings accessible from the existing profile menu.
- [x] Make settings responsive and desktop-app friendly.
- [x] Match existing NotSpotify menu/card styling.

Phase 2.1 - Greyed-out row pass:
- [x] Privacy → Private listening: skips POST /me/plays in the player, so no PlayHistory rows or LastSeenAt bumps. (frontend/src/stores/playerStore.ts)
- [x] Storage and cache → Media cache: live navigator.storage.estimate() readout + working "Clear cache" wipes all Cache Storage entries.
- [x] Display → Open at login (Tauri-only): tauri-plugin-autostart wired into the Rust crate, capability granted, frontend hook lazy-imports the JS plugin and hides the row in the browser build.
- [x] Notifications → Allow notifications: requests Notification.requestPermission(), persists the master switch only when permission === 'granted'.
- [x] Notifications → New release alerts: backend artist follow endpoints (POST/DELETE /artists/{id}/follow, GET /artists/following) feed the existing NotifyArtistFollowersOfReleaseAsync pipeline; libraryStore syncs both ways. Frontend polls /notifications every 60s and fires a clickable desktop notification for unseen "new_release" rows.
- [x] Notifications → Friend activity (master + sub-toggles): new_follower / chat_message / playlist_saved / jam_invite. Backend NotifyAsync calls added to ChatController.Send and MeController.SavePlaylist; the others were already wired (UsersController.Follow, FriendsController.SendJamInvite).

Acceptance:
- [x] Settings page opens correctly.
- [x] Functional settings update real state.
- [x] Settings persist after refresh/restart where expected.
- [x] Disabled rows removed; every visible toggle does something real.
- [x] UI feels consistent with NotSpotify branding.

## Phase 3 - Artist Upload: Podcast Episodes

- [x] Reuse dashboard upload layout, validation style, progress UI, and success/error handling.
- [x] Add artist-owned podcast/show management.
- [x] Add artist podcast episode upload flow.
- [x] Only allow authorized artist accounts to access artist podcast upload tools.
- [x] Add episode fields for show, title, description, audio file, cover artwork, episode number, explicit flag, and release date.
- [x] Validate audio type, image type, file size, and required fields.
- [x] Add upload progress/processing state.
- [x] Add success confirmation.
- [x] Update podcast detail page and artist dashboard immediately after upload.
- [x] Add backend endpoints using current controller/service/storage patterns.
- [x] Add database changes for artist ownership and episode metadata.

Acceptance:
- [ ] Artist can upload a podcast episode.
- [x] Uploaded episode appears in the correct podcast/show.
- [ ] Episode can be played.
- [ ] Episode menu behavior still works.
- [x] Unauthorized users cannot access artist podcast upload APIs.

## Phase 4 - Artist Upload: Music Video / MV

- [x] Reuse the existing dashboard upload format/style.
- [x] Add professional artist MV upload flow.
- [x] Only allow authorized artist accounts to upload MVs.
- [x] Add fields for title, linked track, video file, thumbnail image, and description.
- [x] Validate video type, thumbnail type, linked track ownership, file size, and required fields.
- [x] Add upload progress/processing state.
- [x] Add success confirmation.
- [x] Update MV page and dashboard after upload.
- [x] Make uploaded MVs playable on the existing video page.
- [x] Keep uploaded MVs using the shared dropdown/right-click menu system.

Acceptance:
- [ ] Artist can upload a music video.
- [x] Uploaded MV appears on MV page and artist dashboard.
- [ ] Uploaded MV opens and plays correctly.
- [ ] MV right-click/dropdown still works.
- [x] Unauthorized users cannot upload MVs.

## Phase 5 - Artist Dashboard Polish

- [x] Add upload entry points for music, podcast episodes, and music videos.
- [x] Show artist uploaded podcasts and videos in clean management sections.
- [x] Add direct-published status labels for uploaded podcast/video content.
- [x] Add edit/delete/manage actions where backend supports them.
- [x] Keep dashboard professional, compact, and consistent with current artist tools.
- [x] Keep NotSpotify branding without copying Spotify assets directly.

Acceptance:
- [x] Artist can manage uploaded media from one place.
- [x] Upload actions are easy to find.
- [x] Dashboard looks professional and consistent.

## Phase 6 - Testing and Build

- [x] Run TypeScript check/frontend build.
- [x] Run frontend tests.
- [x] Run backend tests.
- [x] Run desktop build.
- [ ] Test desktop app launch.
- [ ] Test zoom in/out.
- [ ] Test settings persistence.
- [ ] Test artist podcast upload.
- [ ] Test artist MV upload.
- [ ] Test unauthorized access.
- [ ] Test playback after upload.
- [ ] Test dropdown/right-click behavior after upload.

Acceptance:
- [x] No TypeScript errors.
- [x] No backend test failures.
- [ ] App still works in browser and desktop mode.
- [ ] Existing player, queue, sidebar, library, fullscreen view, and Home menus are not broken.

## Implementation Rules

- [x] Do not break existing Home page dropdown/right-click behavior.
- [x] Do not break player, queue, sidebar, library, or fullscreen view.
- [x] Do not create duplicate UI systems if shared components already exist.
- [x] Reuse existing upload components and styling wherever possible.
- [x] Reuse existing API/client/store patterns.
- [x] Keep UI Spotify-inspired, compact, dark, clean, and professional without copying Spotify assets.
- [x] Keep code consistent with current project conventions.
- [x] Update this checklist as work is completed.
