import { useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { LyricsView } from './LyricsView'
import { withAlpha } from '@/hooks/useDominantColor'

interface NowPlayingLyricsProps {
  track: Track
  /** Dominant cover colour — tints the card like Spotify's lyrics card. */
  accentColor?: string | null
}

type LyricsData = { trackId: string; lyrics: string | null; syncedLyrics: string | null }

/**
 * Spotify-style lyrics card for the now-playing panel / mobile sheet.
 * Fetches lyrics itself and renders nothing when the track has none.
 */
export function NowPlayingLyrics({ track, accentColor }: NowPlayingLyricsProps) {
  const [data, setData] = useState<LyricsData | null>(null)

  useEffect(() => {
    let cancelled = false
    trackService
      .getLyrics(track.id)
      .then((res) => {
        if (!cancelled) setData({ trackId: track.id, lyrics: res.lyrics, syncedLyrics: res.syncedLyrics })
      })
      .catch(() => {
        if (!cancelled) setData({ trackId: track.id, lyrics: null, syncedLyrics: null })
      })
    return () => {
      cancelled = true
    }
  }, [track.id])

  // Hide the card entirely while loading or when the track has no lyrics.
  if (!data || data.trackId !== track.id || (!data.lyrics && !data.syncedLyrics)) return null

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
