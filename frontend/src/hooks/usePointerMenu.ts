import { useCallback, useRef, useState } from 'react'

/**
 * The single source of truth for the app's right-click ("context") menu
 * behaviour, shared by every pointer-anchored menu (TrackRowMenu, AlbumMenu,
 * ArtistMenu, PlaylistRowMenu).
 *
 * Each menu is a Headless UI `Menu` whose real trigger is an invisible button
 * portaled to <body> and parked under the cursor; clicking it spawns the panel
 * exactly at the pointer (immune to transformed ancestors, and Headless UI's
 * `anchor` keeps it inside the viewport — flipping/shifting near the right or
 * bottom edge).
 *
 * Behaviour contract (consistent everywhere, matching Spotify):
 *  - Right-click an item → open the menu at the cursor.
 *  - Right-click again (same item, anywhere) → close the open menu and reopen it
 *    at the NEW cursor position. It never "does nothing".
 *  - Right-click a different item → that item's menu opens; the old one is
 *    dismissed by Headless UI's outside-press handling.
 *  - Click outside / Esc → close (handled by Headless UI's Menu).
 */
export interface PointerMenuController {
  coords: { x: number; y: number }
  /** Ref for the invisible, body-portaled Headless `MenuButton`. */
  hiddenBtnRef: React.RefObject<HTMLButtonElement | null>
  /** Open (or reopen) the menu at a viewport coordinate — wire to `onContextMenu`. */
  openAt: (x: number, y: number) => void
  /** Open the menu just below a visible trigger button (the "…" affordance). */
  openFromButton: (e: React.MouseEvent) => void
  /** Call once inside the Headless `Menu` render prop to sync live open/close. */
  sync: (open: boolean, close: () => void) => void
}

export function usePointerMenu(): PointerMenuController {
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: -9999, y: -9999 })
  const hiddenBtnRef = useRef<HTMLButtonElement>(null)
  const menuOpenRef = useRef(false)
  const closeRef = useRef<(() => void) | null>(null)

  const openAt = useCallback((x: number, y: number) => {
    setCoords({ x, y })
    if (menuOpenRef.current) {
      // Already open: close, then reopen at the new spot on a later frame (once
      // the close has flushed) so a second right-click is never a no-op.
      closeRef.current?.()
      requestAnimationFrame(() => requestAnimationFrame(() => hiddenBtnRef.current?.click()))
    } else {
      requestAnimationFrame(() => hiddenBtnRef.current?.click())
    }
  }, [])

  const openFromButton = useCallback((e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    openAt(r.left, r.bottom + 4)
  }, [openAt])

  const sync = useCallback((open: boolean, close: () => void) => {
    menuOpenRef.current = open
    closeRef.current = close
  }, [])

  return { coords, hiddenBtnRef, openAt, openFromButton, sync }
}
