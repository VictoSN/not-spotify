import { Link } from 'react-router-dom'
import { PlayIcon, PauseIcon, HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'
import { TrackRowMenu } from './TrackRowMenu'

interface TrackRowProps {
  track: Track
  index: number
  queue: Track[]
  showAlbum?: boolean
  showPlayCount?: boolean
  /** When this row is rendered inside a playlist page, omit that playlist from "Add to playlist". */
  currentPlaylistId?: string
}

export function TrackRow({
  track,
  index,
  queue,
  showAlbum = false,
  showPlayCount = false,
  currentPlaylistId,
}: TrackRowProps) {
  const { currentTrack, isPlaying, pause, resume } = usePlayerStore()
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const isCurrent = currentTrack?.id === track.id
  const isLiked = likedTrackIds.has(track.id)

  const handlePlay = () => {
    if (isCurrent) {
      if (isPlaying) pause()
      else resume()
    } else {
      playWithGate(track, queue)
    }
  }

  const toggleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Like songs with a free account', imageUrl: track.album.coverUrl })
      return
    }
    if (isLiked) unlikeTrack(track.id)
    else likeTrack(track)
  }

  return (
    <div
      className="group grid items-center gap-4 px-4 py-2 rounded-md hover:bg-elevated/60 cursor-pointer"
      style={{ gridTemplateColumns: showAlbum ? '16px 6fr 4fr 3fr 1fr' : '16px 6fr 3fr 1fr' }}
      onClick={handlePlay}
    >
      {/* Index / play indicator */}
      <div className="flex items-center justify-center w-4">
        <span className={`group-hover:hidden text-sm ${isCurrent ? 'text-accent' : 'text-secondary'}`}>
          {isCurrent && isPlaying ? '▶' : index + 1}
        </span>
        <button className="hidden group-hover:flex" aria-label={isPlaying && isCurrent ? 'Pause' : 'Play'}>
          {isCurrent && isPlaying ? (
            <PauseIcon className="w-4 h-4 text-primary" />
          ) : (
            <PlayIcon className="w-4 h-4 text-primary" />
          )}
        </button>
      </div>

      {/* Title + artist */}
      <div className="flex items-center gap-3 min-w-0">
        <img
          src={track.album.coverUrl}
          alt={track.album.title}
          className="w-10 h-10 rounded flex-shrink-0 object-cover"
        />
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${isCurrent ? 'text-accent' : 'text-primary'}`}>
            {track.title}
            {track.explicit && <span className="ml-1 text-xs bg-elevated px-1 rounded text-secondary">E</span>}
          </p>
          <p className="text-xs text-secondary truncate">
            <Link
              to={`/artist/${track.artist.id}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-primary hover:underline"
            >
              {track.artist.name}
            </Link>
          </p>
        </div>
      </div>

      {/* Album (optional) */}
      {showAlbum && (
        <Link
          to={`/album/${track.album.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-secondary hover:text-primary hover:underline truncate hidden md:block"
        >
          {track.album.title}
        </Link>
      )}

      {/* Play count (optional) */}
      {showPlayCount && <span className="text-sm text-secondary hidden md:block">{formatNumber(track.playCount)}</span>}

      {/* Duration + actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={toggleLike}
          className={`opacity-0 group-hover:opacity-100 transition-opacity ${isLiked ? 'opacity-100' : ''}`}
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          {isLiked ? (
            <HeartSolid className="w-4 h-4 text-accent" />
          ) : (
            <HeartIcon className="w-4 h-4 text-secondary hover:text-primary" />
          )}
        </button>
        <span className="text-sm text-secondary">{formatMs(track.durationMs)}</span>
        <TrackRowMenu track={track} currentPlaylistId={currentPlaylistId} />
      </div>
    </div>
  )
}
