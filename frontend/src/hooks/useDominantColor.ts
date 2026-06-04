import { useEffect, useState } from 'react'
import { Vibrant } from 'node-vibrant/browser'

// Extract the dominant colour from a cover image (for Spotify-style gradient hues).
// Results are cached by URL; failures (e.g. CORS) resolve to null and are ignored.
const cache = new Map<string, string | null>()

function hexToRgb(hex: string) {
  const value = hex.replace('#', '')
  if (value.length !== 6) return null
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4

  return { h: h * 60, s, l }
}

function normalizeHue(hex: string | null): string | null {
  if (!hex) return null
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const { h, s, l } = rgbToHsl(rgb)

  if (l > 0.72 && s < 0.55) return 'hsl(210 8% 28%)'
  if (l > 0.68) return `hsl(${Math.round(h)} ${Math.min(s * 55, 24).toFixed(0)}% 30%)`
  if (s < 0.18) return 'hsl(210 7% 24%)'

  return `hsl(${Math.round(h)} ${Math.min(s * 80, 48).toFixed(0)}% ${Math.min(l * 55, 34).toFixed(0)}%)`
}

export async function getDominantColor(url: string): Promise<string | null> {
  const cached = cache.get(url)
  if (cached !== undefined) return cached
  try {
    const palette = await new Vibrant(url).getPalette()
    const hex =
      palette.Vibrant?.hex ?? palette.LightVibrant?.hex ?? palette.DarkVibrant?.hex ?? palette.Muted?.hex ?? null
    const color = normalizeHue(hex)
    cache.set(url, color)
    return color
  } catch {
    cache.set(url, null)
    return null
  }
}

export function useDominantColor(url: string | null | undefined): string | null {
  const [color, setColor] = useState<string | null>(() => (url ? (cache.get(url) ?? null) : null))

  useEffect(() => {
    if (!url) return
    let active = true
    getDominantColor(url).then((c) => {
      if (active) setColor(c)
    })
    return () => {
      active = false
    }
  }, [url])

  return color
}
