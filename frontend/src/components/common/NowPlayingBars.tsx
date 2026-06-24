import { cn } from '@/utils/cn'

interface NowPlayingBarsProps {
  /** When false the bars freeze low (track is the current one but paused). */
  playing?: boolean
  className?: string
}

/**
 * The animated "equalizer" that marks the currently playing track in a list.
 * Colour is inherited via `currentColor` — wrap/pass `text-accent` etc. The CSS
 * (keyframes + `.now-playing-bars`) lives in index.css.
 */
export function NowPlayingBars({ playing = true, className }: NowPlayingBarsProps) {
  return (
    <span
      className={cn('now-playing-bars text-accent', className)}
      data-paused={!playing}
      role="img"
      aria-label="Now playing"
    >
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}
