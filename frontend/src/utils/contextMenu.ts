/** Any menu that can be parked + opened at a pointer location via an imperative handle. */
export interface PointerMenuHandle {
  openAt: (x: number, y: number) => void
}

/**
 * Shared Spotify-like sizing for every pointer/right-click menu panel.
 *
 * `overflow-visible!` + `max-h-none!` both override inline styles Headless UI's
 * `anchor` size-middleware injects (`overflow: auto` and a clamped `max-height`).
 * The overflow override lets the "Add to playlist" flyout escape the panel box;
 * the max-height override stops the panel from shrinking its `bg-elevated` box
 * when it flips upward into tight space — without it, the lower items (Share,
 * etc.) spill out below the background and appear to float (bug #4).
 */
export const CONTEXT_MENU_PANEL_CLASS =
  'z-[1000] w-64 origin-top overflow-visible! max-h-none! rounded-md bg-elevated py-1.5 text-sm font-normal leading-5 shadow-2xl ring-1 ring-primary/10 focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[1.5]'

/** Shared row rhythm for pointer/right-click menu actions. */
export const CONTEXT_MENU_ITEM_CLASS =
  'flex min-h-10 w-full cursor-pointer items-center gap-3 px-3 py-2 text-left font-normal text-primary transition-colors hover:bg-primary/10 data-[focus]:bg-primary/10 disabled:cursor-default disabled:opacity-70'

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
