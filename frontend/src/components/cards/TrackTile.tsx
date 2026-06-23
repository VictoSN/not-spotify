import { Link, useNavigate } from 'react-router-dom'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useHueStore } from '@/stores/hueStore'
import { getDominantColor } from '@/hooks/useDominantColor'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'

interface TrackTileProps {
  track: Track
  queue?: Track[]
}

/** Spotify-style square tile: cover with a rising hover play button + title/artist. */
export function TrackTile({ track, queue }: TrackTileProps) {
  const { currentTrack, isPlaying, pause, resume } = usePlayerStore()
  const playWithGate = usePlaybackGate()
  const navigate = useNavigate()
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  const isCurrent = currentTrack?.id === track.id

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isCurrent) {
      if (isPlaying) pause()
      else resume()
    } else {
      playWithGate(track, queue ?? [track])
    }
  }

  return (
    <Link
      to={`/album/${track.album.id}`}
      onMouseEnter={() => getDominantColor(track.album.coverUrl).then((c) => c && setHoverColor(c))}
      onMouseLeave={() => setHoverColor(null)}
      onContextMenu={(e) => e.preventDefault()}
      className="group flex-shrink-0 w-44 sm:w-48 p-3 rounded-lg hover:bg-surface transition-colors"
    >
      <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
        <img src={track.album.coverUrl} alt={track.title} className="w-full h-full object-cover" />
        <button
          onClick={handlePlay}
          className="absolute bottom-2 right-2 w-10 h-10 bg-accent rounded-full flex items-center justify-center opacity-100 translate-y-0 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-200 shadow-lg hover:scale-105"
          aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
        >
          {isCurrent && isPlaying ? (
            <PauseIcon className="w-5 h-5 text-white" />
          ) : (
            <PlayIcon className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>
      </div>
      <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-accent' : 'text-primary'}`}>{track.title}</p>
      <p className="text-xs text-secondary mt-0.5 truncate">
        <span
          role="link"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            navigate(`/artist/${track.artist.id}`)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              navigate(`/artist/${track.artist.id}`)
            }
          }}
          className="cursor-pointer hover:text-primary hover:underline"
        >
          {track.artist.name}
        </span>
      </p>
    </Link>
  )
}
