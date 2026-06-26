import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { meService, type PlayHistoryItem } from '@/services/meService'
import { useAuthStore } from '@/stores/authStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { Spinner } from '@/components/ui/Spinner'
import { TrackRow } from '@/components/cards/TrackRow'

export function RecentsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isMobile = useIsMobile()
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

  return (
    <div className="px-6 py-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Listening history</h1>
      {!isAuthenticated ? (
        <p className="text-secondary">
          <Link to="/login" className="text-primary underline">Log in</Link> to see what you've been listening to.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : history.length === 0 ? (
        <p className="text-secondary">No recent plays yet. Hit play on something!</p>
      ) : (
        <div className="rounded-lg bg-surface p-2">
          {/* Column header — mirrors the album/playlist track tables. */}
          <div
            className="grid items-center gap-4 px-4 pb-2 text-xs uppercase tracking-wide text-secondary border-b border-elevated/40"
            style={{ gridTemplateColumns: isMobile ? '16px 1fr var(--track-actions-width)' : '16px 6fr 4fr 3fr var(--track-actions-width)' }}
          >
            <span className="text-center">#</span>
            <span>Title</span>
            {!isMobile && <span>Album</span>}
            {!isMobile && <span>Played</span>}
            <span />
          </div>
          {history.map((row, index) => (
            <TrackRow
              key={`${row.track.id}-${row.playedAt}-${index}`}
              track={row.track}
              index={index}
              queue={tracks}
              showAlbum
              addedAt={row.playedAt}
            />
          ))}
        </div>
      )}
    </div>
  )
}
