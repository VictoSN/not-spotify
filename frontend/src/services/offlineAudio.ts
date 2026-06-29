import type { Track } from '@/types/track'

/*
 * Save-for-offline: stores a full audio file in the Cache Storage bucket that
 * the service worker reads from (see public/sw.js), plus a small localStorage
 * index for the UI. Playback of a saved track goes through the SW-served path
 * `/_offline-audio?id=<trackId>`, which reconstructs Range responses so seeking
 * works offline. Premium-gated on the UI side (mirrors the Download action).
 *
 * Requires the service worker, so it only does anything in the built app — in
 * dev (SW disabled) saves still populate the cache but resolvePlaybackSrc falls
 * back to the network URL because no SW controls the page.
 */

const OFFLINE_CACHE = 'ns-offline-audio'
const OFFLINE_DATA_PREFIX = '/_offline-audio-data/'
const INDEX_KEY = 'ns-offline-index'
/** Fired on the window whenever the saved-track set changes. */
export const OFFLINE_CHANGE_EVENT = 'ns-offline-change'

export interface OfflineEntry {
  id: string
  title: string
  artist: string
  coverUrl: string
  audioUrl: string
  bytes: number
  savedAt: number
}

const dataKey = (id: string) => OFFLINE_DATA_PREFIX + id
const playbackUrl = (id: string) => `/_offline-audio?id=${encodeURIComponent(id)}`

export function isOfflineSupported(): boolean {
  return (
    typeof caches !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  )
}

function readIndex(): OfflineEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? (JSON.parse(raw) as OfflineEntry[]) : []
  } catch {
    return []
  }
}

// Synchronous mirror of the saved ids so the audio engine can resolve the
// playback src inline without an async cache lookup.
let savedIds = new Set<string>(readIndex().map((e) => e.id))

function writeIndex(entries: OfflineEntry[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries))
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
  savedIds = new Set(entries.map((e) => e.id))
  try {
    window.dispatchEvent(new CustomEvent(OFFLINE_CHANGE_EVENT))
  } catch {
    /* non-browser context */
  }
}

export function isTrackSaved(id: string): boolean {
  return savedIds.has(id)
}

export function listOffline(): OfflineEntry[] {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt)
}

export function offlineTotalBytes(): number {
  return readIndex().reduce((sum, e) => sum + (e.bytes || 0), 0)
}

/**
 * The URL the <audio> element should load for a track: the SW-served offline
 * copy when it's saved and a service worker controls the page, otherwise the
 * normal network URL. Synchronous and side-effect-free.
 */
export function resolvePlaybackSrc(track: Track): string {
  if (
    isOfflineSupported() &&
    navigator.serviceWorker.controller &&
    savedIds.has(track.id)
  ) {
    return playbackUrl(track.id)
  }
  return track.audioUrl
}

export async function saveTrackOffline(track: Track): Promise<void> {
  if (!isOfflineSupported()) {
    throw new Error('Offline storage is not supported in this browser.')
  }
  if (!track.audioUrl) throw new Error('This track has no audio to download.')

  // Fetch the complete file (no Range) so we hold a full, readable body. This is
  // a cross-origin fetch to storage; it requires CORS to be allowed on the media
  // host (S3 bucket CORS / the backend's static audio).
  const res = await fetch(track.audioUrl, { credentials: 'omit' })
  if (!res.ok) throw new Error(`Download failed (${res.status}).`)
  const blob = await res.blob()
  if (blob.size === 0) throw new Error('Downloaded file was empty.')

  const cache = await caches.open(OFFLINE_CACHE)
  await cache.put(
    dataKey(track.id),
    new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || blob.type || 'audio/mpeg',
        'Content-Length': String(blob.size),
      },
    }),
  )

  const entries = readIndex().filter((e) => e.id !== track.id)
  entries.push({
    id: track.id,
    title: track.title,
    artist: track.artist.name,
    coverUrl: track.album.coverUrl,
    audioUrl: track.audioUrl,
    bytes: blob.size,
    savedAt: Date.now(),
  })
  writeIndex(entries)
}

export async function removeTrackOffline(id: string): Promise<void> {
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    await cache.delete(dataKey(id))
  } catch {
    /* ignore — index update below keeps UI consistent */
  }
  writeIndex(readIndex().filter((e) => e.id !== id))
}

export async function clearOffline(): Promise<void> {
  try {
    await caches.delete(OFFLINE_CACHE)
  } catch {
    /* ignore */
  }
  writeIndex([])
}
