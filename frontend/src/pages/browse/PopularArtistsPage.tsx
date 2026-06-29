import { useEffect, useState } from 'react'
import type { Artist } from '@/types/artist'
import { artistService } from '@/services/artistService'
import { ArtistCard } from '@/components/cards/ArtistCard'
import {
  COLLECTION_GRID_CLASS,
  COLLECTION_PAGE_CLASS,
  CollectionPageHeader,
  CollectionPageSkeleton,
} from '@/components/common/CollectionPage'

export function PopularArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    artistService.getPopular(50).then(setArtists).finally(() => setLoading(false))
  }, [])

  if (loading) return <CollectionPageSkeleton label="Loading popular artists" roundArtwork />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <CollectionPageHeader
        title="Popular artists"
        description="The artists listeners are playing most right now."
      />
      {artists.length === 0 ? (
        <p className="text-secondary">No artists yet.</p>
      ) : (
        <div
          data-testid="popular-artists-grid"
          className={COLLECTION_GRID_CLASS}
        >
          {artists.map((a) => (
            <ArtistCard key={a.id} artist={a} fluid />
          ))}
        </div>
      )}
    </div>
  )
}
