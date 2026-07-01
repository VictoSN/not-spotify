import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react'
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  EyeIcon,
  MusicalNoteIcon,
  PlayCircleIcon,
  SignalIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { adminService, type AdminDashboardStats, type AdminTrendPoint } from '@/services/adminService'
import { Spinner } from '@/components/ui/Spinner'
import { AreaChart, type AreaPoint } from '@/components/common/AreaChart'

/** Maps an admin trend series to the AreaChart's point shape. */
function toAreaData(data: AdminTrendPoint[]): AreaPoint[] {
  return data.map((p) => ({ label: p.date, value: p.count }))
}

type IconType = ComponentType<SVGProps<SVGSVGElement>>

const number = new Intl.NumberFormat()

function formatNumber(value: number) {
  return number.format(value)
}

function formatRelativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime()
  const seconds = Math.max(0, Math.floor(delta / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function recentSharePercent(recentPlays: number, allTimePlays: number) {
  if (allTimePlays <= 0) return recentPlays > 0 ? 100 : 0
  return Math.min(100, Math.round((recentPlays / allTimePlays) * 100))
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = 'green',
}: {
  label: string
  value: string
  helper: string
  icon: IconType
  accent?: 'green' | 'purple' | 'blue' | 'amber'
}) {
  const accents = {
    green: 'from-accent/25 to-emerald-400/5 text-accent',
    purple: 'from-purple-400/25 to-fuchsia-400/5 text-purple-300',
    blue: 'from-sky-400/25 to-cyan-400/5 text-sky-300',
    amber: 'from-amber-400/25 to-orange-400/5 text-amber-300',
  }

  return (
    <div className="rounded-lg border border-elevated/50 bg-surface/90 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
          <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
        </div>
        <div className={`rounded-lg bg-gradient-to-br p-2.5 ${accents[accent]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-3 text-sm text-secondary">{helper}</p>
    </div>
  )
}

function EmptyPanel({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-elevated/60 bg-base/30 px-5 py-10 text-center text-sm text-secondary">
      {children}
    </div>
  )
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (refresh = false) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true)
    setError(null)
    try {
      setStats(await adminService.getDashboardStats())
    } catch {
      setError('Failed to load admin dashboard.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const topTrackMax = useMemo(() => {
    if (!stats?.topTracks.length) return 1
    return Math.max(...stats.topTracks.map((track) => track.playsInWindow), 1)
  }, [stats])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error ?? 'Dashboard unavailable.'}
        </div>
      </div>
    )
  }

  const totalPending = stats.pendingApplications + stats.pendingAlbums + stats.pendingTracks

  return (
    <div className="mx-auto max-w-7xl p-5 sm:p-6 lg:p-8">
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-accent">
            <SignalIcon className="h-4 w-4" />
            Live admin
          </div>
          <h1 className="text-3xl font-bold text-primary sm:text-4xl">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-secondary">
            Site activity, listening demand, catalog health, and moderation workload for not-spotify.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={isRefreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-elevated/70 bg-elevated/40 px-4 text-sm font-semibold text-primary transition hover:border-accent/50 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Visits today"
          value={formatNumber(stats.visitsToday)}
          helper={`${formatNumber(stats.totalVisits)} total site visits recorded`}
          icon={EyeIcon}
          accent="green"
        />
        <StatCard
          label="Active listeners"
          value={formatNumber(stats.activeListeners)}
          helper="Users heard from in the last 90 seconds"
          icon={PlayCircleIcon}
          accent="blue"
        />
        <StatCard
          label="Plays today"
          value={formatNumber(stats.playsToday)}
          helper={`${formatNumber(stats.playsLast7Days)} plays across the last 7 days`}
          icon={MusicalNoteIcon}
          accent="purple"
        />
        <StatCard
          label="Review queue"
          value={formatNumber(totalPending)}
          helper={`${stats.pendingApplications} applications, ${stats.pendingAlbums} albums, ${stats.pendingTracks} tracks`}
          icon={ClipboardDocumentListIcon}
          accent="amber"
        />
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-lg border border-elevated/50 bg-surface/90 p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-primary">Traffic and plays</h2>
              <p className="text-sm text-secondary">Seven-day trend from app route visits and track play history.</p>
            </div>
            <ArrowTrendingUpIcon className="h-6 w-6 text-accent" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">Site visits</span>
                <span className="text-xs font-semibold text-accent">{formatNumber(stats.totalVisits)} total</span>
              </div>
              <AreaChart data={toAreaData(stats.visitsTrend)} height={150} color="var(--c-accent, #1db954)" formatValue={(n) => `${formatNumber(n)} visits`} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">Music plays</span>
                <span className="text-xs font-semibold text-sky-300">{formatNumber(stats.playsLast7Days)} this week</span>
              </div>
              <AreaChart data={toAreaData(stats.playsTrend)} height={150} color="#38bdf8" formatValue={(n) => `${formatNumber(n)} plays`} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-elevated/50 bg-surface/90 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-primary">Catalog</h2>
              <p className="text-sm text-secondary">Current library footprint.</p>
            </div>
            <SparklesIcon className="h-6 w-6 text-purple-300" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Tracks', stats.totalTracks],
              ['Artists', stats.totalArtists],
              ['Albums', stats.totalAlbums],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-elevated/40 bg-base/35 p-3">
                <p className="text-2xl font-bold text-primary">{formatNumber(Number(value))}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-elevated/40 bg-base/35 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">Users</p>
                <p className="mt-1 text-xs text-secondary">{formatNumber(stats.premiumUsers)} premium accounts</p>
              </div>
              <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                <UserGroupIcon className="h-6 w-6 text-accent" />
                {formatNumber(stats.totalUsers)}
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${stats.totalUsers ? Math.round((stats.premiumUsers / stats.totalUsers) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-elevated/50 bg-surface/90 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-primary">Live listening</h2>
              <p className="text-sm text-secondary">Tracks with active playback heartbeats.</p>
            </div>
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
              {formatNumber(stats.activeListeners)} online
            </span>
          </div>
          {stats.activeTracks.length === 0 ? (
            <EmptyPanel>No active listening sessions yet.</EmptyPanel>
          ) : (
            <div className="space-y-3">
              {stats.activeTracks.map((track) => (
                <div key={track.id} className="flex items-center gap-3 rounded-lg bg-base/35 p-3">
                  {track.coverUrl ? (
                    <img src={track.coverUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-elevated text-muted">
                      <MusicalNoteIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-primary">{track.title}</p>
                    <p className="truncate text-sm text-secondary">{track.artistName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-accent">{track.activeListeners}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">live</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-elevated/50 bg-surface/90 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-primary">Top music</h2>
              <p className="text-sm text-secondary">Most played tracks in the last 30 days.</p>
            </div>
            <MusicalNoteIcon className="h-6 w-6 text-accent" />
          </div>
          {stats.topTracks.length === 0 ? (
            <EmptyPanel>No plays recorded yet.</EmptyPanel>
          ) : (
            <div className="space-y-3">
              <div className="hidden grid-cols-[minmax(0,1fr)_112px_96px_88px_84px] items-center gap-3 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted md:grid">
                <span>Track</span>
                <span className="text-right">Last 30 days</span>
                <span className="text-right">All time</span>
                <span className="text-right">Listeners</span>
                <span className="text-right">Trend</span>
              </div>
              {stats.topTracks.map((track, index) => {
                const width = Math.max(5, Math.round((track.playsInWindow / topTrackMax) * 100))
                const recentShare = recentSharePercent(track.playsInWindow, track.playCount)
                return (
                  <div key={track.id} className="rounded-lg border border-elevated/35 bg-base/35 p-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_112px_96px_88px_84px] md:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-6 text-center text-sm font-bold text-muted">{index + 1}</span>
                        {track.coverUrl ? (
                          <img src={track.coverUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-elevated text-muted">
                            <MusicalNoteIcon className="h-6 w-6" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-primary">{track.title}</p>
                          <p className="truncate text-sm text-secondary">{track.artistName} - {track.albumTitle}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:contents">
                        <div className="rounded-md bg-elevated/30 px-3 py-2 text-left md:bg-transparent md:px-0 md:py-0 md:text-right">
                          <p className="top-music-window-label text-[11px] font-bold uppercase tracking-[0.12em] md:hidden">Last 30 days</p>
                          <p className="top-music-window-value text-lg font-extrabold md:text-base">{formatNumber(track.playsInWindow)}</p>
                        </div>
                        <div className="rounded-md bg-elevated/30 px-3 py-2 text-left md:bg-transparent md:px-0 md:py-0 md:text-right">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted md:hidden">All time</p>
                          <p className="font-bold text-primary">{formatNumber(track.playCount)}</p>
                        </div>
                        <div className="rounded-md bg-elevated/30 px-3 py-2 text-left md:bg-transparent md:px-0 md:py-0 md:text-right">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted md:hidden">Listeners</p>
                          <p className="font-semibold text-secondary">{formatNumber(track.uniqueListeners)}</p>
                        </div>
                        <div className="rounded-md bg-elevated/30 px-3 py-2 text-left md:bg-transparent md:px-0 md:py-0 md:text-right">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted md:hidden">Trend</p>
                          <span className="top-music-trend-chip inline-flex items-center justify-end gap-1 rounded-full px-2 py-1 text-xs font-bold">
                            <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
                            {recentShare}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-elevated/50 bg-surface/90 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary">Recent visits</h2>
            <p className="text-sm text-secondary">Latest route-level site activity.</p>
          </div>
          <ClockIcon className="h-6 w-6 text-secondary" />
        </div>
        {stats.recentVisits.length === 0 ? (
          <EmptyPanel>No visits recorded yet.</EmptyPanel>
        ) : (
          <div className="overflow-hidden rounded-lg border border-elevated/40">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-base/60 text-xs uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Path</th>
                  <th className="px-4 py-3 font-bold">User</th>
                  <th className="px-4 py-3 text-right font-bold">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-elevated/35">
                {stats.recentVisits.map((visit, index) => (
                  <tr key={`${visit.path}-${visit.visitedAt}-${index}`} className="bg-base/20">
                    <td className="px-4 py-3 font-semibold text-primary">{visit.path}</td>
                    <td className="px-4 py-3 text-secondary">{visit.userName || 'Guest'}</td>
                    <td className="px-4 py-3 text-right text-muted">{formatRelativeTime(visit.visitedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
