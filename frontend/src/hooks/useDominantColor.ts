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

  // Keep enough of the artwork's brightness and saturation for the tint to feel
  // related to the image. Theme-aware gradients below blend this colour with the
  // page surface, so it no longer needs to be pre-darkened almost to black.
  if (l > 0.82 && s < 0.2) return 'hsl(210 8% 58%)'
  if (s < 0.14) return `hsl(210 7% ${Math.round(Math.min(Math.max(l * 78, 36), 58))}%)`

  const saturation = Math.min(Math.max(s * 105, 34), 72)
  const lightness = Math.min(Math.max(l * 78, 38), 56)
  return `hsl(${Math.round(h)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`
}

/**
 * Translucent version of an extracted colour for gradient stops.
 * getDominantColor returns hsl() strings, so hex-alpha suffixes ("b3") are
 * invalid CSS — color-mix works for any colour format.
 */
export function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}

/**
 * Spotify-style hero background for detail pages: a fuller, near-solid block of
 * the cover colour behind the artwork + title (the top ~half), then a fade to the
 * page background below it. Wrap the hero AND action bar in a div using this so the
 * colour reads solid over the cover and the gradient only starts beneath it.
 * Returns undefined when no colour is known so callers can omit the inline style.
 */
export function heroGradient(color: string | null | undefined): string | undefined {
  if (!color) return undefined
  return `linear-gradient(to bottom, color-mix(in srgb, ${color} var(--artwork-hero-strength), var(--c-page)) 0%, color-mix(in srgb, ${color} var(--artwork-hero-strength), var(--c-page)) 46%, color-mix(in srgb, ${color} var(--artwork-fade-strength), transparent) 72%, color-mix(in srgb, ${color} 10%, transparent) 90%, transparent 100%)`
}

/**
 * Solid background for a sticky filter/header bar that should read as the *same*
 * hue as the page's hero wash. The hero is the extracted colour painted at ~60%
 * (`opacity-60`) over `--c-page`, so we mirror that exact ratio here (a touch
 * higher, 64%, only so the bar stays opaque/legible while content scrolls under
 * it). Pass the SAME colour the hero uses (the top hue, not a darker bottom
 * stop) so the scrolled header stays within ~5% of the hero instead of looking
 * like a separate browner strip. Returns the plain page colour when no hue is
 * known. Shared by every hue-driven sticky header (Home + future pages).
 */
export function hueHeaderBackground(color: string | null | undefined): string {
  if (!color) return 'var(--c-page)'
  return `color-mix(in srgb, ${color} 64%, var(--c-page))`
}

/** A lighter, airier tint for profile headers that adapts to the active theme. */
export function profileGradient(color: string | null | undefined): string {
  const tint = color ?? 'var(--c-accent-dim)'
  return `linear-gradient(180deg, color-mix(in srgb, ${tint} var(--artwork-profile-strength), var(--c-page)) 0%, color-mix(in srgb, ${tint} 18%, transparent) 68%, transparent 100%)`
}

/** Subtle continuation of an artwork hue into the content below a banner. */
export function artworkSectionGradient(color: string): string {
  return `linear-gradient(180deg, color-mix(in srgb, ${color} var(--artwork-section-strength), var(--c-page)) 0, color-mix(in srgb, ${color} 10%, transparent) 8rem, transparent 20rem)`
}

// How much each node-vibrant swatch is allowed to represent the whole cover.
// Taking the `Vibrant` swatch outright biases toward small, intensely-saturated
// accents (a red fan, gold text, a neon prop) over the colour that actually
// fills the frame — so the Fábula cover, a wall of purple behind an orange fan,
// used to tint the page brown/orange. We instead prefer the deep, muted,
// background-like swatches (dark-muted → muted → dark-vibrant → vibrant) and
// push the light highlight swatches (skin, blown-out gold) to the back, exactly
// the order Spotify's now-playing hue follows.
const SWATCH_WEIGHT: Record<string, number> = {
  DarkMuted: 1.35,
  Muted: 1.2,
  DarkVibrant: 1.12,
  Vibrant: 1.0,
  LightMuted: 0.62,
  LightVibrant: 0.5,
}

/**
 * Pick the swatch that best represents the artwork's *background*. Each swatch
 * is scored by population (how much of the image it covers) × a category weight
 * (favouring dark/muted background tones) and lightly by saturation so a muddy
 * tie breaks toward the more colourful option. This keeps a large purple field
 * winning over a small vivid accent, and a real colour winning over flat grey.
 */
function pickSwatchHex(palette: Record<string, { hex: string; population: number; hsl: number[] } | null>): string | null {
  let bestHex: string | null = null
  let bestScore = -1
  for (const [name, swatch] of Object.entries(palette)) {
    if (!swatch || swatch.population <= 0) continue
    const saturation = swatch.hsl?.[1] ?? 0
    const weight = SWATCH_WEIGHT[name] ?? 1
    const score = swatch.population * weight * (0.6 + saturation * 0.4)
    if (score > bestScore) {
      bestScore = score
      bestHex = swatch.hex
    }
  }
  return bestHex
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
      const color = normalizeHue(pickSwatchHex(palette))
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
