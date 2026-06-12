import { useEffect, useMemo, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { usePlayerStore } from '@/stores/playerStore'
import { parseLrc, activeLineIndex } from '@/utils/parseLrc'
import { cn } from '@/utils/cn'

interface LyricsViewProps {
  lyrics?: string | null
  syncedLyrics?: string | null
  /** Track these lyrics belong to — karaoke sync only runs while it is the playing track. */
  trackId?: string
  loading?: boolean
  /**
   * 'page' = large text on track page, 'card' = compact for the now-playing rail/sheet,
   * 'full' = fullscreen karaoke view (huge text, fills the parent's height).
   */
  variant?: 'page' | 'card' | 'full'
}

// How long after a manual scroll before auto-scroll takes over again.
const USER_SCROLL_GRACE_MS = 3000

export function LyricsView({ lyrics, syncedLyrics, trackId, loading, variant = 'page' }: LyricsViewProps) {
  const lines = useMemo(() => (syncedLyrics ? parseLrc(syncedLyrics) : null), [syncedLyrics])

  // Selector returns just the active line index so we only re-render when it changes,
  // not on every ~250ms timeupdate tick.
  const activeIndex = usePlayerStore((s) =>
    lines && trackId && s.currentTrack?.id === trackId ? activeLineIndex(lines, s.currentTime * 1000) : -1,
  )
  const isSynced = usePlayerStore((s) => !!lines && !!trackId && s.currentTrack?.id === trackId)
  const seek = usePlayerStore((s) => s.seek)

  const isFull = variant === 'full'

  const containerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([])
  // Timestamps guarding the auto-scroll vs. user-scroll tug-of-war.
  const programmaticScrollUntil = useRef(0)
  const userScrollUntil = useRef(0)
  // Fullscreen karaoke only: shown after the user scrolls away; clicking it re-centres.
  const [showSync, setShowSync] = useState(false)

  // Scroll the active line to the vertical centre of the container.
  const centerActiveLine = () => {
    const container = containerRef.current
    const el = lineRefs.current[activeIndex]
    if (!container || !el) return
    programmaticScrollUntil.current = Date.now() + 800
    container.scrollTo({
      top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  // Keep the active line vertically centred, unless the user just scrolled by hand.
  useEffect(() => {
    if (!isSynced || activeIndex < 0) return
    if (Date.now() < userScrollUntil.current) return
    centerActiveLine()
    setShowSync(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isSynced])

  // Reset the scroll tug-of-war when the track changes.
  useEffect(() => {
    userScrollUntil.current = 0
    setShowSync(false)
  }, [trackId])

  const onScroll = () => {
    // Ignore the scroll events our own smooth-scroll animation generates.
    if (Date.now() < programmaticScrollUntil.current) return
    if (isFull) {
      // Pause auto-scroll until the user taps Sync, and surface the button.
      userScrollUntil.current = Number.MAX_SAFE_INTEGER
      setShowSync(true)
    } else {
      userScrollUntil.current = Date.now() + USER_SCROLL_GRACE_MS
    }
  }

  // Re-snap to the current line and resume following playback.
  const resync = () => {
    userScrollUntil.current = 0
    setShowSync(false)
    centerActiveLine()
  }

  // Clicking a lyric line seeks there and also resumes following.
  const seekToLine = (timeMs: number) => {
    userScrollUntil.current = 0
    setShowSync(false)
    seek(timeMs / 1000)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="md" />
      </div>
    )
  }

  if (!lyrics && !lines) {
    return (
      <p className="py-10 text-sm text-secondary italic">
        No lyrics available for this song.
      </p>
    )
  }

  // Karaoke mode — timed lines exist and this track is the one playing.
  if (lines && isSynced) {
    const isCard = variant === 'card'
    const scroller = (
      <div
        ref={containerRef}
        onScroll={onScroll}
        className={cn(
          'relative overflow-y-auto scrollbar-hide',
          isCard ? 'max-h-72' : isFull ? 'h-full' : 'max-h-[28rem]',
        )}
      >
        <div
          className={cn(
            'flex flex-col items-start',
            isCard ? 'gap-1 py-3' : isFull ? 'gap-5 py-[30vh]' : 'gap-2 py-6',
          )}
        >
          {lines.map((line, i) => (
            <button
              key={`${line.timeMs}-${i}`}
              ref={(el) => { lineRefs.current[i] = el }}
              onClick={() => seekToLine(line.timeMs)}
              className={cn(
                'text-left font-bold transition-all duration-300 hover:text-primary',
                isCard ? 'text-base leading-6' : isFull ? 'text-3xl leading-snug lg:text-4xl' : 'text-2xl leading-9',
                i === activeIndex
                  ? 'text-primary scale-[1.02] origin-left'
                  : i < activeIndex
                    ? 'text-secondary/80'
                    : 'text-secondary/50',
              )}
            >
              {line.text || '♪'}
            </button>
          ))}
        </div>
      </div>
    )

    if (!isFull) return scroller

    // Fullscreen karaoke: wrap so the "Sync" pill can float bottom-centre.
    return (
      <div className="relative h-full">
        {scroller}
        {showSync && (
          <button
            onClick={resync}
            className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-page shadow-xl transition-all hover:scale-105 active:scale-95"
            aria-label="Sync lyrics to playback"
          >
            <EqualizerIcon className="h-4 w-4" />
            Sync
          </button>
        )}
      </div>
    )
  }

  // Static fallback — prefer text derived from the timed lyrics so the static view
  // always matches what karaoke shows (cached plain lyrics can come from a different
  // provider lookup, e.g. a romanized entry while the synced one is in the original script).
  const staticText = lines ? lines.map((l) => l.text).join('\n') : lyrics
  return (
    <div
      className={cn(
        'whitespace-pre-wrap text-primary',
        variant === 'card'
          ? 'max-h-72 overflow-y-auto text-sm leading-7'
          : variant === 'full'
            ? 'h-full overflow-y-auto scrollbar-hide py-10 text-3xl font-bold leading-snug lg:text-4xl'
            : 'text-sm leading-8',
      )}
    >
      {staticText}
    </div>
  )
}

/** Small equalizer/waveform glyph for the Sync pill. */
function EqualizerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="5" y1="9" x2="5" y2="15" />
        <line x1="9.67" y1="6" x2="9.67" y2="18" />
        <line x1="14.33" y1="8" x2="14.33" y2="16" />
        <line x1="19" y1="5" x2="19" y2="19" />
      </g>
    </svg>
  )
}
