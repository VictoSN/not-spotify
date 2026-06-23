import { describe, it, expect, beforeEach } from 'vitest'
import {
  readCrossfadeSeconds,
  readNormalizeEnabled,
  readQuality,
  effectiveQuality,
  clampQualityToPlan,
  qualityCutoffHz,
  isHlsSource,
  qualityToHlsLevelCap,
} from './audioEngine'

// These are the engine's pure decision helpers: they drive the loadSource
// MP3-vs-HLS branch, the streaming-quality low-pass cutoff, the HLS bitrate cap,
// and the crossfade/normalize preference reads. The Web Audio graph wiring and
// the crossfade ramp itself need a real <audio>/AudioContext and are covered by
// the manual two-browser checks noted in the test plan.

beforeEach(() => localStorage.clear())

describe('readCrossfadeSeconds', () => {
  it('defaults to 0 when unset or unparseable', () => {
    expect(readCrossfadeSeconds()).toBe(0)
    localStorage.setItem('ns-pref-crossfade', 'not-json')
    expect(readCrossfadeSeconds()).toBe(0)
    localStorage.setItem('ns-pref-crossfade', '"abc"')
    expect(readCrossfadeSeconds()).toBe(0)
  })

  it('honours numeric seconds and clamps to 0..12', () => {
    localStorage.setItem('ns-pref-crossfade', '8')
    expect(readCrossfadeSeconds()).toBe(8)
    localStorage.setItem('ns-pref-crossfade', '99')
    expect(readCrossfadeSeconds()).toBe(12)
    localStorage.setItem('ns-pref-crossfade', '-5')
    expect(readCrossfadeSeconds()).toBe(0)
  })

  it('back-compat: a boolean toggle maps true→6, false→0', () => {
    localStorage.setItem('ns-pref-crossfade', 'true')
    expect(readCrossfadeSeconds()).toBe(6)
    localStorage.setItem('ns-pref-crossfade', 'false')
    expect(readCrossfadeSeconds()).toBe(0)
  })
})

describe('readNormalizeEnabled', () => {
  it('is true only for the literal "true"', () => {
    expect(readNormalizeEnabled()).toBe(false)
    localStorage.setItem('ns-pref-normalize', 'true')
    expect(readNormalizeEnabled()).toBe(true)
    localStorage.setItem('ns-pref-normalize', 'false')
    expect(readNormalizeEnabled()).toBe(false)
  })
})

describe('readQuality', () => {
  it('defaults to auto and reads a JSON string tier', () => {
    expect(readQuality()).toBe('auto')
    localStorage.setItem('ns-pref-quality', JSON.stringify('low'))
    expect(readQuality()).toBe('low')
    localStorage.setItem('ns-pref-quality', '123') // non-string
    expect(readQuality()).toBe('auto')
  })
})

describe('clampQualityToPlan / effectiveQuality', () => {
  it('passes everything through for premium', () => {
    for (const q of ['low', 'normal', 'high', 'veryhigh', 'auto']) {
      expect(clampQualityToPlan(q, 'premium')).toBe(q)
    }
  })

  it('caps free accounts at ~128 kbps (normal), pinning higher tiers and auto', () => {
    expect(clampQualityToPlan('low', 'free')).toBe('low')
    expect(clampQualityToPlan('normal', 'free')).toBe('normal')
    expect(clampQualityToPlan('high', 'free')).toBe('normal')
    expect(clampQualityToPlan('veryhigh', 'free')).toBe('normal')
    expect(clampQualityToPlan('auto', 'free')).toBe('normal')
    expect(clampQualityToPlan('high', null)).toBe('normal') // unknown plan → treat as free
  })

  it('effectiveQuality clamps the stored preference by the mirrored plan', () => {
    localStorage.setItem('ns-pref-quality', JSON.stringify('veryhigh'))
    localStorage.setItem('ns-plan', 'free')
    expect(effectiveQuality()).toBe('normal')
    localStorage.setItem('ns-plan', 'premium')
    expect(effectiveQuality()).toBe('veryhigh')
  })
})

describe('qualityCutoffHz', () => {
  it('maps each tier to its low-pass cutoff; unknown → full bandwidth', () => {
    expect(qualityCutoffHz('low')).toBe(8000)
    expect(qualityCutoffHz('normal')).toBe(13000)
    expect(qualityCutoffHz('high')).toBe(17000)
    expect(qualityCutoffHz('veryhigh')).toBe(22050)
    expect(qualityCutoffHz('auto')).toBe(22050)
    expect(qualityCutoffHz('mystery')).toBe(22050)
  })
})

describe('isHlsSource', () => {
  it('detects .m3u8 manifests including query/hash, and rejects single files', () => {
    expect(isHlsSource('https://cdn/track/playlist.m3u8')).toBe(true)
    expect(isHlsSource('https://cdn/track/playlist.m3u8?token=abc')).toBe(true)
    expect(isHlsSource('https://cdn/track/playlist.m3u8#frag')).toBe(true)
    expect(isHlsSource('https://cdn/track/PLAYLIST.M3U8')).toBe(true) // case-insensitive
    expect(isHlsSource('https://cdn/audio/song.mp3')).toBe(false)
    expect(isHlsSource('https://cdn/audio/m3u8.mp3')).toBe(false)
  })
})

describe('qualityToHlsLevelCap', () => {
  it('caps the bitrate ladder per tier; auto/veryhigh stay uncapped', () => {
    expect(qualityToHlsLevelCap('low')).toBe(0)
    expect(qualityToHlsLevelCap('normal')).toBe(1)
    expect(qualityToHlsLevelCap('high')).toBe(2)
    expect(qualityToHlsLevelCap('veryhigh')).toBe(-1)
    expect(qualityToHlsLevelCap('auto')).toBe(-1)
    expect(qualityToHlsLevelCap('mystery')).toBe(-1)
  })
})
