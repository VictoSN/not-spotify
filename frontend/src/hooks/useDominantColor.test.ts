import { describe, it, expect } from 'vitest'
import { dominantHslFromPixels } from './useDominantColor'

/** Build flat RGBA pixel data (height 1) from a list of opaque RGB colours. */
function makePixels(colors: Array<[number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colors.length * 4)
  colors.forEach(([r, g, b], i) => {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  })
  return data
}

const fill = (color: [number, number, number], n: number) =>
  Array.from({ length: n }, () => color)

describe('dominantHslFromPixels', () => {
  it('picks the large purple field over a small vivid orange accent (the Fábula case)', () => {
    // ~70% purple wall, ~30% orange fan.
    const colors = [...fill([120, 40, 180], 70), ...fill([230, 120, 30], 30)]
    const res = dominantHslFromPixels(makePixels(colors), colors.length, 1)
    expect(res).not.toBeNull()
    // Violet, not orange (~27°).
    expect(res!.h).toBeGreaterThan(255)
    expect(res!.h).toBeLessThan(295)
  })

  it('favours a vivid hue over a larger field of a duller colour (the GREENGREEN case)', () => {
    // 60 muted-blue (denim/shadow) vs 30 vivid green (painted beam): green should win
    // on vibrancy even though blue covers more area.
    const colors = [...fill([80, 110, 180], 60), ...fill([40, 200, 60], 30)]
    const res = dominantHslFromPixels(makePixels(colors), colors.length, 1)
    expect(res).not.toBeNull()
    // Green (~127°), not blue (~222°).
    expect(res!.h).toBeGreaterThan(95)
    expect(res!.h).toBeLessThan(160)
  })

  it('returns a small saturated patch over a mostly-grey frame', () => {
    const colors = [...fill([128, 128, 128], 95), ...fill([40, 200, 60], 5)]
    const res = dominantHslFromPixels(makePixels(colors), colors.length, 1)
    expect(res).not.toBeNull()
    // Green (~127°), with real saturation — the grey must not win.
    expect(res!.h).toBeGreaterThan(95)
    expect(res!.h).toBeLessThan(155)
    expect(res!.s).toBeGreaterThan(0.3)
  })

  it('falls back to a neutral reading for a flat greyscale cover', () => {
    const res = dominantHslFromPixels(makePixels(fill([130, 130, 130], 50)), 50, 1)
    expect(res).not.toBeNull()
    expect(res!.h).toBe(210)
    expect(res!.s).toBeLessThan(0.1)
  })

  it('returns null when there is nothing readable (all near-black)', () => {
    const res = dominantHslFromPixels(makePixels(fill([5, 5, 5], 20)), 20, 1)
    expect(res).toBeNull()
  })
})
