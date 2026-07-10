import { useEffect, useMemo, useRef } from 'react'
import { SpotifyMark } from '@/components/common/SpotifyMark'

const CONFETTI_COLORS = ['#1ed760', '#3be477', '#c7f9d8', '#ffffff', '#ffd2d7', '#ffc862']

interface ConfettiPiece {
  left: number
  delay: number
  duration: number
  rotate: number
  drift: number
  color: string
  size: number
  round: boolean
}

function buildConfetti(count: number): ConfettiPiece[] {
  // Deterministic-enough spread; randomness only affects visuals, never logic.
  return Array.from({ length: count }, (_, i) => ({
    left: Math.round((i / count) * 100 + (Math.random() * 8 - 4)),
    delay: Math.random() * 0.5,
    duration: 2.6 + Math.random() * 1.6,
    rotate: Math.round(Math.random() * 360),
    drift: Math.round(Math.random() * 80 - 40),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 7 + Math.round(Math.random() * 6),
    round: Math.random() > 0.5,
  }))
}

export function PremiumSuccessCelebration({
  open,
  planLabel,
  onClose,
}: {
  open: boolean
  planLabel: string
  onClose: () => void
}) {
  const confetti = useMemo(() => buildConfetti(46), [])
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Pull focus to the primary action so keyboard/screen-reader users land here.
    const focusTimer = window.setTimeout(() => buttonRef.current?.focus(), 120)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(focusTimer)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="premium-celebrate-overlay fixed inset-0 z-[120] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-celebrate-title"
      onClick={onClose}
    >
      <div className="premium-celebrate-confetti" aria-hidden="true">
        {confetti.map((piece, i) => (
          <span
            key={i}
            className="premium-celebrate-piece"
            style={{
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              background: piece.color,
              borderRadius: piece.round ? '999px' : '2px',
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              // Custom props drive the drift + spin inside the keyframes.
              ['--drift' as string]: `${piece.drift}px`,
              ['--spin' as string]: `${piece.rotate}deg`,
            }}
          />
        ))}
      </div>

      <div
        className="premium-celebrate-card relative w-full max-w-md rounded-2xl px-8 pb-8 pt-10 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="premium-celebrate-badge mx-auto flex h-24 w-24 items-center justify-center rounded-full">
          <span className="premium-celebrate-ring" aria-hidden="true" />
          <svg viewBox="0 0 52 52" className="premium-celebrate-check h-12 w-12" aria-hidden="true">
            <path
              className="premium-celebrate-check-path"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 27 L23 36 L39 18"
            />
          </svg>
        </div>

        <p className="premium-celebrate-eyebrow mt-6 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em]">
          <SpotifyMark className="h-4 w-4" />
          not-spotify Premium
        </p>

        <h2
          id="premium-celebrate-title"
          className="premium-celebrate-heading mt-2 text-3xl font-black leading-tight"
        >
          You're Premium!
        </h2>

        <p className="premium-celebrate-body mt-3 text-sm font-semibold leading-relaxed">
          Your Premium purchase is complete. <span className="premium-celebrate-plan">{planLabel}</span> is
          now active — enjoy ad-free listening with full playback control.
        </p>

        <button
          ref={buttonRef}
          type="button"
          onClick={onClose}
          className="premium-celebrate-cta mt-7 w-full rounded-full py-3 text-sm font-black transition-transform hover:scale-[1.02] active:scale-95"
        >
          Start listening
        </button>
      </div>
    </div>
  )
}
