import { useEffect, useState } from 'react'
import { ShieldCheckIcon, UserPlusIcon, NoSymbolIcon } from '@heroicons/react/24/outline'
import { adminService, type TeamMember } from '@/services/adminService'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { AdminTableSkeleton } from '@/components/common/AdminSkeleton'
import { useConfirm } from '@/hooks/useConfirm'
import { notify } from '@/utils/toast'
import { adminPageMediumClass } from './adminPageLayout'

export function AdminTeamPage() {
  const confirm = useConfirm()
  const user = useAuthStore((s) => s.user)
  const isMaster = !!user?.roles?.includes('Master')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    setLoading(true)
    try {
      setMembers(await adminService.getTeam())
    } catch {
      notify.error('Failed to load the team.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const errMsg = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

  const grant = async () => {
    const value = email.trim()
    if (!value) return
    setBusy(true)
    try {
      const { enqueued } = await adminService.grantAdmin(value)
      notify.success(enqueued
        ? 'Request submitted for a master admin to approve.'
        : `${value} is now an admin.`)
      setEmail('')
      await reload()
    } catch (err) {
      notify.error(errMsg(err, 'Could not grant admin.'))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (m: TeamMember) => {
    const ok = await confirm({
      title: `Revoke admin from ${m.name}?`,
      message: isMaster
        ? 'They will immediately lose admin access.'
        : 'This will be submitted for a master admin to approve.',
      confirmText: 'Revoke',
      danger: true,
    })
    if (!ok) return
    try {
      const { enqueued } = await adminService.revokeAdmin(m.id)
      notify.success(enqueued
        ? 'Revoke request submitted for approval.'
        : `Revoked admin from ${m.name}.`)
      await reload()
    } catch (err) {
      notify.error(errMsg(err, 'Could not revoke admin.'))
    }
  }

  return (
    <div className={adminPageMediumClass}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">Team &amp; roles</h1>
        <p className="mt-1 text-sm text-secondary">
          {isMaster
            ? 'Grant or revoke admin access. As a master admin your changes apply immediately.'
            : 'Request admin changes — a master admin approves them from Approvals.'}
        </p>
      </div>

      {/* Grant admin */}
      <div className="mb-6 rounded-lg border border-elevated/40 bg-surface p-4">
        <label className="mb-2 block text-sm font-semibold text-primary">Grant admin access</label>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && grant()}
            placeholder="user@example.com"
            className="min-w-0 flex-1 rounded-md border border-elevated/50 bg-elevated/30 px-3 py-2 text-sm text-primary placeholder:text-secondary focus:border-accent focus:outline-none"
          />
          <Button onClick={grant} disabled={busy || !email.trim()}>
            <UserPlusIcon className="h-4 w-4" />
            {isMaster ? 'Grant' : 'Request'}
          </Button>
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton rows={6} columns={5} />
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-elevated/40 bg-surface p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated">
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                  : <span className="text-sm font-bold text-secondary">{m.name.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-primary">{m.name}</span>
                  {m.isMaster && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                      <ShieldCheckIcon className="h-3 w-3" /> Master
                    </span>
                  )}
                  {m.isAdmin && !m.isMaster && (
                    <span className="rounded-full border border-elevated/60 bg-elevated/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary">
                      Admin
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-secondary">{m.email}</div>
              </div>
              {!m.isMaster && m.id !== user?.id && (
                <Button size="sm" variant="ghost" onClick={() => revoke(m)}>
                  <NoSymbolIcon className="h-4 w-4" />
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
