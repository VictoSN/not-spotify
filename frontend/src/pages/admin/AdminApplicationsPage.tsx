import { useEffect, useState } from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { adminService, type ArtistApplication } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ReviewNoteForm } from '@/components/admin/ReviewNoteForm'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/15  text-green-400  border-green-500/30',
  rejected: 'bg-red-500/15    text-red-400    border-red-500/30',
}

export function AdminApplicationsPage() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [apps, setApps] = useState<ArtistApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  type PendingReview = { id: string; action: 'approve' | 'reject'; note: string; saving: boolean }
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)

  const reload = async (f: Filter = filter) => {
    setIsLoading(true)
    setError(null)
    try {
      setApps(await adminService.listApplications(f === 'all' ? undefined : f))
    } catch {
      setError('Failed to load applications.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { reload() }, [filter])

  const startReview = (app: ArtistApplication, action: 'approve' | 'reject') =>
    setPendingReview({ id: app.id, action, note: '', saving: false })

  const confirmReview = async () => {
    if (!pendingReview) return
    const { id, action, note } = pendingReview
    setPendingReview((p) => p && { ...p, saving: true })
    setActingId(id)
    try {
      const updated = action === 'approve'
        ? await adminService.approveApplication(id, note || undefined)
        : await adminService.rejectApplication(id, note || undefined)
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)))
      setPendingReview(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? `${action === 'approve' ? 'Approval' : 'Rejection'} failed.`)
      setPendingReview((p) => p && { ...p, saving: false })
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">Artist Applications</h1>
        <p className="text-secondary text-sm mt-1">Review requests from users who want to publish music.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors ${
              filter === f
                ? 'bg-accent text-black'
                : 'bg-elevated text-secondary hover:text-primary'
            }`}
          >
            {f}
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
      ) : apps.length === 0 ? (
        <div className="bg-surface rounded-lg border border-elevated/40 px-6 py-12 text-center text-secondary">
          No {filter === 'all' ? '' : filter} applications.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {apps.map((app) => (
            <div key={app.id} className="bg-surface border border-elevated/40 rounded-lg overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-bold text-primary">{app.displayName}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[app.status]}`}>
                      {app.status}
                    </span>
                  </div>
                  <p className="text-sm text-secondary mt-0.5">
                    {app.userName} · {app.userEmail}
                  </p>
                  {app.bio && (
                    <p className="text-sm text-primary mt-2 line-clamp-3">{app.bio}</p>
                  )}
                  {app.sampleWorkUrl && (
                    <a
                      href={app.sampleWorkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline mt-1 inline-block"
                    >
                      Sample work ↗
                    </a>
                  )}
                  <p className="text-xs text-muted mt-2">
                    Submitted {new Date(app.submittedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    {app.reviewedAt && ` · Reviewed ${new Date(app.reviewedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
                  </p>
                  {app.reviewNote && (
                    <p className="text-xs text-secondary mt-1 italic">Note: {app.reviewNote}</p>
                  )}
                </div>

                {app.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => startReview(app, 'approve')} disabled={!!actingId}>
                      <CheckCircleIcon className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => startReview(app, 'reject')} disabled={!!actingId}>
                      <XCircleIcon className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>

              {/* Inline review note form */}
              {pendingReview?.id === app.id && (
                <div className="px-5 pb-5 border-t border-elevated/20 pt-4 bg-elevated/5">
                  <ReviewNoteForm
                    action={pendingReview.action}
                    note={pendingReview.note}
                    saving={pendingReview.saving}
                    onNoteChange={(v) => setPendingReview((p) => p && { ...p, note: v })}
                    onConfirm={confirmReview}
                    onCancel={() => setPendingReview(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
