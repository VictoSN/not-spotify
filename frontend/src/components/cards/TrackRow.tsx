import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon, PauseIcon, HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'
import { TrackRowMenu } from './TrackRowMenu'
import { useRatingStore } from '@/stores/ratingStore'
import { useDragStore } from '@/stores/dragStore'
import { TRACK_DND_MIME, setTrackDragImage } from '@/utils/trackDnd'
import { openMenuAtPointer } from '@/utils/contextMenu'

interface TrackRowProps {
  track: Track
  index: number
  queue: Track[]
  showAlbum?: boolean
  showPlayCount?: boolean
  addedAt?: string
  /** When this row is rendered inside a playlist page, omit that playlist from "Add to playlist". */
  currentPlaylistId?: string
}

export function TrackRow({
  track,
  index,
  queue,
  showAlbum = false,
  showPlayCount = false,
  addedAt,
  currentPlaylistId,
}: TrackRowProps) {
  const { currentTrack, isPlaying, pause, resume } = usePlayerStore()
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()
  const { getAggregate, seedAggregate } = useRatingStore()
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const isMobile = useIsMobile()
  const isCurrent = currentTrack?.id === track.id
  const isLiked = likedTrackIds.has(track.id)
  const { ratingCount, averageRating } = getAggregate(track.id)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const setDraggedTrack = useDragStore((s) => s.setDraggedTrack)

  useEffect(() => {
    if ((track.ratingCount ?? 0) > 0) {
      seedAggregate(track.id, track.ratingCount, track.averageRating)
    }
  }, [track.id, track.ratingCount, track.averageRating, seedAggregate])

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
      className="group grid items-center gap-4 px-4 py-2 rounded-md hover:bg-elevated/60 cursor-pointer transition-opacity"
      style={{ gridTemplateColumns: isMobile ? '16px 1fr var(--track-actions-width)' : showAlbum ? '16px 6fr 4fr 3fr var(--track-actions-width)' : '16px 6fr 3fr var(--track-actions-width)' }}
      onClick={handlePlay}
      onContextMenu={(e) => openMenuAtPointer(e, menuTriggerRef)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
        // Carry the id in our custom type so drop targets can recognise a track drag;
        // text/plain is set too because some browsers won't start a drag without it.
        e.dataTransfer.setData(TRACK_DND_MIME, track.id)
        e.dataTransfer.setData('text/plain', `${track.title} · ${track.artist.name}`)
        setTrackDragImage(e, track)
        setDraggedTrack(track)
        e.currentTarget.style.opacity = '0.4'
      }}
      onDragEnd={(e) => {
        setDraggedTrack(null)
        e.currentTarget.style.opacity = ''
      }}
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
          draggable={false}
          className="w-10 h-10 rounded flex-shrink-0 object-cover"
        />
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${isCurrent ? 'text-accent' : 'text-primary'}`}>
            <Link
              to={`/track/${track.id}`}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline"
            >
              {track.title}
            </Link>
            {track.explicit && <span className="ml-1 text-xs bg-elevated px-1 rounded text-secondary">E</span>}
          </p>
          <p className="text-xs text-secondary truncate">
            <Link
              to={`/artist/${track.artist.id}`}
              draggable={false}
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
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-secondary hover:text-primary hover:underline truncate hidden md:block"
        >
          {track.album.title}
        </Link>
      )}

      {/* Play count (optional) */}
      {showPlayCount && <span className="text-sm text-secondary hidden md:block">{formatNumber(track.playCount)}</span>}

      {/* Date added (optional — shown when showAlbum is true) */}
      {showAlbum && (
        <span className="text-sm text-secondary hidden md:block truncate">
          {addedAt ? new Date(addedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
        </span>
      )}

      {/* Duration + actions */}
      <div
        className="grid grid-cols-[32px_50px_32px] sm:grid-cols-[80px_32px_50px_32px] items-center gap-1.5 sm:gap-2 justify-end w-[114px] sm:w-[194px] ml-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rating slot (Col 1 on desktop) */}
        <div className="hidden sm:block">
          {ratingCount > 0 ? (
            <span
              className="flex items-center gap-0.5 text-xs text-secondary/70 whitespace-nowrap"
              title={`${averageRating.toFixed(1)} average from ${ratingCount} rating${ratingCount !== 1 ? 's' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-accent/70" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {averageRating.toFixed(1)}
              <span className="text-secondary/40 ml-0.5">({ratingCount})</span>
            </span>
          ) : (
            <div className="w-[80px]" />
          )}
        </div>

        {/* Like button slot (Col 2 on desktop / Col 1 on mobile) */}
        <div className="flex justify-center">
          <button
            onClick={toggleLike}
            className={`transition-opacity ${isLiked ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            {isLiked ? (
              <HeartSolid className="w-4 h-4 text-accent" />
            ) : (
              <HeartIcon className="w-4 h-4 text-secondary hover:text-primary" />
            )}
          </button>
        </div>

        {/* Duration slot (Col 3 on desktop / Col 2 on mobile) */}
        <div className="text-right text-sm text-secondary pr-1">
          {formatMs(track.durationMs)}
        </div>

        {/* Menu slot (Col 4 on desktop / Col 3 on mobile) */}
        <div className="flex justify-center">
          <TrackRowMenu track={track} currentPlaylistId={currentPlaylistId} triggerRef={menuTriggerRef} />
        </div>
      </div>
    </div>
  )
}
