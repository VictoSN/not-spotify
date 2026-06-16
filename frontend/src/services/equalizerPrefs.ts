export const EQUALIZER_STORAGE_KEY = 'ns-pref-equalizer'
export const EQUALIZER_EVENT = 'ns-equalizer-change'

export const EQUALIZER_BANDS = [
  { label: '60 Hz', frequency: 60, type: 'lowshelf' as BiquadFilterType },
  { label: '170 Hz', frequency: 170, type: 'peaking' as BiquadFilterType },
  { label: '350 Hz', frequency: 350, type: 'peaking' as BiquadFilterType },
  { label: '1 kHz', frequency: 1000, type: 'peaking' as BiquadFilterType },
  { label: '3.5 kHz', frequency: 3500, type: 'peaking' as BiquadFilterType },
  { label: '10 kHz', frequency: 10000, type: 'highshelf' as BiquadFilterType },
]

export const EQUALIZER_PRESETS = [
  { id: 'flat', label: 'Flat', gains: [0, 0, 0, 0, 0, 0] },
  { id: 'bass', label: 'Bass', gains: [6, 4, 2, 0, 0, 1] },
  { id: 'pop', label: 'Pop', gains: [-1, 2, 4, 3, 1, -1] },
  { id: 'rock', label: 'Rock', gains: [4, 3, -2, -1, 3, 5] },
  { id: 'vocal', label: 'Vocal', gains: [-3, -1, 2, 5, 4, 1] },
] as const

export type EqualizerPresetId = (typeof EQUALIZER_PRESETS)[number]['id'] | 'custom'

export interface EqualizerSettings {
  preset: EqualizerPresetId
  gains: number[]
}

const MIN_GAIN = -12
const MAX_GAIN = 12
const DEFAULT_SETTINGS: EqualizerSettings = {
  preset: 'flat',
  gains: [...EQUALIZER_PRESETS[0].gains],
}

function clampGain(value: unknown): number {
  const gain = Number(value)
  if (!Number.isFinite(gain)) return 0
  return Math.max(MIN_GAIN, Math.min(MAX_GAIN, Math.round(gain)))
}

export function normalizeEqualizerSettings(value: unknown): EqualizerSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS
  const raw = value as Partial<EqualizerSettings>
  const gains = Array.isArray(raw.gains)
    ? EQUALIZER_BANDS.map((_, i) => clampGain(raw.gains?.[i]))
    : DEFAULT_SETTINGS.gains
  const preset = raw.preset && (raw.preset === 'custom' || EQUALIZER_PRESETS.some((p) => p.id === raw.preset))
    ? raw.preset
    : 'custom'

  return { preset, gains }
}

export function getPresetGains(preset: EqualizerPresetId): number[] {
  return [...(EQUALIZER_PRESETS.find((p) => p.id === preset)?.gains ?? DEFAULT_SETTINGS.gains)]
}

export function getEqualizerSettings(): EqualizerSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(EQUALIZER_STORAGE_KEY)
    return raw ? normalizeEqualizerSettings(JSON.parse(raw)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveEqualizerSettings(settings: EqualizerSettings) {
  const normalized = normalizeEqualizerSettings(settings)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EQUALIZER_STORAGE_KEY, JSON.stringify(normalized))
    window.dispatchEvent(new CustomEvent(EQUALIZER_EVENT, { detail: normalized }))
  } catch {
    /* ignore persistence failures */
  }
}
