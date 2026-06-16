import { useEffect, useState } from 'react'
import { AdjustmentsHorizontalIcon, MoonIcon } from '@heroicons/react/24/outline'
import { MoonIcon as MoonSolid } from '@heroicons/react/24/solid'
import { Slider } from '@/components/ui/Slider'
import {
  EQUALIZER_BANDS,
  EQUALIZER_EVENT,
  EQUALIZER_PRESETS,
  type EqualizerPresetId,
  getEqualizerSettings,
  getPresetGains,
  normalizeEqualizerSettings,
  saveEqualizerSettings,
} from '@/services/equalizerPrefs'
import { usePlayerStore } from '@/stores/playerStore'
import { cn } from '@/utils/cn'

const RATES = [1, 1.25, 1.5, 2, 0.75]
const TIMER_OPTIONS = [15, 30, 45, 60]

export function EqualizerButton() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(getEqualizerSettings)
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = event instanceof CustomEvent
        ? normalizeEqualizerSettings(event.detail)
        : getEqualizerSettings()
      setSettings(next)
    }
    window.addEventListener(EQUALIZER_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(EQUALIZER_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  if (!currentTrack) return null

  const active = settings.gains.some((gain) => gain !== 0)

  const applyPreset = (preset: EqualizerPresetId) => {
    const next = { preset, gains: getPresetGains(preset) }
    setSettings(next)
    saveEqualizerSettings(next)
  }

  const setGain = (index: number, gain: number) => {
    const gains = settings.gains.map((current, i) => (i === index ? gain : current))
    const next = { preset: 'custom' as const, gains }
    setSettings(next)
    saveEqualizerSettings(next)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'transition-all hover:scale-110 active:scale-90',
          active ? 'text-accent' : 'text-secondary hover:text-primary',
        )}
        aria-label="Equalizer"
        aria-pressed={active}
        title="Equalizer"
      >
        <AdjustmentsHorizontalIcon className="w-5 h-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-50 mb-3 w-72 rounded-md border border-secondary/10 bg-elevated p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">Equalizer</p>
              <select
                aria-label="Equalizer preset"
                value={settings.preset}
                onChange={(e) => applyPreset(e.target.value as EqualizerPresetId)}
                className="rounded-md border border-secondary/20 bg-surface px-2 py-1 text-xs font-semibold text-primary outline-none transition-colors hover:border-secondary/40 focus:border-accent"
              >
                {EQUALIZER_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="space-y-3">
              {EQUALIZER_BANDS.map((band, i) => (
                <div key={band.frequency} className="grid grid-cols-[3.5rem_1fr_2.25rem] items-center gap-3">
                  <span className="text-xs font-semibold text-secondary">{band.label}</span>
                  <Slider
                    value={settings.gains[i] ?? 0}
                    min={-12}
                    max={12}
                    step={1}
                    onValueChange={(value) => setGain(i, value)}
                    aria-label={`${band.label} gain`}
                    trackClassName="bg-surface"
                    thumbClassName="opacity-100 md:opacity-100"
                  />
                  <span className="text-right text-xs tabular-nums text-secondary">
                    {(settings.gains[i] ?? 0) > 0 ? '+' : ''}{settings.gains[i] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Playback-speed cycler — shows the current rate, clicks advance through RATES. */
export function PlaybackSpeedButton() {
  const playbackRate = usePlayerStore((s) => s.playbackRate)
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  if (!currentTrack) return null

  const next = RATES[(RATES.indexOf(playbackRate) + 1) % RATES.length] ?? 1
  return (
    <button
      onClick={() => setPlaybackRate(next)}
      className={`w-9 text-xs font-bold tabular-nums transition-all hover:scale-110 active:scale-90 ${
        playbackRate !== 1 ? 'text-accent' : 'text-secondary hover:text-primary'
      }`}
      aria-label={`Playback speed ${playbackRate}x — click for ${next}x`}
      title={`Playback speed (${playbackRate}×)`}
    >
      {playbackRate}×
    </button>
  )
}

/** Sleep timer — moon icon with a small popover; pauses playback when it elapses. */
export function SleepTimerButton() {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const sleepTimerEndsAt = usePlayerStore((s) => s.sleepTimerEndsAt)
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer)
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  useEffect(() => {
    if (sleepTimerEndsAt == null) return
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [sleepTimerEndsAt])

  if (!currentTrack) return null

  const active = sleepTimerEndsAt != null
  const minutesLeft = active ? Math.max(1, Math.ceil((sleepTimerEndsAt - now) / 60_000)) : null

  const pick = (minutes: number | null) => {
    setSleepTimer(minutes)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`transition-all hover:scale-110 active:scale-90 ${active ? 'text-accent' : 'text-secondary hover:text-primary'}`}
        aria-label={active ? `Sleep timer: ${minutesLeft} min left` : 'Sleep timer'}
        aria-pressed={active}
        title={active ? `Sleep timer: ~${minutesLeft} min left` : 'Sleep timer'}
      >
        {active ? <MoonSolid className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-50 mb-3 w-44 rounded-md border border-secondary/10 bg-elevated py-1 shadow-2xl">
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-secondary">
              Sleep timer
            </p>
            {TIMER_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => pick(m)}
                className="block w-full px-3 py-2 text-left text-sm font-semibold text-primary transition-colors hover:bg-surface"
              >
                {m} minutes
              </button>
            ))}
            {active && (
              <>
                <div className="my-1 border-t border-secondary/10" />
                <button
                  onClick={() => pick(null)}
                  className="block w-full px-3 py-2 text-left text-sm font-semibold text-accent transition-colors hover:bg-surface"
                >
                  Turn off ({minutesLeft} min left)
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
