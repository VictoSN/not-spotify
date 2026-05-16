import { Link } from 'react-router-dom'
import type { Artist } from '@/types/artist'
import { formatNumber } from '@/utils/formatNumber'

interface ArtistCardProps {
  artist: Artist
}

export function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <Link to={`/artist/${artist.id}`} className="group flex-shrink-0 w-40 sm:w-44 text-center">
      <div className="relative aspect-square rounded-full overflow-hidden bg-elevated mb-3 mx-auto">
        {artist.imageUrl ? (
          <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🎤</div>
        )}
      </div>
      <p className="text-sm font-semibold text-primary truncate">{artist.name}</p>
      <p className="text-xs text-secondary mt-0.5">{formatNumber(artist.monthlyListeners)} listeners</p>
    </Link>
  )
}
