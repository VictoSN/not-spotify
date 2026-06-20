// Client-side song recognition. Decodes catalogue audio with the browser's
// built-in Web Audio `decodeAudioData` (no ffmpeg / no plugin), fingerprints it
// (utils/audioFingerprint), caches the fingerprints in IndexedDB so the index
// builds only once, then matches a mic recording or uploaded clip against it.
import {
  fingerprint,
  addToDb,
  matchLandmarks,
  toMono,
  type FingerprintDb,
  type Landmark,
} from '@/utils/audioFingerprint'

// Bump to invalidate every cached fingerprint (e.g. if the algorithm changes).
const CACHE_VERSION = 1
const IDB_NAME = 'ns-recognition'
const IDB_STORE = 'fingerprints'
// A confident match needs a clear time-coherent peak that beats the runner-up.
const MIN_SCORE = 8
const LEAD_RATIO = 1.5

let audioCtx: AudioContext | null = null
function ctx(): AudioContext {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new Ctor()
  }
  return audioCtx
}

function bufferToMono(buf: AudioBuffer): { samples: Float32Array; sampleRate: number } {
  const channels: Float32Array[] = []
  for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c))
  return { samples: toMono(channels), sampleRate: buf.sampleRate }
}

async function decodeUrl(url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`audio fetch failed (${res.status})`)
  return ctx().decodeAudioData(await res.arrayBuffer())
}

// ---- IndexedDB cache (per-track landmarks, flattened to [hash,t,hash,t,…]) ----

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function cacheGet(id: string): Promise<Landmark[] | null> {
  try {
    const db = await openIdb()
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(id)
      req.onsuccess = () => {
        const val = req.result as { v: number; flat: number[] } | undefined
        if (!val || val.v !== CACHE_VERSION) return resolve(null)
        const lm: Landmark[] = []
        for (let i = 0; i + 1 < val.flat.length; i += 2) lm.push({ hash: val.flat[i], t: val.flat[i + 1] })
        resolve(lm)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function cachePut(id: string, lm: Landmark[]): Promise<void> {
  try {
    const db = await openIdb()
    const flat = new Array<number>(lm.length * 2)
    for (let i = 0; i < lm.length; i++) {
      flat[i * 2] = lm[i].hash
      flat[i * 2 + 1] = lm[i].t
    }
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put({ v: CACHE_VERSION, flat }, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* cache is best-effort */
  }
}

// ---- index + recognize ----

export interface IndexResult {
  indexed: number
  failed: number
  total: number
}

let db: FingerprintDb | null = null
const indexedIds = new Set<string>()

export function isIndexed(): boolean {
  return db !== null && indexedIds.size > 0
}

export interface IndexTrack {
  id: string
  audioUrl: string
}

/**
 * Build (or extend) the in-memory fingerprint database from the given tracks.
 * Cached fingerprints load from IndexedDB; uncached ones are fetched + decoded +
 * fingerprinted once. Tracks whose audio can't be fetched (e.g. CORS) are
 * skipped and counted as failed, so the caller can report honest coverage.
 */
export async function buildIndex(
  tracks: IndexTrack[],
  onProgress?: (done: number, total: number) => void,
): Promise<IndexResult> {
  if (!db) db = new Map()
  let failed = 0
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]
    if (!indexedIds.has(track.id)) {
      try {
        let lm = await cacheGet(track.id)
        if (!lm) {
          const { samples, sampleRate } = bufferToMono(await decodeUrl(track.audioUrl))
          lm = fingerprint(samples, sampleRate)
          await cachePut(track.id, lm)
        }
        addToDb(db, track.id, lm)
        indexedIds.add(track.id)
      } catch {
        failed++
      }
    }
    onProgress?.(i + 1, tracks.length)
  }
  return { indexed: indexedIds.size, failed, total: tracks.length }
}

export interface Recognition {
  id: string
  score: number
  confident: boolean
}

/** Recognize an audio clip (mic recording or uploaded file) against the index. */
export async function recognize(clip: Blob): Promise<Recognition | null> {
  if (!db) return null
  const { samples, sampleRate } = bufferToMono(await ctx().decodeAudioData(await clip.arrayBuffer()))
  const results = matchLandmarks(fingerprint(samples, sampleRate), db)
  const top = results[0]
  if (!top) return null
  const runnerUp = results[1]?.score ?? 0
  return {
    id: top.id,
    score: top.score,
    confident: top.score >= MIN_SCORE && top.score >= runnerUp * LEAD_RATIO,
  }
}

/** Record `seconds` of microphone audio and return it as a Blob. */
export async function recordMic(seconds = 7): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  try {
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
    })
    recorder.start()
    await new Promise((r) => setTimeout(r, seconds * 1000))
    recorder.stop()
    return await stopped
  } finally {
    stream.getTracks().forEach((t) => t.stop())
  }
}
