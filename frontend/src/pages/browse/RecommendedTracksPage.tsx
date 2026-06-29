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

export function RecommendedTracksPage() {
  useDocumentTitle('For you today')
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(async () => {
      try {
        const next = await trackService.getForYou(50)
        if (!cancelled) setTracks(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <CollectionPageSkeleton label="Loading For you today" />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <CollectionPageHeader
        title="For you today"
        description="Personalized picks based on what you listen to."
      />
      {tracks.length === 0 ? (
        <p className="text-secondary">No recommendations yet.</p>
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
