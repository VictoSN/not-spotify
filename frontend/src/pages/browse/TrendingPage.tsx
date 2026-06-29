import { useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { TrackTile } from '@/components/cards/TrackTile'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  COLLECTION_GRID_CLASS,
  COLLECTION_PAGE_CLASS,
  CollectionPageHeader,
  CollectionPageSkeleton,
} from '@/components/common/CollectionPage'

export function TrendingPage() {
  useDocumentTitle('Trending')
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trackService.getTrending(50).then(setTracks).finally(() => setLoading(false))
  }, [])

  if (loading) return <CollectionPageSkeleton label="Loading trending tracks" />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <CollectionPageHeader
        title="Trending now"
        description="The tracks getting the most attention across NotSpotify."
      />
      {tracks.length === 0 ? (
        <p className="text-secondary">Nothing trending right now.</p>
      ) : (
        <div className={COLLECTION_GRID_CLASS}>
          {tracks.map((t) => (
            <TrackTile key={t.id} track={t} queue={tracks} fluid />
          ))}
        </div>
      )}
    </div>
  )
}
