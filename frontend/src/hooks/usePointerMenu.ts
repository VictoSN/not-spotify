import { useCallback, useEffect, useRef, useState } from 'react'

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
 * Behaviour contract (consistent everywhere):
 *  - Right-click an item → open the menu at the cursor.
 *  - Right-click again (same item) → close the open menu (a true toggle — it does
 *    NOT reopen).
 *  - Right-click a different item → that item's menu opens; the old one is
 *    dismissed by Headless UI's outside-press handling.
 *  - Click outside / Esc → close (handled by Headless UI's Menu).
 *  - Scroll the page → close (the menu is parked at a fixed cursor point, so it
 *    would otherwise drift away from what it points at).
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
  const closedAtRef = useRef(0)
  // Removes the scroll-to-close listeners; non-null only while the menu is open.
  const unbindScrollRef = useRef<(() => void) | null>(null)

  // Bound only while open (so we don't keep dozens of idle scroll listeners on a
  // page full of cards). Scrolling *inside* the menu panel is ignored.
  const bindScrollClose = useCallback(() => {
    if (unbindScrollRef.current) return
    const onScroll = (e: Event) => {
      const target = e.target as Node | null
      if (target instanceof Element && target.closest('[role="menu"]')) return
      closeRef.current?.()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('wheel', onScroll, { capture: true, passive: true })
    window.addEventListener('touchmove', onScroll, { capture: true, passive: true })
    unbindScrollRef.current = () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('wheel', onScroll, true)
      window.removeEventListener('touchmove', onScroll, true)
      unbindScrollRef.current = null
    }
  }, [])

  const openAt = useCallback((x: number, y: number) => {
    if (menuOpenRef.current) {
      // Already open → toggle it shut (and don't reopen).
      closeRef.current?.()
      return
    }
    // A right-click's pointerdown makes Headless close the open menu *before*
    // this contextmenu handler runs (they're separate native events, so React
    // flushes the close between them) — menuOpenRef therefore already reads
    // false. Without this guard the menu would instantly reopen, looking like
    // it never closes. Treat a just-closed menu as the toggle-off.
    if (Date.now() - closedAtRef.current < 300) return
    setCoords({ x, y })
    requestAnimationFrame(() => {
      hiddenBtnRef.current?.click()
      bindScrollClose()
    })
  }, [bindScrollClose])

  const openFromButton = useCallback((e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    openAt(r.left, r.bottom + 4)
  }, [openAt])

  const sync = useCallback((open: boolean, close: () => void) => {
    if (menuOpenRef.current && !open) {
      closedAtRef.current = Date.now()
      unbindScrollRef.current?.()
    }
    menuOpenRef.current = open
    closeRef.current = close
  }, [])

  // Drop any lingering scroll listeners if the menu unmounts while open.
  useEffect(() => () => unbindScrollRef.current?.(), [])

  return { coords, hiddenBtnRef, openAt, openFromButton, sync }
}
