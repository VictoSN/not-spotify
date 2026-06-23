import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon, PauseIcon, HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { formatMs } from '@/utils/formatTime'
import { VerifiedArtistName } from '@/components/common/VerifiedArtistName'
import { TrackRowMenu } from './TrackRowMenu'

interface TrackCardProps {
  track: Track
  queue?: Track[]
}

export function TrackCard({ track, queue }: TrackCardProps) {
  const { currentTrack, isPlaying, pause, resume } = usePlayerStore()
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()
  const isCurrent = currentTrack?.id === track.id
  const isLiked = likedTrackIds.has(track.id)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)

  const handlePlay = () => {
    if (isCurrent) {
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
      className="flex items-center gap-3 p-2 rounded-md hover:bg-elevated/60 group cursor-pointer"
      onClick={handlePlay}
      onContextMenu={(e) => {
        e.preventDefault()
        menuTriggerRef.current?.click()
      }}
    >
      <div className="relative w-10 h-10 flex-shrink-0 rounded overflow-hidden">
        <img src={track.album.coverUrl} alt={track.album.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {isCurrent && isPlaying ? (
            <PauseIcon className="w-5 h-5 text-white" />
          ) : (
            <PlayIcon className="w-5 h-5 text-white ml-0.5" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isCurrent ? 'text-accent' : 'text-primary'}`}>
          <Link to={`/track/${track.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
            {track.title}
          </Link>
        </p>
        <p className="text-xs text-secondary">
          <Link to={`/artist/${track.artist.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full hover:underline">
            <VerifiedArtistName name={track.artist.name} verified={track.artist.verified} iconClassName="h-3.5 w-3.5" />
          </Link>
        </p>
      </div>
      <span className="text-xs text-muted flex-shrink-0">{formatMs(track.durationMs)}</span>
      <button
        onClick={handleLike}
        className={`transition-opacity ${isLiked ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
        aria-label={isLiked ? 'Unlike' : 'Like'}
      >
        {isLiked ? (
          <HeartSolid className="w-4 h-4 text-accent flex-shrink-0" />
        ) : (
          <HeartIcon className="w-4 h-4 text-secondary hover:text-primary flex-shrink-0 transition-colors" />
        )}
      </button>
      <TrackRowMenu track={track} triggerRef={menuTriggerRef} />
    </div>
  )
}
