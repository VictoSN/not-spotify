/** Any menu that can be parked + opened at a pointer location via an imperative handle. */
export interface PointerMenuHandle {
  openAt: (x: number, y: number) => void
}

const SIDEBAR_INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[draggable="true"]',
  '[data-sidebar-interactive="true"]',
].join(',')

/** True only for unhandled, unselected blank space inside the sidebar library body. */
export function isSidebarBlankContextTarget(
  target: EventTarget | null,
  defaultPrevented = false,
  selectedText = typeof window === 'undefined' ? '' : window.getSelection()?.toString() ?? '',
): boolean {
  if (defaultPrevented || selectedText.trim()) return false
  if (!(target instanceof Element)) return false
  if (!target.closest('[data-sidebar-empty-space="true"]')) return false
  return !target.closest(SIDEBAR_INTERACTIVE_SELECTOR)
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
