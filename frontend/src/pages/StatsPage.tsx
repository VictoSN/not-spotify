import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClockIcon, MusicalNoteIcon, UserGroupIcon, PlayCircleIcon } from '@heroicons/react/24/outline'
import { meService, type ListeningStats } from '@/services/meService'
import { useAuthStore } from '@/stores/authStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { TrackCard } from '@/components/cards/TrackCard'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatNumber } from '@/utils/formatNumber'

type Range = 7 | 30 | 365

const RANGE_LABELS: Record<Range, string> = {
  7: 'Last 7 days',
  30: 'Last 30 days',
  365: 'Last year',
}

function StatCard({ label, value, helper, icon: Icon }: {
  label: string
  value: string
  helper: string
  icon: typeof ClockIcon
}) {
  return (
    <div className="rounded-lg border border-elevated/50 bg-surface/90 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
          <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-accent/25 to-emerald-400/5 p-2.5 text-accent">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-3 text-sm text-secondary">{helper}</p>
    </div>
  )
}

/** Compact bar chart of plays per day across the window. */
function PlaysByDay({ data }: { data: ListeningStats['byDay'] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  // Too many days to label individually — show ~6 evenly spaced date ticks.
  const tickEvery = Math.ceil(data.length / 6)
  return (
    <div className="flex h-40 items-end gap-[3px] rounded-lg border border-elevated/40 bg-base/35 px-3 py-3">
      {data.map((d, i) => {
        const height = d.count === 0 ? 2 : Math.max(6, Math.round((d.count / max) * 100))
        const label = new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        return (
          <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
            <div className="relative flex flex-1 items-end">
              <div
                className="w-full rounded-t bg-gradient-to-t from-accent to-emerald-300 transition-all duration-500"
                style={{ height: `${height}%` }}
                title={`${label}: ${formatNumber(d.count)} plays`}
              />
            </div>
            <p className="h-3 truncate text-center text-[9px] text-muted">
              {i % tickEvery === 0 ? label : ''}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function StatsPage() {
  useDocumentTitle('Your listening stats')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const playWithGate = usePlaybackGate()
  const [range, setRange] = useState<Range>(30)
  const [stats, setStats] = useState<ListeningStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    setLoading(true)
    meService.getStats(range).then(setStats).catch(() => setStats(null)).finally(() => setLoading(false))
  }, [isAuthenticated, range])

  if (!isAuthenticated) {
    return (
      <div className="px-6 py-6">
        <h1 className="text-3xl font-bold text-primary mb-4">Your listening stats</h1>
        <p className="text-secondary">
          <Link to="/login" className="text-primary underline">Log in</Link> to see your top tracks, artists and listening time.
        </p>
      </div>
    )
  }

  const hours = stats ? Math.floor(stats.totalMinutes / 60) : 0
  const minutes = stats ? stats.totalMinutes % 60 : 0
  const topTracks = stats?.topTracks ?? []
  const maxArtistPlays = Math.max(...(stats?.topArtists.map((a) => a.playCount) ?? [1]), 1)

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Your listening stats</h1>
          <p className="mt-1 text-sm text-secondary">{RANGE_LABELS[range]} · your personal Wrapped</p>
        </div>
        <div className="flex gap-2">
          {([7, 30, 365] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                range === r ? 'bg-primary text-page' : 'bg-elevated text-secondary hover:text-primary'
              }`}
            >
              {r === 7 ? '7 days' : r === 30 ? '30 days' : '1 year'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : !stats || stats.totalPlays === 0 ? (
        <p className="text-secondary">No listening data for this period yet. Play some music and check back!</p>
      ) : (
        <div className="space-y-8">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Minutes listened"
              value={hours > 0 ? `${formatNumber(hours)}h ${minutes}m` : `${minutes}m`}
              helper={`${formatNumber(stats.totalPlays)} plays in total`}
              icon={ClockIcon}
            />
            <StatCard label="Plays" value={formatNumber(stats.totalPlays)} helper="Tracks started this period" icon={PlayCircleIcon} />
            <StatCard label="Different songs" value={formatNumber(stats.uniqueTracks)} helper="Unique tracks heard" icon={MusicalNoteIcon} />
            <StatCard label="Different artists" value={formatNumber(stats.uniqueArtists)} helper="Unique artists heard" icon={UserGroupIcon} />
          </div>

          {/* Plays per day */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-primary">Plays per day</h2>
            <PlaysByDay data={stats.byDay} />
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Top artists */}
            {stats.topArtists.length > 0 && (
              <section>
                <h2 className="mb-3 text-xl font-bold text-primary">Top artists</h2>
                <div className="space-y-2">
                  {stats.topArtists.map((a, i) => (
                    <Link
                      key={a.artistId}
                      to={`/artist/${a.artistId}`}
                      className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-elevated/60"
                    >
                      <span className="w-5 shrink-0 text-center text-sm font-bold text-secondary">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-primary">{a.name}</span>
                        <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${Math.round((a.playCount / maxArtistPlays) * 100)}%` }}
                          />
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-secondary">{formatNumber(a.playCount)} plays</span>
                    </Link>
                  ))}
                </div>

                {/* Top genres */}
                {stats.topGenres.length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-secondary">Top genres</h3>
                    <div className="flex flex-wrap gap-2">
                      {stats.topGenres.map((g) => (
                        <span key={g.name} className="rounded-full bg-elevated px-3 py-1.5 text-sm font-medium text-primary">
                          {g.name} <span className="text-secondary">· {formatNumber(g.playCount)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Top tracks */}
            {topTracks.length > 0 && (
              <section>
                <h2 className="mb-3 text-xl font-bold text-primary">Top tracks</h2>
                <div className="flex flex-col gap-1">
                  {topTracks.map((t, i) => (
                    <div key={t.track.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-sm font-bold text-secondary">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <TrackCard track={t.track} queue={topTracks.map((x) => x.track)} />
                      </div>
                      <span className="hidden w-16 shrink-0 text-right text-xs font-semibold text-secondary sm:block">
                        {formatNumber(t.playCount)}×
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
