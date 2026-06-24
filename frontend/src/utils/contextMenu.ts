import type { TrackRowMenuHandle } from '@/components/cards/TrackRowMenu'

/**
 * Opens a TrackRowMenu at the pointer location (Spotify-style) on right-click,
 * via the menu's imperative `openAt` handle. The menu owns its own invisible,
 * body-portaled trigger and parks it at the cursor itself.
 */
export function openMenuAtPointer(
  e: React.MouseEvent,
  ref: React.RefObject<TrackRowMenuHandle | null>,
) {
  e.preventDefault()
  ref.current?.openAt(e.clientX, e.clientY)
}
