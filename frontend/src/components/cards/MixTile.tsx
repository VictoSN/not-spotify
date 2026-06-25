import type { DailyMix } from '@/services/trackService'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { CardPlayButton } from './CardPlayButton'

interface MixTileProps {
  mix: DailyMix
  flush?: boolean
  /** Render the title bold. Defaults to normal weight (Spotify-style); pass true where bold is wanted. */
  boldTitle?: boolean
}

/**
 * A "Daily Mix" tile: a 2x2 mosaic of the mix's album covers with a
 * genre-colored title band. Clicking play loads the whole mix into the queue.
 * Daily mixes are ephemeral (no dedicated page), so the tile isn't a link.
 */
export function MixTile({ mix, flush = false, boldTitle = false }: MixTileProps) {
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const startContext = usePlayContextGate()
  const { isActiveContext, isPlayingContext } = usePlaybackContext({ type: 'mix', id: mix.id })

  // First four distinct album covers for the mosaic.
  const covers: string[] = []
  for (const t of mix.tracks) {
    const url = t.album?.coverUrl
    if (url && !covers.includes(url)) covers.push(url)
    if (covers.length === 4) break
  }

  const handlePlay = () => {
    if (isActiveContext) togglePlayPause()
    else if (mix.tracks.length > 0) startContext({ type: 'mix', id: mix.id }, mix.tracks)
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

        <CardPlayButton
          onClick={handlePlay}
          isPlaying={isPlayingContext}
          isActive={isActiveContext}
          ariaLabel={isPlayingContext ? `Pause ${mix.title}` : `Play ${mix.title}`}
        />
      </div>
      <p className={`text-sm ${boldTitle ? 'font-semibold' : 'font-normal'} text-primary truncate`}>{mix.title}</p>
      <p className="text-xs text-secondary mt-0.5 truncate">
        {mix.tracks.slice(0, 3).map((t) => t.artist.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
      </p>
    </div>
  )
}
