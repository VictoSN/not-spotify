import { useEffect, useState } from 'react'
import { UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { planService, type PlanOverview } from '@/services/planService'
import { useAuthStore } from '@/stores/authStore'
import { useConfirm } from '@/hooks/useConfirm'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { notify } from '@/utils/toast'

/**
 * Manage Duo/Family plan seats and respond to plan invites. Renders nothing when
 * the user has no seats to manage and no pending invites, so it stays out of the
 * way for Free and individual-Premium accounts. After any change that affects the
 * caller's own plan it refreshes the auth token so capabilities update live.
 */
export function PlanMembersCard() {
  const [overview, setOverview] = useState<PlanOverview | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  useEffect(() => {
    planService.getOverview().then(setOverview).catch(() => setOverview(null))
  }, [])

  if (!overview) return null

  const { isOwner, isMember, members, incomingInvites, seatsUsed, seatsTotal, planOwner, mySeatId } = overview
  // Nothing to show for a plain individual-Premium or Free account.
  if (!isOwner && !isMember && incomingInvites.length === 0) return null

  const refreshAuth = () => useAuthStore.getState().refreshToken().catch(() => {})
  const errMsg = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setBusy(true)
    setError(null)
    try {
      setOverview(await planService.invite(value))
      setEmail('')
      notify.success('Invite sent.')
    } catch (err) {
      setError(errMsg(err, 'Could not send the invite.'))
    } finally {
      setBusy(false)
    }
  }

  const accept = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      setOverview(await planService.acceptInvite(id))
      await refreshAuth()
      notify.success('You joined the Premium plan.')
    } catch (err) {
      setError(errMsg(err, 'Could not accept the invite.'))
    } finally {
      setBusy(false)
    }
  }

  const decline = async (id: string) => {
    setBusy(true)
    try {
      await planService.declineInvite(id)
      setOverview(await planService.getOverview())
    } catch (err) {
      setError(errMsg(err, 'Could not decline the invite.'))
    } finally {
      setBusy(false)
    }
  }

  // Owner removing a seat, or a member leaving their own seat — same endpoint.
  const removeSeat = async (id: string, leaving: boolean) => {
    const ok = await confirm({
      title: leaving ? 'Leave this plan?' : 'Remove member?',
      message: leaving
        ? 'You will lose Premium access immediately.'
        : 'This person will lose Premium access immediately.',
      confirmText: leaving ? 'Leave plan' : 'Remove',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await planService.removeMember(id)
      if (leaving) await refreshAuth()
      setOverview(await planService.getOverview())
    } catch (err) {
      setError(errMsg(err, 'Could not update the plan.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg bg-surface">
      {/* Incoming invites — anyone can have these */}
      {incomingInvites.map((inv) => (
        <div key={inv.id} className="flex items-center gap-3 border-b border-elevated/40 px-4 py-3.5">
          <Avatar src={inv.owner.imageUrl} alt={inv.owner.name} size="sm" round />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary">{inv.owner.name} invited you to Premium</p>
            <p className="text-xs capitalize text-secondary">{inv.tier} plan · free for you</p>
          </div>
          <Button onClick={() => accept(inv.id)} disabled={busy} className="px-3 py-1.5 text-xs">Join</Button>
          <button
            type="button"
            onClick={() => decline(inv.id)}
            disabled={busy}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-secondary transition-colors hover:text-primary"
          >
            Decline
          </button>
        </div>
      ))}

      {/* Member view: you're on someone else's plan */}
      {isMember && planOwner && mySeatId && (
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Avatar src={planOwner.imageUrl} alt={planOwner.name} size="sm" round />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary">Premium shared by {planOwner.name}</p>
            <p className="text-xs text-secondary">You get full Premium through their plan.</p>
          </div>
          <button
            type="button"
            onClick={() => removeSeat(mySeatId, true)}
            disabled={busy}
            className="rounded-full border border-secondary/50 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:border-primary"
          >
            Leave
          </button>
        </div>
      )}

      {/* Owner view: manage seats */}
      {isOwner && (
        <>
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-secondary">
            <span>Plan members</span>
            <span>{seatsUsed} / {seatsTotal} seats</span>
          </div>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border-t border-elevated/40 px-4 py-3.5">
              {m.member
                ? <Avatar src={m.member.imageUrl} alt={m.member.name} size="sm" round />
                : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elevated text-secondary"><UserPlusIcon className="h-4 w-4" /></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-primary">{m.member?.name ?? m.email}</p>
                <p className="text-xs capitalize text-secondary">{m.status === 'active' ? 'Member' : 'Invite pending'}</p>
              </div>
              <button
                type="button"
                onClick={() => removeSeat(m.id, false)}
                disabled={busy}
                aria-label="Remove member"
                className="rounded-full p-1.5 text-secondary transition-colors hover:text-red-400"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}

          {seatsUsed < seatsTotal && (
            <form onSubmit={invite} className="flex items-center gap-2 border-t border-elevated/40 px-4 py-3.5">
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Invite by email…"
                className="h-9 flex-1 rounded-full border border-transparent bg-elevated px-4 text-sm font-semibold text-primary placeholder:text-secondary focus:border-primary focus:outline-none"
              />
              <Button type="submit" disabled={busy || !email.trim()} className="gap-1.5 px-4 py-1.5 text-xs">
                <UserPlusIcon className="h-4 w-4" /> Invite
              </Button>
            </form>
          )}
        </>
      )}

      {error && <p className="px-4 py-2 text-xs font-semibold text-red-400">{error}</p>}
    </div>
  )
}
