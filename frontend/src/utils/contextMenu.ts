/**
 * Opens a Headless UI menu at the pointer location (Spotify-style), instead of anchored
 * to its trigger button. It parks the menu's (invisible) trigger button under the cursor
 * as a 0×0 fixed element, then clicks it so the menu spawns there. The inline styles are
 * reset when the menu closes (see MenuAnchorReset in TrackRowMenu).
 */
export function openMenuAtPointer(
  e: React.MouseEvent,
  ref: React.RefObject<HTMLButtonElement | null>,
) {
  e.preventDefault()
  const btn = ref.current
  if (!btn) return
  btn.dataset.cursorAnchored = 'true'
  btn.style.position = 'fixed'
  btn.style.left = `${e.clientX}px`
  btn.style.top = `${e.clientY}px`
  btn.style.width = '0px'
  btn.style.height = '0px'
  btn.style.padding = '0px'
  // Let the new position apply before Headless UI measures the anchor.
  requestAnimationFrame(() => btn.click())
}
