import { useEffect, useState } from 'react'
import { TrophyIcon } from '@heroicons/react/24/solid'
import { trackService, type ChartEntry } from '@/services/trackService'
import { TrackCard } from '@/components/cards/TrackCard'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatNumber } from '@/utils/formatNumber'

/** Weekly Top 50 — ranked purely by plays in the last 7 days. */
export function ChartsPage() {
  useDocumentTitle('Charts')
  const [entries, setEntries] = useState<ChartEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trackService.getCharts(50).then(setEntries).catch(() => setEntries([])).finally(() => setLoading(false))
  }, [])

  const queue = entries.map((e) => e.track)

  return (
    <div className="px-6 py-6">
      <div className="mb-1 flex items-center gap-3">
        <TrophyIcon className="h-8 w-8 text-accent" />
        <h1 className="text-3xl font-bold text-primary">Top 50 this week</h1>
      </div>
      <p className="mb-6 text-sm text-secondary">The most played songs on not-spotify over the last 7 days.</p>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : entries.length === 0 ? (
        <p className="text-secondary">No plays recorded this week yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map((e) => (
            <div key={e.track.id} className="flex items-center gap-2">
              <span
                className={`w-10 shrink-0 text-center text-lg font-black tabular-nums ${
                  e.rank <= 3 ? 'text-accent' : 'text-secondary'
                }`}
              >
                {e.rank}
              </span>
              <div className="min-w-0 flex-1">
                <TrackCard track={e.track} queue={queue} />
              </div>
              <span className="hidden w-24 shrink-0 text-right text-xs font-semibold text-secondary sm:block">
                {e.playsThisWeek > 0 ? `${formatNumber(e.playsThisWeek)} plays` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
