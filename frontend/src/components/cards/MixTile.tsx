import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import type { DailyMix } from '@/services/trackService'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'

interface MixTileProps {
  mix: DailyMix
  flush?: boolean
}

/**
 * A "Daily Mix" tile: a 2x2 mosaic of the mix's album covers with a
 * genre-colored title band. Clicking play loads the whole mix into the queue.
 * Daily mixes are ephemeral (no dedicated page), so the tile isn't a link.
 */
export function MixTile({ mix, flush = false }: MixTileProps) {
  const { currentTrack, isPlaying, pause, resume } = usePlayerStore()
  const playWithGate = usePlaybackGate()

  // First four distinct album covers for the mosaic.
  const covers: string[] = []
  for (const t of mix.tracks) {
    const url = t.album?.coverUrl
    if (url && !covers.includes(url)) covers.push(url)
    if (covers.length === 4) break
  }

  const mixIsPlaying = isPlaying && currentTrack != null && mix.tracks.some((t) => t.id === currentTrack.id)

  const handlePlay = () => {
    if (mixIsPlaying) {
      pause()
    } else if (currentTrack && mix.tracks.some((t) => t.id === currentTrack.id)) {
      resume()
    } else if (mix.tracks.length > 0) {
      playWithGate(mix.tracks[0], mix.tracks)
    }
  }

  const accent = mix.color ?? '#1db954'

  return (
    <div
      className={`group flex-shrink-0 w-40 sm:w-44 rounded-lg transition-colors ${flush ? 'p-3 hover:bg-surface' : 'p-3 hover:bg-surface'}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
        {covers.length >= 4 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2">
            {covers.map((url, i) => (
              <img key={i} src={url} alt="" className="h-full w-full object-cover" />
            ))}
          </div>
        ) : covers.length >= 1 ? (
          <img src={covers[0]} alt={mix.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ backgroundColor: accent }} />
        )}

        {/* Genre-colored gradient band with the mix label */}
        <div
          className="absolute inset-x-0 bottom-0 px-2 py-2"
          style={{ background: `linear-gradient(to top, ${accent}f2, ${accent}00)` }}
        >
          <p className="text-xs font-black uppercase tracking-wide text-white drop-shadow">{mix.subtitle}</p>
        </div>

        <button
          onClick={handlePlay}
          className="absolute bottom-2 right-2 w-10 h-10 bg-accent rounded-full flex items-center justify-center opacity-100 translate-y-0 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-200 shadow-lg hover:scale-105"
          aria-label={mixIsPlaying ? `Pause ${mix.title}` : `Play ${mix.title}`}
        >
          {mixIsPlaying ? (
            <PauseIcon className="w-5 h-5 text-white" />
          ) : (
            <PlayIcon className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>
      </div>
      <p className="text-sm font-semibold text-primary truncate">{mix.title}</p>
      <p className="text-xs text-secondary mt-0.5 truncate">
        {mix.tracks.slice(0, 3).map((t) => t.artist.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
      </p>
    </div>
  )
}
