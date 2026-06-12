import { useEffect, useMemo, useRef } from 'react'
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
  /** 'page' = large text on track page, 'card' = compact for the now-playing rail/sheet. */
  variant?: 'page' | 'card'
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

  const containerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([])
  // Timestamps guarding the auto-scroll vs. user-scroll tug-of-war.
  const programmaticScrollUntil = useRef(0)
  const userScrollUntil = useRef(0)

  // Keep the active line vertically centred, unless the user just scrolled by hand.
  useEffect(() => {
    if (!isSynced || activeIndex < 0) return
    const container = containerRef.current
    const el = lineRefs.current[activeIndex]
    if (!container || !el) return
    if (Date.now() < userScrollUntil.current) return

    programmaticScrollUntil.current = Date.now() + 800
    container.scrollTo({
      top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
      behavior: 'smooth',
    })
  }, [activeIndex, isSynced])

  const onScroll = () => {
    if (Date.now() > programmaticScrollUntil.current) {
      userScrollUntil.current = Date.now() + USER_SCROLL_GRACE_MS
    }
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
    return (
      <div
        ref={containerRef}
        onScroll={onScroll}
        className={cn('relative overflow-y-auto scrollbar-hide', isCard ? 'max-h-72' : 'max-h-[28rem]')}
      >
        <div className={cn('flex flex-col items-start', isCard ? 'gap-1 py-3' : 'gap-2 py-6')}>
          {lines.map((line, i) => (
            <button
              key={`${line.timeMs}-${i}`}
              ref={(el) => { lineRefs.current[i] = el }}
              onClick={() => seek(line.timeMs / 1000)}
              className={cn(
                'text-left font-bold transition-all duration-300 hover:text-primary',
                isCard ? 'text-base leading-6' : 'text-2xl leading-9',
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
  }

  // Static fallback — plain lyrics, or timed lyrics for a track that isn't playing
  // (strip the karaoke chrome, just show the text).
  const staticText = lyrics ?? lines!.map((l) => l.text).join('\n')
  return (
    <div
      className={cn(
        'whitespace-pre-wrap text-primary',
        variant === 'card' ? 'max-h-72 overflow-y-auto text-sm leading-7' : 'text-sm leading-8',
      )}
    >
      {staticText}
    </div>
  )
}
