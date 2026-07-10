import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import type { Playlist } from '@/types/playlist'
import { isDesktop } from '@/utils/platform'
import { useAuthStore } from '@/stores/authStore'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { appLocalDataDir, join } from '@tauri-apps/api/path'
import { BaseDirectory, mkdir, remove, writeFile } from '@tauri-apps/plugin-fs'

/*
 * Save-for-offline — two backends behind one API.
 *
 * DESKTOP (Tauri): the audio file is written to the app's own local-data
 * directory ($APPLOCALDATA/offline/<id>.<ext>) via the fs plugin — a real,
 * app-managed folder the user never picks. Playback resolves through Tauri's
 * asset protocol (convertFileSrc), which streams the file with native Range
 * support so seeking works offline. This is the supported, product-facing path.
 *
 * BROWSER (legacy): stores the file in the Cache Storage bucket the service
 * worker reads from (see public/sw.js) and plays it back via `/_offline-audio`.
 * New saves are gated OFF in the browser UI (offline is a desktop feature), but
 * the code stays so any previously-saved browser tracks still play.
 *
 * OWNERSHIP (reference counting): a saved track carries a set of `owners` — the
 * literal 'individual' (saved from a song's ⋯ menu) and/or collection keys like
 * `album:<id>` / `playlist:<id>`. Downloading an album adds its key to every
 * track; removing the album detaches that key and only deletes a file once no
 * owner still needs it. So a song can belong to your Downloads and an album at
 * once without being stored twice.
 *
 * A small localStorage index (metadata + on-disk path) drives the UI in both
 * cases; the media bytes hold no auth secret.
 */

const OFFLINE_CACHE = 'ns-offline-audio'
const OFFLINE_DATA_PREFIX = '/_offline-audio-data/'
const OFFLINE_DIR = 'offline'
const COVERS_DIR = `${OFFLINE_DIR}/covers`
const INDEX_KEY = 'ns-offline-index'
const COLLECTIONS_KEY = 'ns-offline-collections'
const COVERS_KEY = 'ns-offline-covers'
/** Desktop only: remote cover URL → absolute on-disk path, for deletion on prune. */
const COVER_PATHS_KEY = 'ns-offline-cover-paths'
/** The owner tag for a song saved directly from its ⋯ menu. */
export const INDIVIDUAL_OWNER = 'individual'
/** Fired on the window whenever the saved set (tracks or collections) changes. */
export const OFFLINE_CHANGE_EVENT = 'ns-offline-change'

export type OfflineCollectionKind = 'album' | 'playlist'

export interface OfflineEntry {
  id: string
  title: string
  artist: string
  coverUrl: string
  audioUrl: string
  durationMs?: number
  bytes: number
  savedAt: number
  /** Who keeps this file alive: 'individual' and/or `album:<id>` / `playlist:<id>`. */
  owners: string[]
  /** Desktop only: absolute path of the saved file, for convertFileSrc. */
  path?: string
  /** Desktop only: file is AES-GCM encrypted and served by the private native protocol. */
  encrypted?: boolean
  /** Account that holds the offline licence for this local entry. */
  accountId?: string
}

export interface OfflineCollection {
  /** `album:<id>` or `playlist:<id>` — unique per saved collection. */
  key: string
  kind: OfflineCollectionKind
  id: string
  name: string
  subtitle: string
  coverUrl: string
  trackIds: string[]
  savedAt: number
  /** Account that holds the offline licence for this saved collection. */
  accountId?: string
}

export const collectionKey = (kind: OfflineCollectionKind, id: string) => `${kind}:${id}`

const dataKey = (id: string) => OFFLINE_DATA_PREFIX + id
const playbackUrl = (id: string) => `/_offline-audio?id=${encodeURIComponent(id)}`

/**
 * Build a playable Track from a saved entry, using only the locally-stored
 * metadata (no network). Fields the download doesn't carry (artist/album ids,
 * duration) are stubbed — playback only needs id + audioUrl, which
 * resolvePlaybackSrc maps to the on-disk file. Duration fills in from the audio
 * element once it loads.
 */
export function offlineEntryToTrack(e: OfflineEntry): Track {
  return {
    id: e.id,
    title: e.title,
    durationMs: e.durationMs ?? 0,
    audioUrl: e.audioUrl,
    previewUrl: null,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
    playCount: 0,
    ratingCount: 0,
    averageRating: 0,
    artist: { id: '', name: e.artist, imageUrl: null },
    album: { id: '', title: '', coverUrl: resolveCoverSrc(e.coverUrl), releaseDate: '', type: 'single' },
    genres: [],
    createdAt: new Date(e.savedAt).toISOString(),
  }
}

export function isOfflineSupported(): boolean {
  // Desktop: the Tauri fs plugin is always available. Browser: needs the Cache
  // Storage + service worker stack the legacy backend relies on.
  if (isDesktop()) return true
  return (
    typeof caches !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  )
}

function readAllIndex(): OfflineEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    const arr = raw ? (JSON.parse(raw) as OfflineEntry[]) : []
    // Migrate legacy entries (pre-ownership) to individually-owned.
    return arr.map((e) => ({
      ...e,
      owners: e.owners && e.owners.length ? e.owners : [INDIVIDUAL_OWNER],
    }))
  } catch {
    return []
  }
}

function readAllCollections(): OfflineCollection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    return raw ? (JSON.parse(raw) as OfflineCollection[]) : []
  } catch {
    return []
  }
}

function currentOfflineAccountId(): string | null {
  return useAuthStore.getState().user?.id ?? null
}

/** A revoked/downgraded account must not unlock its locally-held media. */
export function canUseOfflineAudio(): boolean {
  const user = useAuthStore.getState().user
  if (!isDesktop() || user?.plan !== 'premium') return false
  const periodEnd = user.subscriptionCurrentPeriodEnd
  return !periodEnd || Number.isNaN(Date.parse(periodEnd)) || Date.parse(periodEnd) > Date.now()
}

function readIndex(): OfflineEntry[] {
  const accountId = currentOfflineAccountId()
  return accountId ? readAllIndex().filter((entry) => entry.accountId === accountId) : []
}

function readCollections(): OfflineCollection[] {
  const accountId = currentOfflineAccountId()
  return accountId ? readAllCollections().filter((collection) => collection.accountId === accountId) : []
}

// ── Cover-art cache ─────────────────────────────────────────────────────────
// Covers are cached as data-URLs keyed by their remote URL, so an album's tracks
// all share one entry and images render with no network. Kept in localStorage so
// it works on both desktop and browser without any native/asset-protocol config.

function readCovers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(COVERS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

let coverMap: Record<string, string> = readCovers()

function writeCovers(map: Record<string, string>) {
  coverMap = map
  try {
    localStorage.setItem(COVERS_KEY, JSON.stringify(map))
  } catch {
    /* quota — best-effort; images fall back to the network URL */
  }
}

function readCoverPaths(): Record<string, string> {
  try {
    const raw = localStorage.getItem(COVER_PATHS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

let coverPaths: Record<string, string> = readCoverPaths()

function writeCoverPaths(map: Record<string, string>) {
  coverPaths = map
  try {
    localStorage.setItem(COVER_PATHS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/** Stable short filename token for a URL (FNV-1a → base36). */
function hashKey(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

/** Image Content-Type / URL → file extension. */
function imgExtFor(contentType: string, url: string): string {
  const ct = contentType.toLowerCase()
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  const m = url.split('?')[0].match(/\.(png|jpe?g|webp|gif)$/i)
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
}

/** The best available image src for a saved cover: the cached copy, else the URL. */
export function resolveCoverSrc(coverUrl?: string | null): string {
  if (!coverUrl) return ''
  return coverMap[coverUrl] ?? coverUrl
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Download + cache a cover so it renders with no network (best-effort, skipped if
 * already cached). Desktop writes the image to $APPLOCALDATA/offline/covers/ — a
 * real file served through the asset protocol, exactly like the audio, with no
 * localStorage size cap. Browser keeps a data-URL fallback (capped for quota).
 *
 * `cache: 'reload'` + `mode: 'cors'` is required either way: a plain <img> already
 * loaded this cover, so the browser holds an *opaque* (no-CORS) copy. Reusing it
 * yields an unreadable opaque response (res.ok === false). Forcing a fresh CORS
 * request makes CloudFront return our-origin ACAO so the bytes are readable.
 * (Same fix as useDominantColor — see dominant-color CORS cache notes.)
 */
async function cacheCover(coverUrl?: string | null): Promise<void> {
  if (!coverUrl || coverMap[coverUrl]) return
  try {
    const res = await fetch(coverUrl, { mode: 'cors', cache: 'reload', credentials: 'omit' })
    if (!res.ok) return
    const blob = await res.blob()
    if (!blob.size) return

    if (isDesktop()) {
      const file = `${hashKey(coverUrl)}.${imgExtFor(res.headers.get('Content-Type') || '', coverUrl)}`
      const rel = `${COVERS_DIR}/${file}`
      const bytes = new Uint8Array(await blob.arrayBuffer())
      await mkdir(COVERS_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true })
      await writeFile(rel, bytes, { baseDir: BaseDirectory.AppLocalData })
      const abs = await join(await appLocalDataDir(), COVERS_DIR, file)
      writeCoverPaths({ ...coverPaths, [coverUrl]: abs })
      writeCovers({ ...coverMap, [coverUrl]: convertFileSrc(abs) })
      return
    }

    // Browser: a data-URL in localStorage. Skip anything too big for the quota.
    if (blob.size > 600_000) return
    const dataUrl = await blobToDataUrl(blob)
    writeCovers({ ...coverMap, [coverUrl]: dataUrl })
  } catch {
    /* offline / CORS / decode failure — leave it to the network URL */
  }
}

/**
 * Download any cover that a saved track/collection references but that isn't
 * cached yet — self-heals items saved before covers were downloaded to disk, and
 * retries covers that failed while offline. Best-effort; needs the network, so
 * call it on startup and whenever the app comes back online. Fires a change event
 * if it cached anything so the UI re-renders with the now-local images.
 */
export async function backfillCovers(): Promise<void> {
  const urls = new Set<string>()
  for (const e of readIndex()) if (e.coverUrl) urls.add(e.coverUrl)
  for (const c of readCollections()) if (c.coverUrl) urls.add(c.coverUrl)

  let cached = 0
  for (const url of urls) {
    if (coverMap[url]) continue
    const before = coverMap[url]
    await cacheCover(url)
    if (coverMap[url] && coverMap[url] !== before) cached++
  }
  if (cached > 0) dispatchChange()
}

/** Drop cached covers no saved track or collection references any more. */
async function pruneCovers() {
  const used = new Set<string>()
  for (const e of readIndex()) if (e.coverUrl) used.add(e.coverUrl)
  for (const c of readCollections()) if (c.coverUrl) used.add(c.coverUrl)

  const next: Record<string, string> = {}
  for (const [url, data] of Object.entries(coverMap)) {
    if (used.has(url)) next[url] = data
  }
  writeCovers(next)

  // Desktop: delete the orphaned image files too.
  const nextPaths: Record<string, string> = {}
  for (const [url, path] of Object.entries(coverPaths)) {
    if (used.has(url)) {
      nextPaths[url] = path
    } else if (isDesktop()) {
      try {
        await remove(path)
      } catch {
        /* already gone */
      }
    }
  }
  writeCoverPaths(nextPaths)
}

// Synchronous mirrors of the saved set so the audio engine can resolve the
// playback src inline without an async lookup.
let savedIds = new Set<string>(readIndex().map((e) => e.id))
let savedPaths = new Map<string, string>(
  readIndex().flatMap((e) => (e.path ? [[e.id, e.path] as [string, string]] : [])),
)

// The index itself contains entries for every desktop account. Keep the fast,
// synchronous playback lookup scoped to the active account as login, logout,
// and plan changes happen.
useAuthStore.subscribe(() => {
  const entries = readIndex()
  savedIds = new Set(entries.map((entry) => entry.id))
  savedPaths = new Map(entries.flatMap((entry) => (
    entry.path ? [[entry.id, entry.path] as [string, string]] : []
  )))
  dispatchChange()
})

function dispatchChange() {
  try {
    window.dispatchEvent(new CustomEvent(OFFLINE_CHANGE_EVENT))
  } catch {
    /* non-browser context */
  }
}

function writeIndex(entries: OfflineEntry[]) {
  const accountId = currentOfflineAccountId()
  if (!accountId) return
  const scoped = entries.map((entry) => ({ ...entry, accountId }))
  try {
    const otherAccounts = readAllIndex().filter((entry) => entry.accountId !== accountId)
    localStorage.setItem(INDEX_KEY, JSON.stringify([...otherAccounts, ...scoped]))
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
  savedIds = new Set(scoped.map((e) => e.id))
  savedPaths = new Map(
    scoped.flatMap((e) => (e.path ? [[e.id, e.path] as [string, string]] : [])),
  )
  dispatchChange()
}

function writeCollections(collections: OfflineCollection[]) {
  const accountId = currentOfflineAccountId()
  if (!accountId) return
  const scoped = collections.map((collection) => ({ ...collection, accountId }))
  try {
    const otherAccounts = readAllCollections().filter((collection) => collection.accountId !== accountId)
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify([...otherAccounts, ...scoped]))
  } catch {
    /* ignore */
  }
  dispatchChange()
}

export function isTrackSaved(id: string): boolean {
  return savedIds.has(id)
}

/** True only when the track was saved directly (in the user's Downloads bucket). */
export function isTrackSavedIndividually(id: string): boolean {
  return readIndex().some((e) => e.id === id && e.owners.includes(INDIVIDUAL_OWNER))
}

/** Every saved track, newest first. */
export function listOffline(): OfflineEntry[] {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt)
}

/** Tracks in the user's Downloads bucket (saved individually), newest first. */
export function listIndividualOffline(): OfflineEntry[] {
  return readIndex()
    .filter((e) => e.owners.includes(INDIVIDUAL_OWNER))
    .sort((a, b) => b.savedAt - a.savedAt)
}

export function listOfflineCollections(): OfflineCollection[] {
  return readCollections().sort((a, b) => b.savedAt - a.savedAt)
}

export function isCollectionSaved(key: string): boolean {
  return readCollections().some((c) => c.key === key)
}

export function getOfflineCollection(key: string): OfflineCollection | undefined {
  return readCollections().find((c) => c.key === key)
}

/** The saved tracks belonging to a collection, in the collection's order. */
export function listOfflineCollectionTracks(key: string): OfflineEntry[] {
  const collection = readCollections().find((c) => c.key === key)
  if (!collection) return []
  const byId = new Map(readIndex().map((e) => [e.id, e]))
  return collection.trackIds.flatMap((id) => {
    const e = byId.get(id)
    return e ? [e] : []
  })
}

/** Playable Track[] for a saved collection (covers resolved, no network). */
export function offlineCollectionTracks(key: string): Track[] {
  return listOfflineCollectionTracks(key).map(offlineEntryToTrack)
}

/** Build a minimal Album from a saved collection, for offline detail pages. */
export function offlineCollectionToAlbum(c: OfflineCollection): Album {
  const tracks = offlineCollectionTracks(c.key)
  return {
    id: c.id,
    title: c.name,
    type: 'album',
    coverUrl: resolveCoverSrc(c.coverUrl),
    releaseDate: new Date(c.savedAt).toISOString(),
    totalTracks: c.trackIds.length,
    durationMs: tracks.reduce((sum, track) => sum + track.durationMs, 0),
    artist: { id: '', name: c.subtitle, imageUrl: null },
    genres: [],
    label: null,
    copyright: null,
    popularity: 0,
  }
}

/** Build a minimal Playlist from a saved collection, for offline detail pages. */
export function offlineCollectionToPlaylist(c: OfflineCollection): Playlist {
  const iso = new Date(c.savedAt).toISOString()
  const owner = { id: '', name: c.subtitle || 'You', avatarUrl: null }
  const tracks = offlineCollectionTracks(c.key)
  return {
    id: c.id,
    name: c.name,
    description: null,
    coverUrl: resolveCoverSrc(c.coverUrl),
    isPublic: true,
    owner,
    tracks: tracks.map((track) => ({ track, addedAt: iso, addedBy: owner })),
    followerCount: 0,
    totalDurationMs: tracks.reduce((sum, track) => sum + track.durationMs, 0),
    createdAt: iso,
    updatedAt: iso,
  }
}

export function offlineTotalBytes(): number {
  return readIndex().reduce((sum, e) => sum + (e.bytes || 0), 0)
}

/**
 * The URL the <audio> element should load for a track: the local offline copy
 * when it's saved (by any owner), otherwise the normal network URL. Synchronous
 * and side-effect-free so the audio engine can call it inline.
 */
export function resolvePlaybackSrc(track: Track): string {
  // A Free account can stream normally, but may never decrypt locally saved audio.
  if (!canUseOfflineAudio()) return track.audioUrl
  if (!savedIds.has(track.id)) return track.audioUrl

  // New desktop saves are encrypted and can only be decrypted by the native
  // protocol while running under this OS user. Legacy entries remain readable
  // so an upgrade does not silently discard existing downloads.
  const path = savedPaths.get(track.id)
  if (isDesktop() && path) {
    try {
      const entry = readIndex().find((e) => e.id === track.id)
      if (entry?.encrypted) return `offline-audio://localhost/${path.replace(/^offline\//, '')}`
      return convertFileSrc(path)
    } catch {
      return track.audioUrl
    }
  }

  // Browser (legacy): the service worker serves the cached body.
  if (
    !isDesktop() &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller
  ) {
    return playbackUrl(track.id)
  }

  return track.audioUrl
}

/** Content-Type → file extension for the saved-on-disk name. */
/** Merge a new/updated track entry into the index, unioning its owners. */
function upsertEntry(track: Track, bytes: number, path: string | undefined, owner: string, encrypted = false) {
  const entries = readIndex()
  const existing = entries.find((e) => e.id === track.id)
  const owners = new Set(existing?.owners ?? [])
  owners.add(owner)
  const next: OfflineEntry = {
    id: track.id,
    title: track.title,
    artist: track.artist.name,
    coverUrl: track.album.coverUrl,
    audioUrl: track.audioUrl,
    durationMs: track.durationMs,
    bytes: bytes || existing?.bytes || 0,
    savedAt: existing?.savedAt ?? Date.now(),
    owners: [...owners],
    path: path ?? existing?.path,
    encrypted: encrypted || existing?.encrypted,
  }
  writeIndex([...entries.filter((e) => e.id !== track.id), next])
}

/** Attach an owner to an already-saved track without re-downloading. */
function attachOwner(id: string, owner: string) {
  const entries = readIndex()
  const entry = entries.find((e) => e.id === id)
  if (!entry) return
  if (entry.owners.includes(owner)) return
  entry.owners = [...entry.owners, owner]
  writeIndex(entries)
}

async function deleteFileForEntry(entry: OfflineEntry) {
  if (isDesktop()) {
    if (entry.path) {
      try {
        await remove(entry.path, entry.encrypted ? { baseDir: BaseDirectory.AppLocalData } : undefined)
      } catch {
        /* already gone */
      }
    }
  } else {
    try {
      const cache = await caches.open(OFFLINE_CACHE)
      await cache.delete(dataKey(entry.id))
    } catch {
      /* ignore */
    }
  }
}

/** Drop an owner; delete the file + entry only when no owner still needs it. */
async function detachOwner(id: string, owner: string) {
  const entries = readIndex()
  const entry = entries.find((e) => e.id === id)
  if (!entry) return
  const owners = entry.owners.filter((o) => o !== owner)
  if (owners.length === 0) {
    await deleteFileForEntry(entry)
    writeIndex(entries.filter((e) => e.id !== id))
  } else {
    entry.owners = owners
    writeIndex(entries)
  }
}

// ── Backend downloads (write the bytes; ownership handled by callers) ─────────

async function downloadTrackTauri(track: Track, owner: string): Promise<void> {
  const res = await fetch(track.audioUrl, { credentials: 'omit' })
  if (!res.ok) throw new Error(`Download failed (${res.status}).`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength === 0) throw new Error('Downloaded file was empty.')

  const accountId = currentOfflineAccountId()
  if (!accountId) throw new Error('Sign in with Premium to save music for offline listening.')
  const rel = `${OFFLINE_DIR}/${accountId}-${track.id}.nsa`
  await invoke('save_offline_audio', {
    path: rel,
    mime: res.headers.get('Content-Type') || 'audio/mpeg',
    bytes,
  })
  upsertEntry(track, bytes.byteLength, rel, owner, true)
}

async function downloadTrackCache(track: Track, owner: string): Promise<void> {
  if (!isOfflineSupported()) {
    throw new Error('Offline storage is not supported in this browser.')
  }
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
  upsertEntry(track, blob.size, undefined, owner)
}

/** Save one track under an owner. If already on disk, just attaches the owner. */
async function saveTrackWithOwner(track: Track, owner: string): Promise<void> {
  if (!track.audioUrl) throw new Error('This track has no audio to download.')
  // Cache the cover so it shows offline (shared across an album's tracks).
  await cacheCover(track.album.coverUrl)
  if (isTrackSaved(track.id)) {
    attachOwner(track.id, owner)
    return
  }
  // Fetch the complete file (no Range) so we hold a full, readable body. Requires
  // CORS to be allowed on the media host (S3 bucket CORS / static audio).
  return isDesktop() ? downloadTrackTauri(track, owner) : downloadTrackCache(track, owner)
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function saveTrackOffline(track: Track): Promise<void> {
  if (!canUseOfflineAudio()) throw new Error('A Premium subscription is required for offline listening.')
  if (!isOfflineSupported()) throw new Error('Offline storage is not supported here.')
  return saveTrackWithOwner(track, INDIVIDUAL_OWNER)
}

/** Remove a track from the user's Downloads bucket (kept if an album still owns it). */
export async function removeTrackOffline(id: string): Promise<void> {
  await detachOwner(id, INDIVIDUAL_OWNER)
  await pruneCovers()
}

export interface CollectionMeta {
  kind: OfflineCollectionKind
  id: string
  name: string
  subtitle: string
  coverUrl: string
}

/**
 * Download every track in an album/playlist. Tolerates per-track failures and
 * reports how many succeeded; records the collection so it shows as one entry.
 */
export async function saveCollectionOffline(
  meta: CollectionMeta,
  tracks: Track[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ saved: number; failed: number }> {
  if (!canUseOfflineAudio()) throw new Error('A Premium subscription is required for offline listening.')
  if (!isOfflineSupported()) throw new Error('Offline storage is not supported here.')
  const key = collectionKey(meta.kind, meta.id)
  await cacheCover(meta.coverUrl)
  const savedIdsInOrder: string[] = []
  let failed = 0

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]
    try {
      if (track.audioUrl) {
        await saveTrackWithOwner(track, key)
        savedIdsInOrder.push(track.id)
      } else {
        failed++
      }
    } catch {
      failed++
    }
    onProgress?.(i + 1, tracks.length)
  }

  const collections = readCollections().filter((c) => c.key !== key)
  if (savedIdsInOrder.length > 0) {
    collections.push({
      key,
      kind: meta.kind,
      id: meta.id,
      name: meta.name,
      subtitle: meta.subtitle,
      coverUrl: meta.coverUrl,
      trackIds: savedIdsInOrder,
      savedAt: Date.now(),
    })
  }
  writeCollections(collections)

  return { saved: savedIdsInOrder.length, failed }
}

/** Remove a saved album/playlist, deleting files no other owner still needs. */
export async function removeCollectionOffline(key: string): Promise<void> {
  const collection = readCollections().find((c) => c.key === key)
  if (collection) {
    for (const id of collection.trackIds) {
      await detachOwner(id, key)
    }
  }
  writeCollections(readCollections().filter((c) => c.key !== key))
  await pruneCovers()
}

export async function clearOffline(): Promise<void> {
  if (isDesktop()) {
    // Remove each saved file individually (scoped, no recursive dir delete perm needed).
    for (const entry of readIndex()) {
      await deleteFileForEntry(entry)
    }
    for (const path of Object.values(coverPaths)) {
      try {
        await remove(path)
      } catch {
        /* already gone */
      }
    }
  } else {
    try {
      await caches.delete(OFFLINE_CACHE)
    } catch {
      /* ignore */
    }
  }
  writeCollections([])
  writeIndex([])
  writeCovers({})
  writeCoverPaths({})
}
