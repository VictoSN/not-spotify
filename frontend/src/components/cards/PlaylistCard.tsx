import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon, PauseIcon, HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid, SparklesIcon, StarIcon } from '@heroicons/react/24/solid'
import type { Playlist } from '@/types/playlist'
import { useHueStore } from '@/stores/hueStore'
import { usePlayerStore } from '@/stores/playerStore'
import { getDominantColor } from '@/hooks/useDominantColor'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { playlistService } from '@/services/playlistService'
import { openMenuAtPointer } from '@/utils/contextMenu'
import { PlaylistRowMenu, type PlaylistRowMenuHandle } from './PlaylistRowMenu'
import { PlaylistCover } from './PlaylistCover'

interface PlaylistCardProps {
  playlist: Playlist
  flush?: boolean
}

export function PlaylistCard({ playlist, flush = false }: PlaylistCardProps) {
  const startContext = usePlayContextGate()
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const { isActiveContext, isPlayingContext } = usePlaybackContext({ type: 'playlist', id: playlist.id })
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  const { savedPlaylists, savePlaylist, unsavePlaylist } = useLibraryStore()
  const isSaved = savedPlaylists.some((p) => p.id === playlist.id)
  const menuTriggerRef = useRef<PlaylistRowMenuHandle>(null)

  const handlePlay = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isActiveContext) {
      togglePlayPause()
      return
    }
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Start listening with a free account', imageUrl: playlist.coverUrl })
      return
    }
    const resolved = playlist.tracks
      ? playlist
      : await playlistService.getById(playlist.id)
    const tracks = resolved.tracks.map((pt) => pt.track)
    if (tracks.length > 0) startContext({ type: 'playlist', id: playlist.id }, tracks)
  }

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Save playlists with a free account', imageUrl: playlist.coverUrl })
      return
    }
    if (isSaved) {
      unsavePlaylist(playlist.id)
    } else {
      savePlaylist(playlist)
    }
  }

  return (
    <Link
      to={`/playlist/${playlist.id}`}
      onMouseEnter={() => {
        if (playlist.coverUrl) getDominantColor(playlist.coverUrl).then((c) => c && setHoverColor(c))
      }}
      onMouseLeave={() => setHoverColor(null)}
      onContextMenu={(e) => openMenuAtPointer(e, menuTriggerRef)}
      className={`group flex-shrink-0 w-40 sm:w-44 rounded-lg transition-colors ${flush ? 'p-3 hover:bg-surface' : 'p-3 hover:bg-surface'}`}
    >
      <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
        <PlaylistCover coverUrl={playlist.coverUrl} tracks={playlist.tracks} name={playlist.name} />
        <button
          onClick={handlePlay}
          className={`absolute bottom-2 right-2 w-10 h-10 bg-accent rounded-full flex items-center justify-center translate-y-0 transition-all duration-200 shadow-lg hover:scale-105 ${
            isActiveContext
              ? 'opacity-100'
              : 'opacity-100 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0'
          }`}
          aria-label={isPlayingContext ? `Pause ${playlist.name}` : `Play ${playlist.name}`}
        >
          {isPlayingContext ? (
            <PauseIcon className="w-5 h-5 text-white" />
          ) : (
            <PlayIcon className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>
        <button
          onClick={handleLike}
          className={`absolute top-2 right-2 transition-all ${isSaved ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
          aria-label={isSaved ? `Remove ${playlist.name} from library` : `Add ${playlist.name} to library`}
        >
          {isSaved ? (
            <HeartSolid className="w-5 h-5 text-accent" />
          ) : (
            <HeartIcon className="w-5 h-5 text-white hover:text-accent transition-colors" />
          )}
        </button>
      </div>
      <p className="text-sm font-semibold text-primary truncate flex items-center gap-1">
        {playlist.isFeatured && <StarIcon className="w-3.5 h-3.5 text-accent shrink-0" title="Featured" />}
        {playlist.smartRules && <SparklesIcon className="w-3.5 h-3.5 text-accent shrink-0" title="Smart playlist" />}
        <span className="truncate">{playlist.name}</span>
      </p>
      {playlist.description && <p className="text-xs text-secondary mt-0.5 line-clamp-2">{playlist.description}</p>}
      {/* Right-click menu (no inline UI — portals its trigger + panel). */}
      <PlaylistRowMenu ref={menuTriggerRef} playlist={playlist} />
    </Link>
  )
}
