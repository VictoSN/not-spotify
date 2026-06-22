import { useEffect, useState } from 'react'
import { Vibrant } from 'node-vibrant/browser'

// Extract the dominant colour from a cover image (for Spotify-style gradient hues).
// Cache successful reads only, keyed by URL; a transient image/CORS failure must
// not leave the gradients colourless for the rest of the session. In-flight reads
// are de-duped so the same cover isn't decoded twice.
const cache = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

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

/**
 * Translucent version of an extracted colour for gradient stops.
 * getDominantColor returns hsl() strings, so hex-alpha suffixes ("b3") are
 * invalid CSS — color-mix works for any colour format.
 */
export function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}

export async function getDominantColor(url: string): Promise<string | null> {
  const cached = cache.get(url)
  if (cached) return cached

  const existing = pending.get(url)
  if (existing) return existing

  const request = (async () => {
    let objectUrl: string | null = null
    try {
      // Load via an explicit CORS fetch → blob URL instead of handing the remote
      // URL straight to node-vibrant. The cover is also rendered by a plain <img>,
      // which sends no Origin header, so S3 caches that copy WITHOUT an
      // Access-Control-Allow-Origin header. Chrome then serves that cached non-CORS
      // copy to node-vibrant's crossOrigin request and rejects the canvas read
      // ("No 'Access-Control-Allow-Origin' header is present") even though the bucket
      // allows our origin — Firefox partitions its cache and isn't affected. fetch()
      // always sends Origin, and a blob: URL is same-origin so the canvas is never
      // tainted. `cache: 'reload'` is essential: Chrome otherwise reuses the plain
      // <img>'s cached no-ACAO copy even for this CORS request (Vary: Origin is not
      // honoured here), so a plain `fetch` would fail the same way the <img> did.
      // The resolved colour is memoised below, so this network read runs once per URL.
      const res = await fetch(url, { mode: 'cors', cache: 'reload' })
      if (!res.ok) return null
      objectUrl = URL.createObjectURL(await res.blob())
      const palette = await new Vibrant(objectUrl).getPalette()
      const hex =
        palette.Vibrant?.hex ?? palette.LightVibrant?.hex ?? palette.DarkVibrant?.hex ?? palette.Muted?.hex ?? null
      const color = normalizeHue(hex)
      if (color) cache.set(url, color)
      return color
    } catch {
      return null
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      pending.delete(url)
    }
  })()

  pending.set(url, request)
  return request
}

export function useDominantColor(
  url: string | null | undefined,
  options?: { resetOnChange?: boolean },
): string | null {
  const [color, setColor] = useState<string | null>(() => (url ? (cache.get(url) ?? null) : null))
  const resetOnChange = options?.resetOnChange ?? false

  useEffect(() => {
    // The artist page opts into resetting because its source switches between the
    // banner and the profile picture — without this the previous artist's tint
    // would linger until the new colour resolves.
    if (resetOnChange) {
      setColor(url ? (cache.get(url) ?? null) : null)
    }
    if (!url) return
    let active = true
    getDominantColor(url).then((c) => {
      if (active) setColor(c)
    })
    return () => {
      active = false
    }
  }, [resetOnChange, url])

  return color
}
