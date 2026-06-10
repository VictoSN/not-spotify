import { useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { TrackTile } from '@/components/cards/TrackTile'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function TrendingPage() {
  useDocumentTitle('Trending')
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trackService.getTrending(50).then(setTracks).finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-6 py-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Trending</h1>
      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : tracks.length === 0 ? (
        <p className="text-secondary">Nothing trending right now.</p>
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
