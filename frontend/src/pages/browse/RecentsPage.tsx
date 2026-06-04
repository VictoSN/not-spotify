import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { useAuthStore } from '@/stores/authStore'
import { TrackTile } from '@/components/cards/TrackTile'
import { Spinner } from '@/components/ui/Spinner'

export function RecentsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    trackService.getRecents(50).then(setTracks).finally(() => setLoading(false))
  }, [isAuthenticated])

  return (
    <div className="px-6 py-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Recently played</h1>
      {!isAuthenticated ? (
        <p className="text-secondary">
          <Link to="/login" className="text-primary underline">Log in</Link> to see what you've been listening to.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : tracks.length === 0 ? (
        <p className="text-secondary">No recent plays yet. Hit play on something!</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tracks.map((t) => (
            <TrackTile key={t.id} track={t} queue={tracks} />
          ))}
        </div>
      )}
    </div>
  )
}
