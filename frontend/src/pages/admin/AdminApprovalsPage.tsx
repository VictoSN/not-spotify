import { useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { adminService, type PendingAction } from '@/services/adminService'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { notify } from '@/utils/toast'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/15 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const ACTION_LABELS: Record<string, string> = {
  'grant-admin': 'Grant admin',
  'revoke-admin': 'Revoke admin',
}

export function AdminApprovalsPage() {
  const isMaster = !!useAuthStore((s) => s.user)?.roles?.includes('Master')
  const [filter, setFilter] = useState<Filter>('pending')
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  // Race-safe reload — see AdminTracksListPage for the rationale.
  const requestIdRef = useRef(0)
  const reload = async (f: Filter = filter) => {
    const myId = ++requestIdRef.current
    setLoading(true)
    try {
      const data = await adminService.getApprovals(f === 'all' ? undefined : f)
      if (myId !== requestIdRef.current) return
      setActions(data)
    } catch {
      if (myId !== requestIdRef.current) return
      notify.error('Failed to load approvals.')
    } finally {
      if (myId === requestIdRef.current) setLoading(false)
    }
  }

  useEffect(() => { reload(filter) }, [filter])

  const review = async (a: PendingAction, action: 'approve' | 'reject') => {
    setActingId(a.id)
    try {
      const updated = action === 'approve'
        ? await adminService.approveAction(a.id)
        : await adminService.rejectAction(a.id)
      setActions((prev) => prev.map((x) => (x.id === a.id ? updated : x)))
      notify.success(action === 'approve' ? 'Approved.' : 'Rejected.')
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notify.error(msg ?? `${action === 'approve' ? 'Approval' : 'Rejection'} failed.`)
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">Approvals</h1>
        <p className="mt-1 text-sm text-secondary">
          {isMaster
            ? 'Privileged actions requested by admins, awaiting your decision.'
            : 'Your submitted requests and their status.'}
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
              filter === f ? 'bg-accent text-black' : 'bg-elevated text-secondary hover:text-primary'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : actions.length === 0 ? (
        <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">
          No {filter === 'all' ? '' : filter} requests.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {actions.map((a) => (
            <div key={a.id} className="rounded-lg border border-elevated/40 bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-primary">{ACTION_LABELS[a.actionType] ?? a.actionType}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[a.status]}`}>
                      {a.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-secondary">
                    Target: <span className="text-primary">{a.targetEmail}</span>
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    Requested by {a.requestedByName} ·{' '}
                    {new Date(a.requestedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    {a.reviewedByName && ` · Reviewed by ${a.reviewedByName}`}
                  </p>
                  {a.reviewNote && <p className="mt-1 text-xs italic text-secondary">Note: {a.reviewNote}</p>}
                </div>

                {isMaster && a.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => review(a, 'approve')} disabled={!!actingId}>
                      <CheckCircleIcon className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => review(a, 'reject')} disabled={!!actingId}>
                      <XCircleIcon className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
