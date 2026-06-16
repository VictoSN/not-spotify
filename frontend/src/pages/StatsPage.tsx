import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDaysIcon,
  ClockIcon,
  FireIcon,
  MusicalNoteIcon,
  PlayCircleIcon,
  SparklesIcon,
  TrophyIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { meService, type ListeningStats } from '@/services/meService'
import { useAuthStore } from '@/stores/authStore'
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

function formatListenTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${formatNumber(hours)}h ${minutes}m` : `${minutes}m`
}

function listeningPersona(stats: ListeningStats) {
  const topArtist = stats.topArtists[0]
  const topGenre = stats.topGenres[0]
  const topArtistShare = topArtist && stats.totalPlays > 0 ? topArtist.playCount / stats.totalPlays : 0

  if (topArtistShare >= 0.35) {
    return {
      title: 'The Loyalist',
      copy: `${topArtist.name} owned your queue this year.`,
    }
  }

  if (stats.uniqueArtists >= 25) {
    return {
      title: 'The Explorer',
      copy: `You visited ${formatNumber(stats.uniqueArtists)} artists without staying in one lane.`,
    }
  }

  if (topGenre) {
    return {
      title: `${topGenre.name} Signal`,
      copy: `${topGenre.name} was the sound you kept coming back to.`,
    }
  }

  return {
    title: 'The Curator',
    copy: 'A focused year of listening, saved one play at a time.',
  }
}

function WrappedMetric({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string
  helper: string
  icon: typeof ClockIcon
}) {
  return (
    <div className="rounded-lg border border-elevated/50 bg-base/35 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <p className="truncate text-2xl font-black text-primary">{value}</p>
      <p className="mt-1 text-sm text-secondary">{helper}</p>
    </div>
  )
}

function WrappedYearView({ stats }: { stats: ListeningStats }) {
  const topTrack = stats.topTracks[0]
  const topArtist = stats.topArtists[0]
  const topGenre = stats.topGenres[0]
  const topDay = stats.byDay.reduce(
    (best, day) => (day.count > best.count ? day : best),
    { date: '', count: 0 },
  )
  const persona = listeningPersona(stats)
  const topDayLabel = topDay.date
    ? new Date(topDay.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : 'No peak day yet'

  return (
    <section className="overflow-hidden rounded-lg border border-elevated/50 bg-surface">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative min-h-[24rem] p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(29,185,84,0.22),transparent_30%),radial-gradient(circle_at_80%_15%,rgba(56,189,248,0.16),transparent_28%),linear-gradient(135deg,rgba(18,18,18,0.96),rgba(18,18,18,0.72))]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white/85">
                <SparklesIcon className="h-4 w-4" />
                Year recap
              </div>
              <h2 className="max-w-xl text-4xl font-black leading-tight text-white sm:text-5xl">
                Your Wrapped is ready.
              </h2>
              <p className="mt-4 max-w-lg text-sm text-white/70">
                A full-year look at the songs, artists, genres, and habits that shaped your listening.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-white/55">Minutes</p>
                <p className="text-2xl font-black text-white">{formatListenTime(stats.totalMinutes)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-white/55">Top artist</p>
                <p className="truncate text-2xl font-black text-white">{topArtist?.name ?? 'Still forming'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-white/55">Persona</p>
                <p className="truncate text-2xl font-black text-white">{persona.title}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5 bg-base/45 p-6 sm:p-8">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">Song of the year</p>
            {topTrack ? (
              <Link to={`/track/${topTrack.track.id}`} className="group flex items-center gap-4">
                <img
                  src={topTrack.track.album.coverUrl}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-lg object-cover shadow-2xl transition-transform group-hover:scale-105"
                />
                <span className="min-w-0">
                  <span className="block truncate text-2xl font-black text-primary group-hover:underline">
                    {topTrack.track.title}
                  </span>
                  <span className="mt-1 block truncate text-sm text-secondary">{topTrack.track.artist.name}</span>
                  <span className="mt-3 inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
                    {formatNumber(topTrack.playCount)} plays
                  </span>
                </span>
              </Link>
            ) : (
              <p className="text-secondary">Play more music to reveal your song of the year.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <WrappedMetric
              label="Peak day"
              value={topDayLabel}
              helper={`${formatNumber(topDay.count)} plays`}
              icon={CalendarDaysIcon}
            />
            <WrappedMetric
              label="Top genre"
              value={topGenre?.name ?? 'Still forming'}
              helper={topGenre ? `${formatNumber(topGenre.playCount)} plays` : 'No genre leader yet'}
              icon={FireIcon}
            />
            <WrappedMetric
              label="Different songs"
              value={formatNumber(stats.uniqueTracks)}
              helper="Unique tracks heard"
              icon={MusicalNoteIcon}
            />
            <WrappedMetric
              label={persona.title}
              value="Listening type"
              helper={persona.copy}
              icon={TrophyIcon}
            />
          </div>
        </div>
      </div>
    </section>
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
  const [range, setRange] = useState<Range>(30)
  const [stats, setStats] = useState<ListeningStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(async () => {
      if (!isAuthenticated) {
        if (!cancelled) {
          setStats(null)
          setLoading(false)
        }
        return
      }

      if (!cancelled) setLoading(true)
      try {
        const next = await meService.getStats(range)
        if (!cancelled) setStats(next)
      } catch {
        if (!cancelled) setStats(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
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

  const topTracks = stats?.topTracks ?? []
  const topTrackQueue = topTracks.map((x) => x.track)
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
          {range === 365 && <WrappedYearView stats={stats} />}

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Minutes listened"
              value={formatListenTime(stats.totalMinutes)}
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
                        <TrackCard track={t.track} queue={topTrackQueue} />
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
