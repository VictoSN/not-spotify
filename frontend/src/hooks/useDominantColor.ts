import { useEffect, useState } from 'react'
import { Vibrant } from 'node-vibrant/browser'

// Extract the dominant colour from a cover image (for Spotify-style gradient hues).
// Results are cached by URL; failures (e.g. CORS) resolve to null and are ignored.
const cache = new Map<string, string | null>()

export async function getDominantColor(url: string): Promise<string | null> {
  const cached = cache.get(url)
  if (cached !== undefined) return cached
  try {
    const palette = await new Vibrant(url).getPalette()
    const hex =
      palette.Vibrant?.hex ??
      palette.LightVibrant?.hex ??
      palette.DarkVibrant?.hex ??
      palette.Muted?.hex ??
      null
    cache.set(url, hex)
    return hex
  } catch {
    cache.set(url, null)
    return null
  }
}

export function useDominantColor(url: string | null | undefined): string | null {
  const [color, setColor] = useState<string | null>(() => (url ? cache.get(url) ?? null : null))

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
