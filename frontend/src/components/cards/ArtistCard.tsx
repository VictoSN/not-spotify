import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon } from '@heroicons/react/24/solid'
import type { Artist } from '@/types/artist'
import { artistService } from '@/services/artistService'
import { formatNumber } from '@/utils/formatNumber'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'

interface ArtistCardProps {
  artist: Artist
  flush?: boolean
}

export function ArtistCard({ artist, flush = false }: ArtistCardProps) {
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const [loading, setLoading] = useState(false)

  const handlePlay = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Start listening with a free account', imageUrl: artist.imageUrl })
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const tracks = await artistService.getTopTracks(artist.id, 20)
      if (tracks.length > 0) playWithGate(tracks[0], tracks)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Link
      to={`/artist/${artist.id}`}
      onContextMenu={(e) => e.preventDefault()}
      className={`group flex-shrink-0 w-40 sm:w-44 rounded-lg transition-colors ${flush ? 'p-0 text-left hover:bg-transparent' : 'p-3 text-center hover:bg-surface'}`}
    >
      <div className={`relative mb-3 aspect-square ${flush ? '' : 'mx-auto'}`}>
        <div className="h-full w-full overflow-hidden rounded-full bg-elevated shadow-lg">
          {artist.imageUrl ? (
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl">🎤</div>
          )}
        </div>
        <button
          onClick={handlePlay}
          className="absolute bottom-1 right-1 z-10 flex h-11 w-11 translate-y-0 items-center justify-center rounded-full bg-accent opacity-100 shadow-lg transition-all duration-200 hover:scale-105 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 disabled:opacity-60"
          aria-label={`Play ${artist.name}`}
          disabled={loading}
        >
          <PlayIcon className="ml-0.5 h-5 w-5 text-black" />
        </button>
      </div>
      <p className="text-sm font-semibold text-primary truncate">{artist.name}</p>
      <p className="text-xs text-secondary mt-0.5">{formatNumber(artist.monthlyListeners)} listeners</p>
    </Link>
  )
}
