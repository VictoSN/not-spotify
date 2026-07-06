import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircleIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, SparklesIcon, StarIcon } from '@heroicons/react/24/solid'
import type { Playlist } from '@/types/playlist'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { playlistService } from '@/services/playlistService'
import { openMenuAtPointer } from '@/utils/contextMenu'
import { PlaylistRowMenu, type PlaylistRowMenuHandle } from './PlaylistRowMenu'
import { PlaylistCover } from './PlaylistCover'
import { CardPlayButton } from './CardPlayButton'

interface PlaylistCardProps {
  playlist: Playlist
  flush?: boolean
  /** Render the title bold. Defaults to normal weight (Spotify-style); pass true where bold is wanted. */
  boldTitle?: boolean
}

export function PlaylistCard({ playlist, flush = false, boldTitle = false }: PlaylistCardProps) {
  const startContext = usePlayContextGate()
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const { isActiveContext, isPlayingContext } = usePlaybackContext({ type: 'playlist', id: playlist.id })
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
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
      onContextMenu={(e) => openMenuAtPointer(e, menuTriggerRef)}
      className={`group flex-shrink-0 w-40 md:w-48 rounded-lg transition-colors ${flush ? 'p-3 hover:bg-surface' : 'p-3 hover:bg-surface'}`}
    >
      <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
        <PlaylistCover coverUrl={playlist.coverUrl} tracks={playlist.tracks} name={playlist.name} />
        <CardPlayButton
          onClick={handlePlay}
          isPlaying={isPlayingContext}
          isActive={isActiveContext}
          ariaLabel={isPlayingContext ? `Pause ${playlist.name}` : `Play ${playlist.name}`}
        />
        <button
          onClick={handleLike}
          className={`absolute top-2 right-2 transition-all ${isSaved ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
          aria-label={isSaved ? `Remove ${playlist.name} from library` : `Add ${playlist.name} to library`}
        >
          {isSaved ? (
            <CheckCircleIcon className="liked-heart-pop h-5 w-5 text-accent" />
          ) : (
            <PlusCircleIcon className="h-5 w-5 text-white transition-colors hover:text-accent stroke-[2.4]" />
          )}
        </button>
      </div>
      <p className={`text-sm ${boldTitle ? 'font-semibold' : 'font-normal'} text-primary truncate flex items-center gap-1`}>
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
