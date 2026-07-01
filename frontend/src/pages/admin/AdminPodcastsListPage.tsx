import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useConfirm } from '@/hooks/useConfirm'
import { useDebounce } from '@/hooks/useDebounce'
import {
  TrashIcon, CheckCircleIcon, XCircleIcon, ClockIcon, ChevronDownIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import type { Episode, Podcast, PodcastSummary } from '@/types/podcast'
import { adminService, type ReviewHistoryEntry } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SearchInput } from '@/components/common/SearchInput'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ReviewNoteForm } from '@/components/admin/ReviewNoteForm'

type Tab = 'pending' | 'approved' | 'rejected' | 'all'
type EntityKind = 'podcast' | 'episode'
type PendingReview = { id: string; kind: EntityKind; action: 'approve' | 'reject'; note: string; saving: boolean }

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function AdminPodcastsListPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('pending')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 200)
  const [podcasts, setPodcasts] = useState<PodcastSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const [openPodcasts, setOpenPodcasts] = useState<Set<string>>(new Set())
  const [podcastDetail, setPodcastDetail] = useState<Map<string, Podcast | 'loading' | 'error'>>(new Map())

  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)
  const [reviewHistory, setReviewHistory] = useState<Record<string, ReviewHistoryEntry[]>>({})
  const [historyOpen, setHistoryOpen] = useState<Set<string>>(new Set())
  const [historyLoading, setHistoryLoading] = useState<Set<string>>(new Set())

  // Race-safe reload — see AdminTracksListPage for the rationale.
  const requestIdRef = useRef(0)
  const reload = async (t: Tab = tab) => {
    const myId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)
    setOpenPodcasts(new Set())
    setPodcastDetail(new Map())
    try {
      const data = t === 'pending' ? await adminService.listPendingPodcasts() : await adminService.listPodcasts(t === 'all' ? undefined : t)
      if (myId !== requestIdRef.current) return
      setPodcasts(data)
    } catch (err) {
      if (myId !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load podcasts')
    } finally {
      if (myId === requestIdRef.current) setIsLoading(false)
    }
  }

  useEffect(() => { reload(tab) }, [tab])

  const visiblePodcasts = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return podcasts
    return podcasts.filter((p) => p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q))
  }, [podcasts, debouncedQuery])

  const togglePodcast = async (id: string) => {
    const next = new Set(openPodcasts)
    if (next.has(id)) { next.delete(id); setOpenPodcasts(next); return }
    next.add(id); setOpenPodcasts(next)

    if (!podcastDetail.has(id)) {
      setPodcastDetail((prev) => new Map(prev).set(id, 'loading'))
      try {
        const detail = await adminService.getPodcast(id)
        setPodcastDetail((prev) => new Map(prev).set(id, detail))
      } catch {
        setPodcastDetail((prev) => new Map(prev).set(id, 'error'))
      }
    }
  }

  const toggleHistory = async (id: string, kind: EntityKind) => {
    const next = new Set(historyOpen)
    if (next.has(id)) { next.delete(id); setHistoryOpen(next); return }
    next.add(id); setHistoryOpen(next)
    if (reviewHistory[id] !== undefined) return
    setHistoryLoading((s) => new Set(s).add(id))
    try {
      const data = kind === 'podcast'
        ? await adminService.getPodcastReviewHistory(id)
        : await adminService.getEpisodeReviewHistory(id)
      setReviewHistory((prev) => ({ ...prev, [id]: data }))
    } finally {
      setHistoryLoading((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  const startReview = (id: string, kind: EntityKind, action: 'approve' | 'reject') =>
    setPendingReview({ id, kind, action, note: '', saving: false })

  const confirmReview = async () => {
    if (!pendingReview) return
    const { id, kind, action, note } = pendingReview
    setPendingReview((p) => p && { ...p, saving: true })
    setActingId(id)
    try {
      if (kind === 'podcast') {
        if (action === 'approve') await adminService.approvePodcast(id, note || undefined)
        else await adminService.rejectPodcast(id, note || undefined)
        setPodcasts((prev) => prev.filter((p) => p.id !== id))
      } else {
        if (action === 'approve') await adminService.approveEpisode(id, note || undefined)
        else await adminService.rejectEpisode(id, note || undefined)
        setPodcastDetail((prev) => {
          const next = new Map(prev)
          for (const [podcastId, detail] of next) {
            if (detail !== 'loading' && detail !== 'error') {
              next.set(podcastId, {
                ...detail,
                episodes: detail.episodes.map((ep) =>
                  ep.id === id ? { ...ep, status: action === 'approve' ? 'approved' : 'rejected', reviewNote: note || null } : ep),
              })
            }
          }
          return next
        })
      }
      setPendingReview(null)
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? `${action === 'approve' ? 'Approval' : 'Rejection'} failed.`)
      setPendingReview((p) => p && { ...p, saving: false })
    } finally {
      setActingId(null)
    }
  }

  const handleDeletePodcast = async (podcast: PodcastSummary) => {
    if (!(await confirm({
      title: `Delete "${podcast.title}"?`,
      message: 'All of its episodes will also be deleted. This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    }))) return
    setActingId(podcast.id)
    try {
      await adminService.deletePodcast(podcast.id)
      setPodcasts((prev) => prev.filter((p) => p.id !== podcast.id))
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Delete failed.')
    } finally {
      setActingId(null)
    }
  }

  const handleDeleteEpisode = async (episode: Episode) => {
    if (!(await confirm({
      title: `Delete "${episode.title}"?`,
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    }))) return
    setActingId(episode.id)
    try {
      await adminService.deleteEpisode(episode.id)
      setPodcastDetail((prev) => {
        const next = new Map(prev)
        const detail = next.get(episode.podcastId)
        if (detail && detail !== 'loading' && detail !== 'error') {
          next.set(episode.podcastId, { ...detail, episodes: detail.episodes.filter((ep) => ep.id !== episode.id) })
        }
        return next
      })
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Delete failed.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Podcasts</h1>
          <p className="text-secondary text-sm mt-1">Review artist-submitted shows and episodes before they go live.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {([
          ['pending', 'Pending'],
          ['approved', 'Approved'],
          ['rejected', 'Rejected'],
          ['all', 'All'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              tab === t ? 'bg-accent text-black' : 'bg-elevated text-secondary hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by show or author…"
        className="mb-4 max-w-md"
        ariaLabel="Search podcasts"
      />

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : visiblePodcasts.length === 0 ? (
        <div className="bg-surface rounded-lg border border-elevated/40 px-6 py-12 text-center text-secondary text-sm">
          {debouncedQuery.trim()
            ? 'No results found.'
            : tab === 'pending' ? 'No shows awaiting review.' : tab === 'approved' ? 'No approved shows.' : tab === 'rejected' ? 'No rejected shows.' : 'No shows yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePodcasts.map((podcast) => {
            const isOpen = openPodcasts.has(podcast.id)
            const detail = podcastDetail.get(podcast.id)
            const episodes = detail && detail !== 'loading' && detail !== 'error' ? detail.episodes : []

            return (
              <div key={podcast.id} className="bg-surface border border-elevated/40 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => togglePodcast(podcast.id)}
                    className="shrink-0 flex items-center justify-center w-6 h-6 rounded hover:bg-elevated/60 text-secondary hover:text-primary transition-colors">
                    {isOpen ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-primary text-sm">{podcast.title}</span>
                      <StatusBadge status={podcast.status ?? 'approved'} />
                      <span className="text-xs text-secondary">{podcast.episodeCount} episode{podcast.episodeCount !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-xs text-secondary">{podcast.author}</p>
                    {podcast.reviewNote && (
                      <p className={`text-xs italic ${podcast.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>
                        {podcast.status === 'rejected' ? 'Rejection' : 'Review'} note: {podcast.reviewNote}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleHistory(podcast.id, 'podcast')}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors mt-0.5"
                    >
                      <ClockIcon className="w-3.5 h-3.5" />
                      History
                    </button>
                  </div>
                  <div className="flex gap-2 items-center shrink-0">
                    {podcast.status === 'pending' ? (
                      <>
                        <Button size="sm" onClick={() => startReview(podcast.id, 'podcast', 'approve')} disabled={!!actingId}>
                          <CheckCircleIcon className="w-4 h-4" />
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startReview(podcast.id, 'podcast', 'reject')} disabled={!!actingId}>
                          <XCircleIcon className="w-4 h-4" />
                          Reject
                        </Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => handleDeletePodcast(podcast)} disabled={actingId === podcast.id}>
                      {actingId === podcast.id ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                      Delete
                    </Button>
                  </div>
                </div>

                {pendingReview?.id === podcast.id && pendingReview.kind === 'podcast' && (
                  <div className="px-4 py-3 border-t border-elevated/20 bg-elevated/5">
                    <ReviewNoteForm
                      action={pendingReview.action}
                      note={pendingReview.note}
                      saving={pendingReview.saving}
                      onNoteChange={(val) => setPendingReview((p) => p && { ...p, note: val })}
                      onConfirm={confirmReview}
                      onCancel={() => setPendingReview(null)}
                    />
                  </div>
                )}

                {historyOpen.has(podcast.id) && (
                  <div className="px-4 py-3 border-t border-elevated/20 bg-elevated/5">
                    {historyLoading.has(podcast.id) ? (
                      <div className="flex items-center gap-1.5 text-xs text-secondary"><Spinner size="sm" /> Loading…</div>
                    ) : !reviewHistory[podcast.id] || reviewHistory[podcast.id].length === 0 ? (
                      <p className="text-xs text-muted italic">No review history yet.</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {reviewHistory[podcast.id].map((h) => (
                          <div key={h.id} className={`flex items-start gap-2 text-xs rounded px-2 py-1.5 ${h.action === 'rejected' ? 'bg-red-500/10' : h.action === 'resubmitted' ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
                            <span className={`font-semibold capitalize shrink-0 ${h.action === 'rejected' ? 'text-red-400' : h.action === 'resubmitted' ? 'text-amber-400' : 'text-green-400'}`}>{h.action}</span>
                            <span className="text-muted shrink-0">{new Date(h.reviewedAt).toLocaleString()}{h.reviewedByName && ` · ${h.reviewedByName}`}</span>
                            {h.note && <span className="text-secondary italic">— {h.note}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isOpen && (
                  <div className="border-t border-elevated/30 overflow-x-auto">
                    {detail === 'loading' ? (
                      <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                    ) : detail === 'error' ? (
                      <p className="px-4 py-3 text-xs text-red-400">Failed to load episodes.</p>
                    ) : episodes.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-secondary italic">No episodes uploaded yet.</p>
                    ) : (
                      <table className="w-full min-w-[560px]">
                        <thead>
                          <tr className="border-b border-elevated/20 bg-elevated/10">
                            <th className="w-10 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-secondary">#</th>
                            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-secondary">Title</th>
                            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-secondary">Duration</th>
                            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-secondary">Status</th>
                            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-secondary">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {episodes.map((ep) => (
                            <React.Fragment key={ep.id}>
                              <tr className="border-b border-elevated/10 hover:bg-elevated/20 transition-colors">
                                <td className="px-3 py-2 text-secondary text-sm">{ep.episodeNumber}</td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm text-primary">{ep.title}</span>
                                    {ep.reviewNote && (
                                      <span className={`text-xs italic ${ep.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>
                                        {ep.status === 'rejected' ? 'Rejection' : 'Review'} note: {ep.reviewNote}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => toggleHistory(ep.id, 'episode')}
                                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors w-fit"
                                    >
                                      <ClockIcon className="w-3 h-3" />
                                      History
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-secondary text-sm">{fmtDuration(ep.durationMs)}</td>
                                <td className="px-3 py-2"><StatusBadge status={ep.status ?? 'approved'} /></td>
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1 items-center flex-wrap justify-end">
                                    {ep.status === 'pending' && (
                                      <>
                                        <button type="button" onClick={() => startReview(ep.id, 'episode', 'approve')}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors">
                                          <CheckCircleIcon className="w-3.5 h-3.5" />Approve
                                        </button>
                                        <button type="button" onClick={() => startReview(ep.id, 'episode', 'reject')}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
                                          <XCircleIcon className="w-3.5 h-3.5" />Reject
                                        </button>
                                      </>
                                    )}
                                    <button type="button" onClick={() => handleDeleteEpisode(ep)} disabled={actingId === ep.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors">
                                      {actingId === ep.id ? <Spinner size="sm" /> : <TrashIcon className="w-3.5 h-3.5" />}Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {pendingReview?.id === ep.id && pendingReview.kind === 'episode' && (
                                <tr className="border-b border-elevated/10 bg-elevated/5">
                                  <td colSpan={5} className="px-3 py-3">
                                    <ReviewNoteForm
                                      action={pendingReview.action}
                                      note={pendingReview.note}
                                      saving={pendingReview.saving}
                                      onNoteChange={(val) => setPendingReview((p) => p && { ...p, note: val })}
                                      onConfirm={confirmReview}
                                      onCancel={() => setPendingReview(null)}
                                    />
                                  </td>
                                </tr>
                              )}

                              {historyOpen.has(ep.id) && (
                                <tr className="border-b border-elevated/10 bg-elevated/5">
                                  <td colSpan={5} className="px-3 py-2">
                                    {historyLoading.has(ep.id) ? (
                                      <div className="flex items-center gap-1.5 text-xs text-secondary py-1"><Spinner size="sm" /> Loading…</div>
                                    ) : !reviewHistory[ep.id] || reviewHistory[ep.id].length === 0 ? (
                                      <p className="text-xs text-muted italic py-1">No review history.</p>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        {reviewHistory[ep.id].map((h) => (
                                          <div key={h.id} className={`flex items-start gap-2 text-xs rounded px-2 py-1 ${h.action === 'rejected' ? 'bg-red-500/10' : h.action === 'resubmitted' ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
                                            <span className={`font-semibold capitalize shrink-0 ${h.action === 'rejected' ? 'text-red-400' : h.action === 'resubmitted' ? 'text-amber-400' : 'text-green-400'}`}>{h.action}</span>
                                            <span className="text-muted shrink-0">{new Date(h.reviewedAt).toLocaleString()}{h.reviewedByName && ` · ${h.reviewedByName}`}</span>
                                            {h.note && <span className="text-secondary italic">— {h.note}</span>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
