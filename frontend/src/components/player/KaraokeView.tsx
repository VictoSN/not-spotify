import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePlayerStore } from '@/stores/playerStore'
import { useDominantColor, withAlpha } from '@/hooks/useDominantColor'
import { useLyrics } from '@/hooks/useLyrics'
import { LyricsView } from './LyricsView'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Fullscreen karaoke lyrics view (Spotify's mic-button lyrics page). Fills the
 * main content slot; backdrop is a gradient from the album cover's dominant
 * color. Rendered only while a track is playing and the karaoke toggle is on.
 */
export function KaraokeView() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const toggleKaraoke = usePlayerStore((s) => s.toggleKaraoke)
  const heroColor = useDominantColor(currentTrack?.album.coverUrl)
  const lyricsData = useLyrics(currentTrack?.id)

  if (!currentTrack) return null

  const hasLyrics = !!(lyricsData?.lyrics || lyricsData?.syncedLyrics)

  return (
    <div
      className="animate-karaoke-swap-in relative h-full overflow-hidden"
      style={{
        background: heroColor
          ? `linear-gradient(180deg, ${withAlpha(heroColor, 0.95)} 0%, ${withAlpha(heroColor, 0.55)} 100%)`
          : 'linear-gradient(180deg, var(--c-accent-dim, #333) 0%, transparent 100%)',
      }}
    >
      <button
        onClick={toggleKaraoke}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/20 p-2 text-primary transition-all hover:scale-110 hover:bg-black/40 active:scale-95"
        aria-label="Close lyrics"
        title="Close lyrics"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>

      <div className="mx-auto h-full max-w-5xl px-8 lg:px-12">
        {!lyricsData ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : hasLyrics ? (
          <LyricsView
            lyrics={lyricsData.lyrics}
            syncedLyrics={lyricsData.syncedLyrics}
            trackId={currentTrack.id}
            variant="full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-2xl font-bold text-primary">No lyrics for this song</p>
            <p className="text-sm text-primary/70">
              {currentTrack.title} · {currentTrack.artist.name}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
