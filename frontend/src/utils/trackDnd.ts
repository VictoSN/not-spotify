import type { Track } from '@/types/track'

/** Custom drag type so drop targets can tell a track drag apart from any other drag. */
export const TRACK_DND_MIME = 'application/x-notspotify-track'

/** Spotify's green — used for the drop affordance regardless of the app's accent theme. */
export const DROP_GREEN = '#1ed760'

/**
 * Builds a small Spotify-style "pill" showing the dragged track's title and registers
 * it as the drag image. The element is appended off-screen, snapshotted by the browser,
 * then removed on the next tick.
 */
export function setTrackDragImage(e: React.DragEvent, track: Track) {
  if (typeof document === 'undefined') return
  const pill = document.createElement('div')
  pill.textContent = track.title
  pill.style.cssText = [
    'position:fixed',
    'top:-1000px',
    'left:-1000px',
    'padding:8px 14px',
    'border-radius:9999px',
    `background:${DROP_GREEN}`,
    'color:#000',
    'font-size:13px',
    'font-weight:800',
    'font-family:inherit',
    'white-space:nowrap',
    'max-width:240px',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'box-shadow:0 12px 32px rgba(0,0,0,0.5)',
    'z-index:9999',
    'pointer-events:none',
  ].join(';')
  document.body.appendChild(pill)
  try {
    e.dataTransfer.setDragImage(pill, 14, 18)
  } catch {
    /* setDragImage unsupported — fall back to the default ghost */
  }
  window.setTimeout(() => pill.remove(), 0)
}
