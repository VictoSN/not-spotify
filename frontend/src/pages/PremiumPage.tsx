import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ArrowTopRightOnSquareIcon, CheckIcon, MinusIcon } from '@heroicons/react/24/outline'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { Button } from '@/components/ui/Button'
import { billingService, type BillingPlan, type BillingSubscription } from '@/services/billingService'
import { planService, type PlanOverview } from '@/services/planService'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

const TIER_LABEL: Record<string, string> = {
  individual: 'Premium',
  duo: 'Premium Duo',
  family: 'Premium Family',
  student: 'Premium Student',
}

/** Human label for the plan the user is currently on, e.g. "Premium Family". */
function planTypeLabel(
  isPremium: boolean,
  overview: PlanOverview | null,
  subscription: BillingSubscription | null,
  fallbackInterval: 'monthly' | 'yearly' | null,
): string {
  if (!isPremium) return 'Free plan'
  const tier = overview?.tier ?? 'individual'
  if (overview?.isMember) return 'Premium (shared plan member)'
  const base = TIER_LABEL[tier] ?? 'Premium'
  if (tier === 'individual') {
    const interval = subscription?.interval ?? fallbackInterval
    return interval ? `${base} ${interval === 'yearly' ? 'Yearly' : 'Monthly'}` : base
  }
  return base
}

const COMPARISON: { label: string; free: boolean | 'partial'; freeNote?: string }[] = [
  { label: 'Ad-free music listening', free: false },
  { label: 'Download to listen offline', free: false },
  { label: 'Play songs in any order', free: false },
  { label: 'Shuffle toggle & repeat modes', free: false },
  { label: 'High audio quality', free: false },
  { label: 'Save playlists & liked songs', free: true },
  { label: 'Organize your listening queue', free: false },
]

const FREE_PERKS = [
  'Listen to all music (shuffle only)',
  'Save playlists and albums to your library',
  'Like songs and follow artists',
  'Search and browse the full catalogue',
]

const PAYMENT_METHODS = ['Mastercard', 'American Express', 'UnionPay', 'Visa']

const PLAN_TONES: Record<BillingPlan['plan'] | 'free', { title: string; button: string }> = {
  free: {
    title: 'premium-plan-title-free',
    button: 'premium-plan-button-free',
  },
  monthly: {
    title: 'premium-plan-title-monthly',
    button: 'premium-plan-button-monthly',
  },
  yearly: {
    title: 'premium-plan-title-yearly',
    button: 'premium-plan-button-yearly',
  },
  duo: {
    title: 'premium-plan-title-duo',
    button: 'premium-plan-button-duo',
  },
  family: {
    title: 'premium-plan-title-family',
    button: 'premium-plan-button-family',
  },
  student: {
    title: 'premium-plan-title-student',
    button: 'premium-plan-button-student',
  },
}

const PLAN_FINE_PRINT: Record<BillingPlan['plan'] | 'free', string> = {
  free: 'Start listening with ads and limited playback controls.',
  monthly: 'Terms apply.',
  yearly: 'Annual billing terms apply.',
  duo: 'For two people who reside at the same address. Terms apply.',
  family: 'For up to 6 family members residing at the same address. Terms apply.',
  student: 'Offer available only to students at an accredited higher education institution. Terms apply.',
}

const PLAN_DISPLAY_NAME: Record<BillingPlan['plan'], string> = {
  monthly: 'Individual',
  yearly: 'Individual Yearly',
  duo: 'Duo',
  family: 'Family',
  student: 'Student',
}

const PLAN_PERKS: Record<BillingPlan['plan'], string[]> = {
  monthly: ['1 Premium account', 'Ad-free music listening', 'Cancel anytime'],
  yearly: ['1 Premium account', 'Annual billing savings', 'Cancel anytime'],
  duo: ['2 Premium accounts', 'Ad-free music listening for two people', 'Cancel anytime'],
  family: [
    'Up to 6 Premium accounts',
    'Parental controls for the plan manager',
    'Ad-free music listening for the family',
    'Cancel anytime',
  ],
  student: ['1 verified Premium account', 'Discount for eligible students', 'Cancel anytime'],
}

function PaymentBadge({ method }: { method: string }) {
  if (method === 'Mastercard') {
    return (
      <span className="premium-payment-badge" aria-label="Mastercard accepted">
        <svg viewBox="0 0 48 30" aria-hidden="true" className="h-5 w-8">
          <circle cx="19" cy="15" r="11" fill="#eb001b" />
          <circle cx="29" cy="15" r="11" fill="#f79e1b" />
          <path
            d="M24 6.4A10.95 10.95 0 0 1 29 15a10.95 10.95 0 0 1-5 8.6A10.95 10.95 0 0 1 19 15a10.95 10.95 0 0 1 5-8.6Z"
            fill="#ff5f00"
          />
        </svg>
      </span>
    )
  }

  if (method === 'UnionPay') {
    return (
      <span className="premium-payment-badge gap-1" aria-label="UnionPay accepted">
        <span className="h-5 w-3 rounded-sm bg-[#0b4ea2]" />
        <span className="-ml-2 h-5 w-3 rounded-sm bg-[#0a8f46]" />
        <span className="-ml-2 h-5 w-3 rounded-sm bg-[#d71920]" />
        <span className="text-[10px] font-black text-[#19458f]">UnionPay</span>
      </span>
    )
  }

  if (method === 'American Express') {
    return (
      <span className="premium-payment-badge bg-[#2e77bc] text-white" aria-label="American Express accepted">
        <span className="text-[10px] font-black leading-none">AMEX</span>
      </span>
    )
  }

  return (
    <span className="premium-payment-badge" aria-label="Visa accepted">
      <span className="text-sm font-black italic tracking-tight text-[#1434cb]">VISA</span>
    </span>
  )
}

function PaymentLogos() {
  return (
    <div className="premium-payments" aria-label="Accepted payment methods">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {PAYMENT_METHODS.map((method) => (
          <PaymentBadge key={method} method={method} />
        ))}
      </div>
      <p className="premium-payment-note mt-2 text-xs font-bold">Secure checkout powered by Stripe</p>
    </div>
  )
}

function PlanCard({
  eyebrow,
  name,
  tone,
  price,
  priceSub,
  perks,
  footer,
  finePrint,
}: {
  eyebrow: string
  name: string
  tone: { title: string }
  price: string
  priceSub?: string
  perks: string[]
  footer: React.ReactNode
  finePrint: string
}) {
  return (
    <section className="premium-plan-card flex min-h-[20.5rem] flex-col rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="premium-plan-eyebrow flex items-center gap-1.5 text-sm font-bold leading-none">
          <SpotifyMark className="premium-plan-mark h-5 w-5" />
          {eyebrow}
        </span>
      </div>
      <h3 className={cn('mt-3 text-[1.75rem] font-black leading-none', tone.title)}>{name}</h3>
      <p className="premium-plan-price mt-2 text-[0.9375rem] font-black leading-tight">{price}</p>
      {priceSub && <p className="premium-plan-sub mt-1 text-[0.75rem] font-semibold leading-snug">{priceSub}</p>}
      <div className="premium-plan-divider mt-4 h-px" />
      <div className="flex flex-1 flex-col">
        <ul className="premium-plan-perks mt-4 list-disc space-y-1.5 pl-4 text-[0.9375rem] font-bold leading-[1.18]">
          {perks.map((perk) => <li key={perk}>{perk}</li>)}
        </ul>
        <div className="mt-auto pt-7">{footer}</div>
        <p className="premium-plan-fine-print mx-auto mt-6 max-w-[14.5rem] text-center text-[0.6875rem] font-normal leading-tight">
          {finePrint}
        </p>
      </div>
    </section>
  )
}

export function PremiumPage() {
  useDocumentTitle('Premium')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated } = useAuthStore()
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [planOverview, setPlanOverview] = useState<PlanOverview | null>(null)
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plansFocused, setPlansFocused] = useState(false)

  useEffect(() => {
    billingService.getPlans().then(setPlans).catch(() => setPlans([]))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    billingService.getSubscription().then(setSubscription).catch(() => setSubscription(null))
    planService.getOverview().then(setPlanOverview).catch(() => setPlanOverview(null))
  }, [isAuthenticated])

  const checkout = async (plan: BillingPlan['plan']) => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    setBusyPlan(plan)
    setError(null)
    try {
      const url = await billingService.createCheckoutSession(plan)
      window.location.assign(url)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Could not start checkout.')
    } finally {
      setBusyPlan(null)
    }
  }

  const manageBilling = async () => {
    setBusyPlan('portal')
    setError(null)
    try {
      const url = await billingService.createPortalSession()
      window.location.assign(url)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Billing portal is not available for this account yet.')
    } finally {
      setBusyPlan(null)
    }
  }

  const scrollToPlans = () => {
    document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setPlansFocused(true)
    window.setTimeout(() => setPlansFocused(false), 900)
  }

  const status = searchParams.get('checkout')
  const hasMissingBillingConfig = plans.some((plan) => !plan.isConfigured)
  const isPremium = subscription?.plan === 'premium' || user?.plan === 'premium'
  const currentPlanDetails = isPremium
    ? [
        subscription?.status && subscription.status.toLowerCase() !== 'active' ? subscription.status : null,
        planOverview && planOverview.isOwner && planOverview.maxMembers > 1
          ? `${planOverview.seatsUsed}/${planOverview.seatsTotal} seats used`
          : planOverview?.isMember && planOverview.planOwner
            ? `shared by ${planOverview.planOwner.name}`
            : null,
        subscription?.cancelAtPeriodEnd ? 'cancels at period end' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Ad-supported, shuffle-only, ~128 kbps audio.'

  return (
    <div className="premium-page pb-12">
      {/* Hero */}
      <div className="premium-hero relative overflow-hidden px-6 py-14 text-center sm:py-20">
        <div className="premium-glow premium-glow-left" />
        <div className="premium-glow premium-glow-right" />
        <div className="relative mx-auto max-w-4xl">
          <p className="premium-reveal text-sm font-bold uppercase tracking-wider text-accent">not-spotify Premium</p>
          <h1
            className="premium-hero-title premium-reveal mt-3 text-4xl font-black leading-tight sm:text-6xl"
            style={{ animationDelay: '70ms' }}
          >
            Affordable plans for any situation
          </h1>
          <p
            className="premium-hero-copy premium-reveal mx-auto mt-4 max-w-2xl text-sm font-semibold leading-relaxed sm:text-base"
            style={{ animationDelay: '140ms' }}
          >
            Choose a Premium plan and listen ad-free with more control on your phone, speaker, and other devices.
            Pay in various ways. Cancel anytime.
          </p>
          <div className="premium-reveal mt-8" style={{ animationDelay: '210ms' }}>
            <PaymentLogos />
          </div>
          <div className="premium-reveal mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: '280ms' }}>
            <button
              type="button"
              onClick={scrollToPlans}
              className="premium-cta premium-primary-cta rounded-full px-8 py-3 text-sm font-black transition-all hover:scale-105 active:scale-95"
            >
              View all plans
            </button>
            {isPremium && (
              <button
                onClick={manageBilling}
                disabled={busyPlan === 'portal'}
                className="premium-hero-secondary-cta inline-flex items-center gap-2 rounded-full border px-8 py-3 text-sm font-bold transition-all hover:scale-105 active:scale-95"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {busyPlan === 'portal' ? 'Opening…' : 'Manage billing'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6">
        {/* Notices */}
        {status === 'success' && (
          <div className="mx-auto mt-6 max-w-3xl rounded-lg border border-accent/40 bg-accent-dim/30 px-4 py-3 text-sm font-semibold text-primary">
            Checkout completed. Your subscription will update once Stripe confirms the webhook.
          </div>
        )}
        {status === 'cancelled' && (
          <div className="mx-auto mt-6 max-w-3xl rounded-lg border border-secondary/20 bg-surface px-4 py-3 text-sm font-semibold text-secondary">
            Checkout was cancelled.
          </div>
        )}
        {hasMissingBillingConfig && (
          <div className="mx-auto mt-6 max-w-3xl rounded-lg border border-secondary/20 bg-surface px-4 py-3 text-sm text-secondary">
            <span className="font-bold text-primary">Billing setup required.</span> Add the Stripe secret key plus the
            plan Price IDs (monthly, yearly, duo, family, student) in backend user-secrets to enable checkout. Plans
            without a configured Price ID stay disabled.
          </div>
        )}

        {/* Comparison */}
        <section className="premium-reveal mx-auto mt-14 max-w-2xl" style={{ animationDelay: '340ms' }}>
          <h2 className="text-center text-2xl font-black text-primary">Experience the difference</h2>
          <p className="mt-1 text-center text-sm text-secondary">Go Premium and enjoy full control of your listening.</p>
          <div className="mt-6 overflow-hidden rounded-lg bg-surface">
            <div className="grid grid-cols-[1fr_4rem_5rem] items-center gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-secondary">
              <span>What you'll get</span>
              <span className="text-center">Free</span>
              <span className="text-center text-accent">Premium</span>
            </div>
            {COMPARISON.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_4rem_5rem] items-center gap-3 border-t border-elevated/40 px-5 py-3 text-sm text-primary"
              >
                <span>{row.label}</span>
                <span className="flex justify-center">
                  {row.free === true ? <CheckIcon className="h-5 w-5 text-primary" /> : <MinusIcon className="h-5 w-5 text-muted" />}
                </span>
                <span className="flex justify-center">
                  <CheckIcon className="h-5 w-5 text-accent" />
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Promo banner */}
        <div className="premium-reveal mx-auto mt-10 max-w-5xl" style={{ animationDelay: '410ms' }}>
          <div className="premium-promo-banner flex flex-wrap items-center justify-between gap-3 rounded-lg px-5 py-4 ring-1 ring-accent/40">
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">🎉</span>
              <div>
                <p className="premium-promo-title text-sm font-black sm:text-base">
                  5% off your first month — no strings attached.
                </p>
                <p className="premium-promo-copy mt-0.5 text-xs">
                  Enter code{' '}
                  <strong className="font-black text-accent tracking-wide">5OFF</strong>
                  {' '}at checkout. Valid on any plan. Expires August 1st.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={scrollToPlans}
              className="premium-promo-button shrink-0 rounded-full px-5 py-2 text-sm font-black transition-all hover:scale-105 active:scale-95"
            >
              Claim offer
            </button>
          </div>
        </div>

        {/* Plans */}
        <section
          id="plans"
          className={cn('premium-reveal mx-auto mt-10 max-w-5xl scroll-mt-6', plansFocused && 'premium-plans-focus')}
          style={{ animationDelay: '480ms' }}
        >
          <h2 className="text-center text-2xl font-black text-primary">Pick the plan that fits you</h2>
          <p className="mt-1 text-center text-sm text-secondary">Choose a plan and listen ad-free. Cancel anytime.</p>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            <PlanCard
              eyebrow="Free plan"
              name="Free"
              tone={PLAN_TONES.free}
              price="$0"
              priceSub="The current baseline account."
              perks={FREE_PERKS}
              finePrint={PLAN_FINE_PRINT.free}
              footer={
                <div className="premium-plan-sub text-sm font-bold capitalize">
                  {(user?.plan ?? 'free') === 'free' ? 'Your current plan' : 'Included'}
                </div>
              }
            />

            {plans.map((plan) => {
              const tone = PLAN_TONES[plan.plan]
              return (
                <PlanCard
                  key={plan.plan}
                  eyebrow="Premium"
                  name={PLAN_DISPLAY_NAME[plan.plan]}
                  tone={tone}
                  price={plan.displayPrice ?? 'Not configured'}
                  priceSub={plan.isConfigured ? undefined : (plan.missingConfiguration ?? 'Billing not configured')}
                  finePrint={PLAN_FINE_PRINT[plan.plan]}
                  perks={PLAN_PERKS[plan.plan]}
                  footer={
                    <Button
                      onClick={() => checkout(plan.plan)}
                      disabled={!plan.isConfigured || busyPlan === plan.plan}
                      className={cn('w-full gap-2 text-sm font-black', tone.button)}
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      {busyPlan === plan.plan ? 'Opening…' : `Get Premium ${PLAN_DISPLAY_NAME[plan.plan]}`}
                    </Button>
                  }
                />
              )
            })}
          </div>
        </section>

        {/* Current plan — always shown so the user can see what they're on */}
        {isAuthenticated && (
          <div className="mx-auto mt-10 max-w-5xl rounded-lg bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-secondary">Your plan</span>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-primary">
                    {planTypeLabel(isPremium, planOverview, subscription, user?.subscriptionInterval ?? null)}
                  </h2>
                  {isPremium && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent">
                      Active
                    </span>
                  )}
                </div>
                {currentPlanDetails && (
                  <p className="mt-1 text-sm capitalize text-secondary">
                    {currentPlanDetails}
                  </p>
                )}
              </div>
              {isPremium ? (
                <button
                  onClick={manageBilling}
                  disabled={busyPlan === 'portal'}
                  className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-5 py-2.5 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95 disabled:opacity-50"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  {busyPlan === 'portal' ? 'Opening…' : 'Manage billing'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={scrollToPlans}
                  className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-black transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>
        )}

        {error && <p className="mx-auto mt-6 max-w-5xl text-sm font-semibold text-red-400">{error}</p>}
      </div>
    </div>
  )
}
