import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'

/** Custom drag types so drop targets can tell app content apart from other drags. */
export const TRACK_DND_MIME = 'application/x-notspotify-track'
export const ARTIST_DND_MIME = 'application/x-notspotify-artist'
export const ALBUM_DND_MIME = 'application/x-notspotify-album'
export const VIDEO_DND_MIME = 'application/x-notspotify-video'
export const PODCAST_DND_MIME = 'application/x-notspotify-podcast'

/** Spotify's green — used for the drop affordance regardless of the app's accent theme. */
export const DROP_GREEN = '#1ed760'

/**
 * Builds a small Spotify-style "pill" showing the dragged content label and registers
 * it as the drag image. The element is appended off-screen, snapshotted by the browser,
 * then removed on the next tick.
 */
function setDragPillImage(e: React.DragEvent, label: string) {
  if (typeof document === 'undefined') return
  const pill = document.createElement('div')
  pill.textContent = label
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

export function setTrackDragImage(e: React.DragEvent, track: Track) {
  setDragPillImage(e, track.title)
}

export function setArtistDragImage(e: React.DragEvent, artist: Artist) {
  setDragPillImage(e, artist.name)
}

export function setAlbumDragImage(e: React.DragEvent, album: Album) {
  setDragPillImage(e, album.title)
}

export function setVideoDragImage(e: React.DragEvent, video: MusicVideo) {
  setDragPillImage(e, video.title)
}

export function setPodcastDragImage(e: React.DragEvent, podcast: PodcastSummary) {
  setDragPillImage(e, podcast.title)
}
