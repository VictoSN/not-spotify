import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useConfirm } from '@/hooks/useConfirm'
import { useDebounce } from '@/hooks/useDebounce'
import {
  PencilSquareIcon, TrashIcon, CheckCircleIcon, XCircleIcon, ClockIcon, PlayIcon, StopCircleIcon,
} from '@heroicons/react/24/outline'
import type { MusicVideo } from '@/types/musicVideo'
import { adminService, type ReviewHistoryEntry } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AdminTableSkeleton } from '@/components/common/AdminSkeleton'
import { SearchInput } from '@/components/common/SearchInput'
import { ReviewNoteForm } from '@/components/admin/ReviewNoteForm'

type Tab = 'pending' | 'approved' | 'rejected' | 'all'

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function AdminVideosListPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('pending')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 200)
  const [videos, setVideos] = useState<MusicVideo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  type PendingReview = { id: string; action: 'approve' | 'reject'; note: string; saving: boolean }
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [reviewHistory, setReviewHistory] = useState<Record<string, ReviewHistoryEntry[]>>({})
  const [historyOpen, setHistoryOpen] = useState<Set<string>>(new Set())
  const [historyLoading, setHistoryLoading] = useState<Set<string>>(new Set())

  // Race-safe reload — see AdminTracksListPage for the rationale.
  const requestIdRef = useRef(0)
  const reload = async (t: Tab = tab) => {
    const myId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)
    setPlayingId(null)
    try {
      const data = t === 'pending' ? await adminService.listPendingVideos() : await adminService.listVideos(t === 'all' ? undefined : t)
      if (myId !== requestIdRef.current) return
      setVideos(data)
    } catch (err) {
      if (myId !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load music videos')
    } finally {
      if (myId === requestIdRef.current) setIsLoading(false)
    }
  }

  useEffect(() => { reload(tab) }, [tab])

  const visibleVideos = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return videos
    return videos.filter((v) => v.title.toLowerCase().includes(q) || v.artist.name.toLowerCase().includes(q))
  }, [videos, debouncedQuery])

  const toggleHistory = async (id: string) => {
    const next = new Set(historyOpen)
    if (next.has(id)) { next.delete(id); setHistoryOpen(next); return }
    next.add(id); setHistoryOpen(next)
    if (reviewHistory[id] !== undefined) return
    setHistoryLoading((s) => new Set(s).add(id))
    try {
      const data = await adminService.getVideoReviewHistory(id)
      setReviewHistory((prev) => ({ ...prev, [id]: data }))
    } finally {
      setHistoryLoading((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  const startReview = (video: MusicVideo, action: 'approve' | 'reject') =>
    setPendingReview({ id: video.id, action, note: '', saving: false })

  const confirmReview = async () => {
    if (!pendingReview) return
    const { id, action, note } = pendingReview
    setPendingReview((p) => p && { ...p, saving: true })
    setActingId(id)
    try {
      if (action === 'approve') await adminService.approveVideo(id, note || undefined)
      else await adminService.rejectVideo(id, note || undefined)
      setVideos((prev) => prev.filter((v) => v.id !== id))
      setPendingReview(null)
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? `${action === 'approve' ? 'Approval' : 'Rejection'} failed.`)
      setPendingReview((p) => p && { ...p, saving: false })
    } finally {
      setActingId(null)
    }
  }

  const startEdit = (video: MusicVideo) => {
    setEditingId(video.id)
    setEditTitle(video.title)
    setEditDescription(video.description ?? '')
  }

  const saveEdit = async (video: MusicVideo) => {
    setSavingEdit(true)
    try {
      const updated = await adminService.updateVideo(video.id, { title: editTitle, description: editDescription })
      setVideos((prev) => prev.map((v) => (v.id === video.id ? updated : v)))
      setEditingId(null)
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? 'Failed to update video.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (video: MusicVideo) => {
    if (!(await confirm({
      title: `Delete "${video.title}"?`,
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    }))) return
    setActingId(video.id)
    setError(null)
    try {
      await adminService.deleteVideo(video.id)
      setVideos((prev) => prev.filter((v) => v.id !== video.id))
      if (playingId === video.id) setPlayingId(null)
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? (err instanceof Error ? err.message : 'Delete failed'))
    } finally {
      setActingId(null)
    }
  }

  const togglePlay = (id: string) => setPlayingId((prev) => (prev === id ? null : id))

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Music Videos</h1>
          <p className="text-secondary text-sm mt-1">Review artist-submitted music videos before they go live.</p>
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
        placeholder="Search by title or artist…"
        className="mb-4 max-w-md"
        ariaLabel="Search music videos"
      />

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={6} columns={5} />
      ) : (
        <div className="bg-surface rounded-lg border border-elevated/40 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-secondary border-b border-elevated/40">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Artist</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleVideos.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-secondary">
                  {debouncedQuery.trim()
                    ? 'No results found.'
                    : tab === 'pending' ? 'No videos awaiting review.' : tab === 'approved' ? 'No approved videos.' : tab === 'rejected' ? 'No rejected videos.' : 'No videos yet.'}
                </td></tr>
              )}
              {visibleVideos.map((v) => (
                <React.Fragment key={v.id}>
                  <tr className="border-b border-elevated/20 hover:bg-elevated/30 transition-colors">
                    <td className="px-4 py-3">
                      {editingId === v.id ? (
                        <div className="flex flex-col gap-2 max-w-sm">
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-3 py-1.5 text-sm focus:outline-none"
                            placeholder="Title"
                          />
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-3 py-1.5 text-sm focus:outline-none resize-none"
                            placeholder="Description"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(v)} disabled={savingEdit}>
                              {savingEdit ? <Spinner size="sm" /> : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={savingEdit}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-primary font-medium">{v.title}</span>
                          {v.reviewNote && (
                            <span className={`text-xs italic ${v.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>
                              {v.status === 'rejected' ? 'Rejection' : 'Review'} note: {v.reviewNote}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleHistory(v.id)}
                            className="inline-flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors w-fit"
                          >
                            <ClockIcon className="w-3.5 h-3.5" />
                            History
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary text-sm">{v.artist.name}</td>
                    <td className="px-4 py-3 text-secondary text-sm">{fmtDuration(v.durationMs)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2 items-center flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={() => togglePlay(v.id)}
                          title={playingId === v.id ? 'Close preview' : 'Preview video'}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors"
                        >
                          {playingId === v.id
                            ? <><StopCircleIcon className="w-3.5 h-3.5" /> Stop</>
                            : <><PlayIcon className="w-3.5 h-3.5" /> Preview</>
                          }
                        </button>

                        {v.status === 'pending' ? (
                          <>
                            <Button size="sm" onClick={() => startReview(v, 'approve')} disabled={!!actingId}>
                              <CheckCircleIcon className="w-4 h-4" />
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => startReview(v, 'reject')} disabled={!!actingId}>
                              <XCircleIcon className="w-4 h-4" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(v)}>
                            <PencilSquareIcon className="w-4 h-4" />
                            Edit
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(v)}
                          disabled={actingId === v.id}
                        >
                          {actingId === v.id ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {pendingReview?.id === v.id && (
                    <tr className="bg-elevated/5 border-b border-elevated/20">
                      <td colSpan={4} className="px-4 py-3">
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

                  {historyOpen.has(v.id) && (
                    <tr className="bg-elevated/5 border-b border-elevated/20">
                      <td colSpan={4} className="px-4 py-2">
                        {historyLoading.has(v.id) ? (
                          <div className="flex items-center gap-1.5 text-xs text-secondary">
                            <Spinner size="sm" /> Loading…
                          </div>
                        ) : !reviewHistory[v.id] || reviewHistory[v.id].length === 0 ? (
                          <p className="text-xs text-muted italic">No review history yet.</p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {reviewHistory[v.id].map((h) => (
                              <div key={h.id} className={`flex items-start gap-2 text-xs rounded px-2 py-1.5 ${h.action === 'rejected' ? 'bg-red-500/10' : h.action === 'resubmitted' ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
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

                  {playingId === v.id && (
                    <tr className="bg-elevated/10 border-b border-elevated/20">
                      <td colSpan={4} className="px-4 py-2">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video controls autoPlay src={v.videoUrl} className="w-full max-h-72" onEnded={() => setPlayingId(null)} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
