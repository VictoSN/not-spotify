import type { ReactNode } from 'react'
import { heroGradient } from '@/hooks/useDominantColor'

interface DetailHeroProps {
  /** Extracted artwork hue driving the Spotify-style gradient wash. */
  heroColor: string | null
  coverUrl: string
  coverAlt: string
  /** Small uppercase label above the title (e.g. "Song", "ALBUM"). */
  eyebrow: ReactNode
  title: ReactNode
  /** Meta row under the title (artist · year · duration · …). */
  meta: ReactNode
  /** Action bar (play + contextual buttons). Rendered in a shared wrapper. */
  actions: ReactNode
}

/**
 * Shared hero header for the Album and Track detail pages so their cover, eyebrow,
 * title, meta row, gradient wash, and action-bar spacing stay identical and can't
 * drift apart again (bug #10). Page-specific meta/actions are passed as slots.
 */
export function DetailHero({ heroColor, coverUrl, coverAlt, eyebrow, title, meta, actions }: DetailHeroProps) {
  return (
    <div style={{ background: heroGradient(heroColor) }}>
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 p-4 sm:p-6 pb-4">
        <img
          src={coverUrl}
          alt={coverAlt}
          className="w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-md shadow-2xl flex-shrink-0 object-cover self-center sm:self-auto"
        />
        <div className="min-w-0 pb-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-secondary">{eyebrow}</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mb-2 break-words">{title}</h1>
          {meta}
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 flex-wrap">{actions}</div>
    </div>
  )
}
