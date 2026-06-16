import { useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { TrackTile } from '@/components/cards/TrackTile'
import { Spinner } from '@/components/ui/Spinner'

export function RecommendedTracksPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(async () => {
      try {
        const next = await trackService.getDiscoverWeekly(50)
        if (!cancelled) setTracks(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">Discover Weekly</h1>
        <p className="mt-1 text-sm text-secondary">
          Collaborative picks from listeners with similar play history.
        </p>
      </div>
      {loading ? (
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      ) : tracks.length === 0 ? (
        <p className="text-secondary">No recommendations yet.</p>
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
