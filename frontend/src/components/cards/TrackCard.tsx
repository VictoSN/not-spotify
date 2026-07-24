import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { formatMs } from '@/utils/formatTime'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { TrackRowMenu, type TrackRowMenuHandle } from './TrackRowMenu'
import { TrackArtwork } from '@/components/player/TrackArtwork'
import { useDragStore } from '@/stores/dragStore'
import { TRACK_DND_MIME, setTrackDragImage } from '@/utils/trackDnd'
import { openMenuAtPointer } from '@/utils/contextMenu'

interface TrackCardProps {
  track: Track
  queue?: Track[]
}

export function TrackCard({ track, queue }: TrackCardProps) {
  const { currentTrack, isPlaying, pause, resume, currentContextType } = usePlayerStore()
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()
  const setDraggedTrack = useDragStore((s) => s.setDraggedTrack)
  const isCurrent = currentTrack?.id === track.id
  const isTrackSurfaceActive = isCurrent && currentContextType == null
  const isLiked = likedTrackIds.has(track.id)
  const isPrivateUpload = !!track.isPrivateUpload
  const menuTriggerRef = useRef<TrackRowMenuHandle>(null)

  const handlePlay = (e: React.MouseEvent) => {
    // Only respond to primary (left) clicks — right-click opens the context menu.
    if (e.button !== 0) return
    if (isTrackSurfaceActive) {
      if (isPlaying) pause()
      else resume()
    } else {
      playWithGate(track, queue ?? [track])
    }
  }

  const handleLike = (e: React.MouseEvent) => {
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
      className="flex items-center gap-3 p-2 rounded-md hover:bg-elevated/60 group cursor-pointer transition-opacity"
      onClick={handlePlay}
      onContextMenu={(e) => openMenuAtPointer(e, menuTriggerRef)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
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
      <div className="relative w-10 h-10 flex-shrink-0 rounded overflow-hidden">
        <TrackArtwork track={track} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {isTrackSurfaceActive && isPlaying ? (
            <PauseIcon className="w-5 h-5 text-white" />
          ) : (
            <PlayIcon className="w-5 h-5 text-white ml-0.5" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-normal truncate ${isTrackSurfaceActive ? 'text-accent' : 'text-primary'}`}>
          {isPrivateUpload ? track.title : <Link to={`/track/${track.id}`} draggable={false} onClick={(e) => e.stopPropagation()} className="hover:underline">{track.title}</Link>}
        </p>
        <p className="text-xs text-secondary truncate">
          {isPrivateUpload ? track.artist.name : <Link to={`/artist/${track.artist.id}`} draggable={false} onClick={(e) => e.stopPropagation()} className="hover:underline">{track.artist.name}</Link>}
        </p>
      </div>
      <div
        className="flex shrink-0 items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-muted">{formatMs(track.durationMs)}</span>
        <button
          onClick={handleLike}
          className={`transition-opacity ${isLiked ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          <AnimatedLikeIcon liked={isLiked} className="w-4 h-4" heartClassName="w-4 h-4 text-secondary hover:text-primary" />
        </button>
        <TrackRowMenu track={track} ref={menuTriggerRef} />
      </div>
    </div>
  )
}
