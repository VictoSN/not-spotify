import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { meService, type PlayHistoryItem } from '@/services/meService'
import { useAuthStore } from '@/stores/authStore'
import { TrackTile } from '@/components/cards/TrackTile'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  COLLECTION_GRID_CLASS,
  COLLECTION_PAGE_CLASS,
  CollectionPageHeader,
  CollectionPageSkeleton,
} from '@/components/common/CollectionPage'

export function RecentsPage() {
  useDocumentTitle('Recently played')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [history, setHistory] = useState<PlayHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    meService.getHistory(50).then(setHistory).finally(() => setLoading(false))
  }, [isAuthenticated])

  const tracks = history.map((row) => row.track)

  if (isAuthenticated && loading) return <CollectionPageSkeleton label="Loading recently played" />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <CollectionPageHeader
        title="Recently played"
        description="Pick up where you left off."
      />
      {!isAuthenticated ? (
        <p className="text-secondary">
          <Link to="/login" className="text-primary underline">Log in</Link> to see what you&apos;ve been listening to.
        </p>
      ) : history.length === 0 ? (
        <p className="text-secondary">No recent plays yet. Hit play on something!</p>
      ) : (
        <div className={COLLECTION_GRID_CLASS} data-testid="recently-played-grid">
          {history.map((row, index) => (
            <TrackTile
              key={`${row.track.id}-${row.playedAt}-${index}`}
              track={row.track}
              queue={tracks}
              fluid
            />
          ))}
        </div>
      )}
    </div>
  )
}
