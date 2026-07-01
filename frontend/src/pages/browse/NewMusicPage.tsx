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

export function NewMusicPage() {
  useDocumentTitle('New music')
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(async () => {
      try {
        const next = await trackService.getNewMusic(50)
        if (!cancelled) setTracks(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <CollectionPageSkeleton label="Loading new music" />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <CollectionPageHeader
        title="New music"
        description="The newest tracks landing on not-spotify right now."
      />
      {tracks.length === 0 ? (
        <p className="text-secondary">No new tracks yet.</p>
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
