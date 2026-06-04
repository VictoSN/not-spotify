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
}

export function ArtistCard({ artist }: ArtistCardProps) {
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
      className="group flex-shrink-0 w-40 sm:w-44 text-center p-3 rounded-lg hover:bg-surface transition-colors"
    >
      <div className="relative aspect-square rounded-full overflow-hidden bg-elevated mb-3 mx-auto shadow-lg">
        {artist.imageUrl ? (
          <img
            src={artist.imageUrl}
            alt={artist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🎤</div>
        )}
        <button
          onClick={handlePlay}
          className="absolute bottom-2 right-2 w-10 h-10 bg-accent rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 shadow-lg hover:scale-105 disabled:opacity-60"
          aria-label={`Play ${artist.name}`}
          disabled={loading}
        >
          <PlayIcon className="w-5 h-5 text-white ml-0.5" />
        </button>
      </div>
      <p className="text-sm font-semibold text-primary truncate">{artist.name}</p>
      <p className="text-xs text-secondary mt-0.5">{formatNumber(artist.monthlyListeners)} listeners</p>
    </Link>
  )
}
