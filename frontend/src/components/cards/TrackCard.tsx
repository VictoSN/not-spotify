import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon, PauseIcon, HeartIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid, CheckIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { formatMs } from '@/utils/formatTime'

interface TrackCardProps {
  track: Track
  queue?: Track[]
}

export function TrackCard({ track, queue }: TrackCardProps) {
  const { currentTrack, isPlaying, pause, resume } = usePlayerStore()
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const { likedTrackIds, likeTrack, unlikeTrack, savedPlaylists, addTrackToPlaylist, removeTrackFromPlaylist } =
    useLibraryStore()
  const isCurrent = currentTrack?.id === track.id
  const isLiked = likedTrackIds.has(track.id)
  const [showMenu, setShowMenu] = useState(false)

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

  const handleTogglePlaylist = async (playlistId: string) => {
    const playlist = savedPlaylists.find((p) => p.id === playlistId)
    if (!playlist) return

    const trackIsInPlaylist = playlist.tracks.some((pt) => pt.track.id === track.id)
    try {
      if (trackIsInPlaylist) {
        await removeTrackFromPlaylist(playlistId, track.id)
      } else {
        await addTrackToPlaylist(playlistId, track)
      }
    } catch (error) {
      console.error('Failed to update playlist:', error)
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
        <p className={`text-sm font-medium truncate ${isCurrent ? 'text-accent' : 'text-primary'}`}>{track.title}</p>
        <p className="text-xs text-secondary truncate">
          <Link to={`/artist/${track.artist.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
            {track.artist.name}
          </Link>
        </p>
      </div>
      <span className="text-xs text-muted flex-shrink-0">{formatMs(track.durationMs)}</span>
      <button
        onClick={handleLike}
        className={`opacity-0 group-hover:opacity-100 transition-opacity ${isLiked ? 'opacity-100' : ''}`}
        aria-label={isLiked ? 'Unlike' : 'Like'}
      >
        {isLiked ? (
          <HeartSolid className="w-4 h-4 text-accent flex-shrink-0" />
        ) : (
          <HeartIcon className="w-4 h-4 text-secondary hover:text-primary flex-shrink-0 transition-colors" />
        )}
      </button>
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-secondary hover:text-primary flex-shrink-0"
          aria-label="More options"
        >
          <EllipsisHorizontalIcon className="w-4 h-4" />
        </button>
        {showMenu && (
          <div className="absolute right-0 bottom-full mb-1 w-56 bg-elevated rounded-lg shadow-xl border border-secondary/20 overflow-y-auto max-h-64 z-50">
            {savedPlaylists.length === 0 ? (
              <div className="px-4 py-3 text-sm text-secondary text-center">
                Create a playlist first
              </div>
            ) : (
              <>
                <div className="px-4 py-2 text-xs font-semibold text-secondary uppercase tracking-wider border-b border-secondary/10 sticky top-0 bg-elevated">
                  Add to playlist
                </div>
                {savedPlaylists.map((playlist) => {
                  const isInPlaylist = playlist.tracks.some((pt) => pt.track.id === track.id)
                  return (
                    <button
                      key={playlist.id}
                      onClick={async (e) => {
                        e.stopPropagation()
                        await handleTogglePlaylist(playlist.id)
                        setShowMenu(false)
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-primary hover:bg-surface transition-colors flex items-center justify-between"
                    >
                      <span className="truncate">{playlist.name}</span>
                      {isInPlaylist && <CheckIcon className="w-4 h-4 text-accent flex-shrink-0 ml-2" />}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
