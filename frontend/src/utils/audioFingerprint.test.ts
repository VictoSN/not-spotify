import { describe, it, expect } from 'vitest'
import {
  fft,
  fingerprint,
  addToDb,
  matchLandmarks,
  TARGET_SAMPLE_RATE,
  type FingerprintDb,
} from './audioFingerprint'

describe('fft', () => {
  it('puts a pure sine wave energy at its bin', () => {
    const n = 1024
    const re = new Float64Array(n)
    const im = new Float64Array(n)
    const bin = 64
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * bin * i) / n)
    fft(re, im)
    const mag = Array.from({ length: n / 2 }, (_, b) => Math.hypot(re[b], im[b]))
    let peak = 0
    for (let b = 1; b < mag.length; b++) if (mag[b] > mag[peak]) peak = b
    expect(peak).toBe(bin)
  })
})

// Build a deterministic "song": a sequence of chords so the spectrogram has
// structure to fingerprint (white-ish noise wouldn't produce stable peaks).
function makeSong(seed: number, seconds = 8): Float32Array {
  const sr = TARGET_SAMPLE_RATE
  const out = new Float32Array(sr * seconds)
  const baseFreqs = [220, 277, 330, 440, 554, 660, 880]
  for (let i = 0; i < out.length; i++) {
    const t = i / sr
    const section = Math.floor(t * 2) // chord changes twice a second
    const f1 = baseFreqs[(section + seed) % baseFreqs.length]
    const f2 = baseFreqs[(section * 2 + seed + 3) % baseFreqs.length]
    out[i] = 0.5 * Math.sin(2 * Math.PI * f1 * t) + 0.4 * Math.sin(2 * Math.PI * f2 * t)
  }
  return out
}

describe('fingerprint + matchLandmarks', () => {
  it('produces landmarks for structured audio', () => {
    const lm = fingerprint(makeSong(0), TARGET_SAMPLE_RATE)
    expect(lm.length).toBeGreaterThan(50)
  })

  it('matches a noisy clip back to the right track among several', () => {
    const db: FingerprintDb = new Map()
    for (let id = 0; id < 4; id++) {
      addToDb(db, `track-${id}`, fingerprint(makeSong(id), TARGET_SAMPLE_RATE))
    }

    // Take a ~3s slice of track-2 from 2s in, add light noise (mic-ish).
    const full = makeSong(2)
    const start = TARGET_SAMPLE_RATE * 2
    const clip = full.slice(start, start + TARGET_SAMPLE_RATE * 3)
    for (let i = 0; i < clip.length; i++) clip[i] += (Math.random() - 0.5) * 0.05

    const results = matchLandmarks(fingerprint(clip, TARGET_SAMPLE_RATE), db)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('track-2')
    // The true match should clearly beat the runner-up.
    if (results.length > 1) expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('returns no confident match for unrelated audio', () => {
    const db: FingerprintDb = new Map()
    addToDb(db, 'track-0', fingerprint(makeSong(0), TARGET_SAMPLE_RATE))
    // A different song should not rack up a high coherent score on track-0.
    const other = matchLandmarks(fingerprint(makeSong(5), TARGET_SAMPLE_RATE), db)
    const top = other[0]?.score ?? 0
    const selfTop = matchLandmarks(fingerprint(makeSong(0), TARGET_SAMPLE_RATE), db)[0].score
    expect(top).toBeLessThan(selfTop)
  })
})
