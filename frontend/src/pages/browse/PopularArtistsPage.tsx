import { useEffect, useState } from 'react'
import type { Artist } from '@/types/artist'
import { artistService } from '@/services/artistService'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { Spinner } from '@/components/ui/Spinner'

export function PopularArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    artistService.getPopular(50).then(setArtists).finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-6 py-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Popular artists</h1>
      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : artists.length === 0 ? (
        <p className="text-secondary">No artists yet.</p>
      ) : (
        <div
          data-testid="popular-artists-grid"
          className="grid [grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-4 gap-y-7"
        >
          {artists.map((a) => (
            <ArtistCard key={a.id} artist={a} fluid />
          ))}
        </div>
      )}
    </div>
  )
}
