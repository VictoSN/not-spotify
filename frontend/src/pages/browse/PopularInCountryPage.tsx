import { useEffect, useMemo, useState } from 'react'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { TrackTile } from '@/components/cards/TrackTile'
import { useAuthStore } from '@/stores/authStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  COLLECTION_GRID_CLASS,
  COLLECTION_PAGE_CLASS,
  CollectionPageHeader,
  CollectionPageSkeleton,
} from '@/components/common/CollectionPage'

export function PopularInCountryPage() {
  const { user } = useAuthStore()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  const countryCode = (user?.country || 'US').toUpperCase()
  const countryName = useMemo(() => {
    try {
      return new Intl.DisplayNames(undefined, { type: 'region' }).of(countryCode) || countryCode
    } catch {
      return countryCode
    }
  }, [countryCode])

  useDocumentTitle(`Popular in ${countryName}`)

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(async () => {
      try {
        const next = await trackService.getPopularInCountry(user?.country, 50)
        if (!cancelled) setTracks(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [user?.country])

  if (loading) return <CollectionPageSkeleton label={`Loading popular in ${countryName}`} />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <CollectionPageHeader
        title={`Popular in ${countryName}`}
        description={`Tracks trending with listeners in ${countryName} right now.`}
      />
      {tracks.length === 0 ? (
        <p className="text-secondary">Nothing charting locally yet.</p>
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
