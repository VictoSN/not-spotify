import { useState } from 'react'
import { MoonIcon } from '@heroicons/react/24/outline'
import { MoonIcon as MoonSolid } from '@heroicons/react/24/solid'
import { usePlayerStore } from '@/stores/playerStore'

const RATES = [1, 1.25, 1.5, 2, 0.75]
const TIMER_OPTIONS = [15, 30, 45, 60]

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
  const sleepTimerEndsAt = usePlayerStore((s) => s.sleepTimerEndsAt)
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  if (!currentTrack) return null

  const active = sleepTimerEndsAt != null
  const minutesLeft = active ? Math.max(1, Math.ceil((sleepTimerEndsAt - Date.now()) / 60_000)) : null

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
