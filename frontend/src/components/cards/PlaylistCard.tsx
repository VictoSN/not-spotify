import { Link } from 'react-router-dom'
import { PlayIcon, HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import type { Playlist } from '@/types/playlist'
import { useHueStore } from '@/stores/hueStore'
import { getDominantColor } from '@/hooks/useDominantColor'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { PlaylistCover } from './PlaylistCover'

interface PlaylistCardProps {
  playlist: Playlist
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  const { savedPlaylists, savePlaylist, unsavePlaylist } = useLibraryStore()
  const isSaved = savedPlaylists.some((p) => p.id === playlist.id)

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Start listening with a free account', imageUrl: playlist.coverUrl })
      return
    }
    const tracks = playlist.tracks.map((pt) => pt.track)
    if (tracks.length > 0) playWithGate(tracks[0], tracks)
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
      className="group flex-shrink-0 w-40 sm:w-44 p-3 rounded-lg hover:bg-surface transition-colors"
    >
      <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
        <PlaylistCover coverUrl={playlist.coverUrl} tracks={playlist.tracks} name={playlist.name} />
        <button
          onClick={handlePlay}
          className="absolute bottom-2 right-2 w-10 h-10 bg-accent rounded-full flex items-center justify-center opacity-100 translate-y-0 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-200 shadow-lg hover:scale-105"
          aria-label={`Play ${playlist.name}`}
        >
          <PlayIcon className="w-5 h-5 text-white ml-0.5" />
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
      <p className="text-sm font-semibold text-primary truncate">{playlist.name}</p>
      {playlist.description && <p className="text-xs text-secondary mt-0.5 line-clamp-2">{playlist.description}</p>}
    </Link>
  )
}
