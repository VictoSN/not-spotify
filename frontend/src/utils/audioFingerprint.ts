// Acoustic fingerprinting — a compact, dependency-free implementation of the
// Shazam-style "constellation" algorithm, all in the browser:
//
//   samples → spectrogram → per-band spectral peaks → (anchor, target) pair
//   hashes → match a query against a database by time-offset coherence.
//
// No ffmpeg, no native code, no API: callers decode audio with the browser's
// built-in Web Audio `decodeAudioData`, hand the mono samples here, and match.
// Pure functions so the core is unit-testable without any audio hardware.

export const TARGET_SAMPLE_RATE = 11025 // decimate to this before analysis
const FFT_SIZE = 1024 // ~93ms window at 11025 Hz
const HOP = 512
const HALF = FFT_SIZE / 2 // 512 frequency bins
// Logarithmic-ish band edges (in bins): one peak is kept per band per frame.
const BAND_EDGES = [0, 10, 20, 40, 80, 160, HALF]
const FAN_OUT = 5 // target peaks paired with each anchor
const MIN_DT = 1
const MAX_DT = 63 // fits in 6 bits

export interface Landmark {
  hash: number
  t: number // anchor frame index (time)
}

/** In-place iterative radix-2 FFT. Lengths must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr
      const ti = im[i]; im[i] = im[j]; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cwr = 1
      let cwi = 0
      for (let k = 0; k < len >> 1; k++) {
        const a = i + k
        const b = a + (len >> 1)
        const tr = re[b] * cwr - im[b] * cwi
        const ti = re[b] * cwi + im[b] * cwr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncwr = cwr * wr - cwi * wi
        cwi = cwr * wi + cwi * wr
        cwr = ncwr
      }
    }
  }
}

/** Average two channels (or pass through mono) into a single Float32Array. */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const len = channels[0].length
  const out = new Float32Array(len)
  for (let c = 0; c < channels.length; c++) {
    const ch = channels[c]
    for (let i = 0; i < len; i++) out[i] += ch[i]
  }
  for (let i = 0; i < len; i++) out[i] /= channels.length
  return out
}

/** Decimate mono samples from `sampleRate` down to TARGET_SAMPLE_RATE. */
export function downsample(samples: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate <= TARGET_SAMPLE_RATE) return samples
  const ratio = sampleRate / TARGET_SAMPLE_RATE
  const outLen = Math.floor(samples.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    // Box-average the source window to reduce aliasing a little.
    const start = Math.floor(i * ratio)
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += samples[j]
    out[i] = end > start ? sum / (end - start) : samples[start] ?? 0
  }
  return out
}

/** Pack two frequency bins + a time delta into a single integer hash. */
function packHash(f1: number, f2: number, dt: number): number {
  // f1,f2 in [0,512) → 9 bits each; dt in [0,64) → 6 bits. 24 bits total.
  return ((f1 & 0x1ff) << 15) | ((f2 & 0x1ff) << 6) | (dt & 0x3f)
}

/**
 * Extract constellation landmarks from mono samples (already at the source
 * sample rate; this decimates internally). Returns (hash, time) pairs.
 */
export function fingerprint(samples: Float32Array, sampleRate: number): Landmark[] {
  const mono = downsample(samples, sampleRate)
  const frames = Math.max(0, 1 + Math.floor((mono.length - FFT_SIZE) / HOP))
  if (frames <= 0) return []

  // Hann window, precomputed.
  const win = new Float64Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))

  // Peaks: one strongest bin per band per frame, above a small magnitude floor.
  const peaks: Array<{ f: number; t: number }> = []
  const re = new Float64Array(FFT_SIZE)
  const im = new Float64Array(FFT_SIZE)
  for (let frame = 0; frame < frames; frame++) {
    const off = frame * HOP
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = mono[off + i] * win[i]
      im[i] = 0
    }
    fft(re, im)

    const mag = new Float64Array(HALF)
    let mean = 0
    for (let b = 0; b < HALF; b++) {
      mag[b] = Math.hypot(re[b], im[b])
      mean += mag[b]
    }
    mean /= HALF
    const floor = mean * 1.2 // ignore near-silent bands

    for (let band = 0; band < BAND_EDGES.length - 1; band++) {
      const lo = BAND_EDGES[band]
      const hi = BAND_EDGES[band + 1]
      let bestBin = -1
      let bestMag = floor
      for (let b = lo; b < hi; b++) {
        if (mag[b] > bestMag) {
          bestMag = mag[b]
          bestBin = b
        }
      }
      if (bestBin >= 0) peaks.push({ f: bestBin, t: frame })
    }
  }

  // Pair each anchor with the next FAN_OUT peaks within the time window.
  const landmarks: Landmark[] = []
  for (let i = 0; i < peaks.length; i++) {
    const a = peaks[i]
    let paired = 0
    for (let j = i + 1; j < peaks.length && paired < FAN_OUT; j++) {
      const b = peaks[j]
      const dt = b.t - a.t
      if (dt < MIN_DT) continue
      if (dt > MAX_DT) break
      landmarks.push({ hash: packHash(a.f, b.f, dt), t: a.t })
      paired++
    }
  }
  return landmarks
}

export type FingerprintDb = Map<number, Array<{ id: string; t: number }>>

/** Merge one track's landmarks into a shared database. */
export function addToDb(db: FingerprintDb, id: string, landmarks: Landmark[]): void {
  for (const lm of landmarks) {
    let bucket = db.get(lm.hash)
    if (!bucket) {
      bucket = []
      db.set(lm.hash, bucket)
    }
    bucket.push({ id, t: lm.t })
  }
}

export interface MatchResult {
  id: string
  score: number // peak count of time-coherent hash matches
}

/**
 * Match query landmarks against the database. A genuine match shows many hashes
 * agreeing on a single time offset (the query is a delayed slice of the track),
 * so we histogram (trackId, offset) and take each track's strongest offset.
 */
export function matchLandmarks(query: Landmark[], db: FingerprintDb): MatchResult[] {
  // id → (offset → count)
  const tallies = new Map<string, Map<number, number>>()
  for (const q of query) {
    const bucket = db.get(q.hash)
    if (!bucket) continue
    for (const entry of bucket) {
      const offset = entry.t - q.t
      let perId = tallies.get(entry.id)
      if (!perId) {
        perId = new Map()
        tallies.set(entry.id, perId)
      }
      perId.set(offset, (perId.get(offset) ?? 0) + 1)
    }
  }

  const results: MatchResult[] = []
  for (const [id, offsets] of tallies) {
    let best = 0
    for (const count of offsets.values()) if (count > best) best = count
    results.push({ id, score: best })
  }
  results.sort((a, b) => b.score - a.score)
  return results
}
