import { Link } from 'react-router-dom'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { formatMs } from '@/utils/formatTime'

interface TrackCardProps {
  track: Track
  queue?: Track[]
}

export function TrackCard({ track, queue }: TrackCardProps) {
  const { currentTrack, isPlaying, play, pause, resume } = usePlayerStore()
  const isCurrent = currentTrack?.id === track.id

  const handlePlay = () => {
    if (isCurrent) {
      isPlaying ? pause() : resume()
    } else {
      play(track, queue ?? [track])
    }
  }

  return (
    <div
      className="flex items-center gap-3 p-2 rounded-md hover:bg-elevated/60 group cursor-pointer"
      onClick={handlePlay}
    >
      <div className="relative w-10 h-10 flex-shrink-0 rounded overflow-hidden">
        <img src={track.album.coverUrl} alt={track.album.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isCurrent && isPlaying ? (
            <PauseIcon className="w-5 h-5 text-white" />
          ) : (
            <PlayIcon className="w-5 h-5 text-white ml-0.5" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isCurrent ? 'text-accent' : 'text-primary'}`}>
          {track.title}
        </p>
        <p className="text-xs text-secondary truncate">
          <Link
            to={`/artist/${track.artist.id}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:underline"
          >
            {track.artist.name}
          </Link>
        </p>
      </div>
      <span className="text-xs text-muted flex-shrink-0">{formatMs(track.durationMs)}</span>
    </div>
  )
}
