import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon } from '@heroicons/react/24/solid'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { useHueStore } from '@/stores/hueStore'
import { trackService } from '@/services/trackService'
import { getDominantColor } from '@/hooks/useDominantColor'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'

interface AlbumCardProps {
  album: Album
  tracks?: Track[]
}

export function AlbumCard({ album, tracks }: AlbumCardProps) {
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  const [loading, setLoading] = useState(false)

  const handlePlay = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Start listening with a free account', imageUrl: album.coverUrl })
      return
    }
    if (tracks && tracks.length > 0) {
      playWithGate(tracks[0], tracks)
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const fetched = await trackService.getByAlbum(album.id)
      if (fetched.length > 0) playWithGate(fetched[0], fetched)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Link
      to={`/album/${album.id}`}
      onMouseEnter={() => getDominantColor(album.coverUrl).then((c) => c && setHoverColor(c))}
      onMouseLeave={() => setHoverColor(null)}
      className="group flex-shrink-0 w-40 sm:w-44 p-3 rounded-lg hover:bg-surface transition-colors"
    >
      <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
        <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
        <button
          onClick={handlePlay}
          className="absolute bottom-2 right-2 w-10 h-10 bg-accent rounded-full flex items-center justify-center opacity-100 translate-y-0 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-200 shadow-lg hover:scale-105 disabled:opacity-60"
          aria-label={`Play ${album.title}`}
          disabled={loading}
        >
          <PlayIcon className="w-5 h-5 text-white ml-0.5" />
        </button>
      </div>
      <p className="text-sm font-semibold text-primary truncate">{album.title}</p>
      <p className="text-xs text-secondary mt-0.5 truncate">
        {album.releaseDate.slice(0, 4)} · {album.artist.name}
      </p>
    </Link>
  )
}
