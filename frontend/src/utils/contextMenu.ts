/** Any menu that can be parked + opened at a pointer location via an imperative handle. */
export interface PointerMenuHandle {
  openAt: (x: number, y: number) => void
}

/**
 * Opens a pointer-anchored menu (Spotify-style) on right-click, via the menu's
 * imperative `openAt` handle. The menu owns its own invisible, body-portaled
 * trigger and parks it at the cursor itself.
 *
 * Works for any menu exposing a {@link PointerMenuHandle} (TrackRowMenu,
 * PlaylistRowMenu, …).
 */
export function openMenuAtPointer(
  e: React.MouseEvent,
  ref: React.RefObject<PointerMenuHandle | null>,
) {
  e.preventDefault()
  ref.current?.openAt(e.clientX, e.clientY)
}
