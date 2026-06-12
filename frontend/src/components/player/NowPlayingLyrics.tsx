import type { Track } from '@/types/track'
import { LyricsView } from './LyricsView'
import { withAlpha } from '@/hooks/useDominantColor'
import { useLyrics } from '@/hooks/useLyrics'

interface NowPlayingLyricsProps {
  track: Track
  /** Dominant cover colour — tints the card like Spotify's lyrics card. */
  accentColor?: string | null
}

/**
 * Spotify-style lyrics card for the now-playing panel / mobile sheet.
 * Fetches lyrics itself and renders nothing when the track has none.
 */
export function NowPlayingLyrics({ track, accentColor }: NowPlayingLyricsProps) {
  const data = useLyrics(track.id)

  // Hide the card entirely while loading or when the track has no lyrics.
  if (!data || (!data.lyrics && !data.syncedLyrics)) return null

  return (
    <section className="px-4 pb-4">
      <div
        className="rounded-lg bg-elevated px-4 pb-2 pt-3"
        style={accentColor ? { background: withAlpha(accentColor, 0.35) } : undefined}
      >
        <h3 className="text-base font-bold text-primary">Lyrics</h3>
        <LyricsView
          lyrics={data.lyrics}
          syncedLyrics={data.syncedLyrics}
          trackId={track.id}
          variant="card"
        />
      </div>
    </section>
  )
}
