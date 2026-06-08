import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusCircleIcon, PencilSquareIcon, TrashIcon, CheckCircleIcon, XCircleIcon,
  PlayIcon, StopCircleIcon, ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { adminService } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ReviewNoteForm } from '@/components/admin/ReviewNoteForm'

type Tab = 'pending' | 'approved' | 'rejected' | 'all'

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function AdminTracksListPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [tracks, setTracks] = useState<Track[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  type PendingReview = { id: string; action: 'approve' | 'reject'; note: string; saving: boolean }
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)

  const reload = async (t: Tab = tab) => {
    setIsLoading(true)
    setError(null)
    setPlayingId(null)
    try {
      setTracks(
        t === 'pending'  ? await adminService.listPendingTracks() :
        t === 'approved' ? await adminService.listTracks('approved') :
        t === 'rejected' ? await adminService.listTracks('rejected') :
                           await adminService.listTracks()
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracks')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { reload() }, [tab])

  const handleDelete = async (track: Track) => {
    if (!confirm(`Delete "${track.title}"? This cannot be undone.`)) return
    setActingId(track.id)
    setError(null)
    try {
      await adminService.deleteTrack(track.id)
      setTracks((prev) => prev.filter((t) => t.id !== track.id))
      if (playingId === track.id) setPlayingId(null)
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? (err instanceof Error ? err.message : 'Delete failed'))
    } finally {
      setActingId(null)
    }
  }

  const startReview = (track: Track, action: 'approve' | 'reject') =>
    setPendingReview({ id: track.id, action, note: '', saving: false })

  const confirmReview = async () => {
    if (!pendingReview) return
    const { id, action, note } = pendingReview
    setPendingReview((p) => p && { ...p, saving: true })
    setActingId(id)
    try {
      if (action === 'approve') await adminService.approveTrack(id, note || undefined)
      else await adminService.rejectTrack(id, note || undefined)
      setTracks((prev) => prev.filter((t) => t.id !== id))
      if (playingId === id) setPlayingId(null)
      setPendingReview(null)
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? `${action === 'approve' ? 'Approval' : 'Rejection'} failed.`)
      setPendingReview((p) => p && { ...p, saving: false })
    } finally {
      setActingId(null)
    }
  }

  const togglePlay = (id: string) => setPlayingId((prev) => (prev === id ? null : id))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Tracks</h1>
          <p className="text-secondary text-sm mt-1">Manage catalogue tracks and review artist submissions.</p>
        </div>
        <Button onClick={() => navigate('/admin/tracks/new')}>
          <PlusCircleIcon className="w-5 h-5" />
          New track
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([
          ['pending',  'Pending'],
          ['approved', 'Approved'],
          ['rejected', 'Rejected'],
          ['all',      'All'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              tab === t ? 'bg-accent text-white' : 'bg-elevated text-secondary hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-surface rounded-lg overflow-hidden border border-elevated/40">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-secondary border-b border-elevated/40">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Artist</th>
                <th className="px-4 py-3">Album</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tracks.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-secondary">
                  {tab === 'pending' ? 'No tracks awaiting review.' : tab === 'approved' ? 'No approved tracks.' : tab === 'rejected' ? 'No rejected tracks.' : 'No tracks yet.'}
                </td></tr>
              )}
              {tracks.map((t) => (
                <React.Fragment key={t.id}>
                  <tr className="border-b border-elevated/20 hover:bg-elevated/30 transition-colors">
                    <td className="px-4 py-3 text-secondary text-sm">{t.trackNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-medium">{t.title}</span>
                        {t.explicit && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-elevated text-secondary font-mono">E</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary text-sm">{t.artist.name}</td>
                    <td className="px-4 py-3 text-secondary text-sm">{t.album.title}</td>
                    <td className="px-4 py-3 text-secondary text-sm">{fmtDuration(t.durationMs)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2 items-center flex-wrap justify-end">
                        {/* Audio controls — shown for both tabs */}
                        {t.audioUrl ? (
                          <>
                            <button
                              type="button"
                              onClick={() => togglePlay(t.id)}
                              title={playingId === t.id ? 'Close player' : 'Play audio'}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors"
                            >
                              {playingId === t.id
                                ? <><StopCircleIcon className="w-3.5 h-3.5" /> Stop</>
                                : <><PlayIcon className="w-3.5 h-3.5" /> Play</>
                              }
                            </button>
                            <a
                              href={t.audioUrl}
                              download
                              title="Download audio file"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors"
                            >
                              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                              Download
                            </a>
                          </>
                        ) : (
                          <span className="text-xs text-muted italic mr-1">No audio</span>
                        )}

                        {t.status === 'pending' ? (
                          <>
                            <Button size="sm" onClick={() => startReview(t, 'approve')} disabled={!!actingId}>
                              <CheckCircleIcon className="w-4 h-4" />
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => startReview(t, 'reject')} disabled={!!actingId}>
                              <XCircleIcon className="w-4 h-4" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/tracks/${t.id}/edit`)}>
                              <PencilSquareIcon className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(t)}
                              disabled={actingId === t.id}
                            >
                              {actingId === t.id ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline review note panel */}
                  {pendingReview?.id === t.id && (
                    <tr className="bg-elevated/5 border-b border-elevated/20">
                      <td colSpan={6} className="px-4 py-3">
                        <ReviewNoteForm
                          action={pendingReview.action}
                          note={pendingReview.note}
                          saving={pendingReview.saving}
                          onNoteChange={(v) => setPendingReview((p) => p && { ...p, note: v })}
                          onConfirm={confirmReview}
                          onCancel={() => setPendingReview(null)}
                        />
                      </td>
                    </tr>
                  )}

                  {/* Inline audio player row */}
                  {playingId === t.id && (
                    <tr className="bg-elevated/10 border-b border-elevated/20">
                      <td colSpan={6} className="px-4 py-2">
                        <audio
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          controls
                          autoPlay
                          src={t.audioUrl}
                          className="w-full h-9"
                          onEnded={() => setPlayingId(null)}
                        />
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
