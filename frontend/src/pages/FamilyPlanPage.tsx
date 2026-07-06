import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckIcon, ShieldCheckIcon, UsersIcon } from '@heroicons/react/24/outline'
import { PlanMembersCard } from '@/components/settings/PlanMembersCard'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { billingService, type BillingPlan, type BillingSubscription } from '@/services/billingService'
import { planService, type PlanOverview } from '@/services/planService'
import { useAuthStore } from '@/stores/authStore'

const FAMILY_PERKS = [
  'Up to 6 separate Premium accounts',
  'Ad-free listening and offline downloads',
  'One bill for the whole family',
  'Invite or remove members whenever you need',
]

export function FamilyPlanPage() {
  useDocumentTitle('Set up your Family plan')
  const user = useAuthStore((state) => state.user)
  const [familyPlan, setFamilyPlan] = useState<BillingPlan | null>(null)
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [overview, setOverview] = useState<PlanOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      billingService.getPlans(),
      billingService.getSubscription(),
      planService.getOverview(),
    ])
      .then(([plans, currentSubscription, currentOverview]) => {
        if (cancelled) return
        setFamilyPlan(plans.find((plan) => plan.plan === 'family' || plan.tier === 'family') ?? null)
        setSubscription(currentSubscription)
        setOverview(currentOverview)
      })
      .catch(() => {
        if (!cancelled) setError('We could not load Family plan details. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const startFamilyPlan = async () => {
    setBusy(true)
    setError(null)
    try {
      const url = await billingService.createCheckoutSession(familyPlan?.plan ?? 'family')
      window.location.assign(url)
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(message ?? 'Could not start Family plan checkout.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-80 items-center justify-center"><Spinner size="lg" /></div>
  }

  const familyActive = subscription?.plan === 'premium' && subscription.tier === 'family'
  const isOwner = familyActive && overview?.isOwner
  const isFamilyMember = Boolean(overview?.isMember && overview.tier === 'family')
  const hasFamilyInvite = overview?.incomingInvites.some((invite) => invite.tier === 'family') ?? false
  const canShowMembers = Boolean(isOwner || isFamilyMember || hasFamilyInvite)
  const checkoutAvailable = familyPlan?.isConfigured ?? false

  return (
    <div className="pb-12">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-surface">
        <div className="relative overflow-hidden px-6 py-10 sm:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(30,215,96,0.25),transparent_38%),radial-gradient(circle_at_10%_100%,rgba(124,92,255,0.22),transparent_42%)]" />
          <div className="relative max-w-2xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-black">
              <UsersIcon className="h-7 w-7" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Premium Family</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-primary sm:text-5xl">
              Set up your Family plan
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-secondary">
              Give everyone their own Premium account while keeping one simple subscription.
            </p>
          </div>
        </div>

        <div className="grid gap-8 border-t border-white/10 px-6 py-8 sm:px-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <ul className="space-y-3">
              {FAMILY_PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-3 text-sm font-semibold text-primary">
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  {perk}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-secondary">Family members keep their own music, playlists, and recommendations.</p>
          </div>

          <div className="md:text-right">
            {familyPlan?.displayPrice && <p className="mb-3 text-sm font-bold text-secondary">{familyPlan.displayPrice}</p>}
            {familyActive || isFamilyMember ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-5 py-3 text-sm font-bold text-accent">
                <ShieldCheckIcon className="h-5 w-5" />
                Family plan active
              </div>
            ) : (
              <button
                type="button"
                onClick={startFamilyPlan}
                disabled={busy || !checkoutAvailable}
                className="rounded-full bg-accent px-6 py-3 text-sm font-black text-black transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {busy ? 'Opening checkout…' : 'Get Premium Family'}
              </button>
            )}
          </div>
        </div>
      </div>

      {!checkoutAvailable && !familyActive && !isFamilyMember && (
        <p className="mt-4 rounded-lg border border-white/10 bg-elevated px-4 py-3 text-sm text-secondary">
          Family checkout is not configured yet. You can still view <Link to="/premium" className="font-bold text-primary underline">all plans</Link>.
        </p>
      )}
      {error && <p className="mt-4 text-sm font-semibold text-red-400" role="alert">{error}</p>}

      {canShowMembers && (
        <section className="mt-8" aria-labelledby="family-members-heading">
          <h2 id="family-members-heading" className="mb-3 text-2xl font-black text-primary">
            {isOwner ? 'Manage your members' : 'Your Family plan'}
          </h2>
          <PlanMembersCard />
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-5 text-sm font-bold">
        <Link to="/account" className="text-primary underline underline-offset-4 hover:text-accent">Back to Account</Link>
        <Link to="/premium" className="text-primary underline underline-offset-4 hover:text-accent">See all Premium plans</Link>
        <Link to="/support?topic=premium-family" className="text-primary underline underline-offset-4 hover:text-accent">Family plan help</Link>
      </div>
      <p className="mt-8 text-xs text-muted">Signed in as {user?.email}. Opening this page does not end your listening session.</p>
    </div>
  )
}
