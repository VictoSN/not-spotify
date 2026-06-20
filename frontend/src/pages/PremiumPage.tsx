import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ArrowTopRightOnSquareIcon, CheckIcon, MinusIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'
import { billingService, type BillingPlan, type BillingSubscription } from '@/services/billingService'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

const COMPARISON: { label: string; free: boolean | 'partial'; freeNote?: string }[] = [
  { label: 'Ad-free music listening', free: false },
  { label: 'Download to listen offline', free: false },
  { label: 'Play songs in any order', free: false },
  { label: 'Shuffle toggle & repeat modes', free: false },
  { label: 'High audio quality', free: false },
  { label: 'Save playlists & liked songs', free: true },
  { label: 'Organize your listening queue', free: false },
]

const PREMIUM_PERKS = [
  'Ad-free, uninterrupted listening',
  'Play any song in any order — no forced shuffle',
  'Shuffle toggle and repeat modes (all / one)',
  'Download songs, albums & playlists as ZIP files',
  'Stripe-hosted secure checkout',
]

const FREE_PERKS = [
  'Listen to all music (shuffle only)',
  'Save playlists and albums to your library',
  'Like songs and follow artists',
  'Search and browse the full catalogue',
]

const PAYMENT_METHODS = ['Mastercard', 'American Express', 'UnionPay', 'Visa']

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
      <p className="mt-2 text-xs font-bold text-white/70">Secure checkout powered by Stripe</p>
    </div>
  )
}

function PlanCard({
  eyebrow,
  name,
  headerClass,
  price,
  priceSub,
  perks,
  footer,
  badge,
}: {
  eyebrow: string
  name: string
  headerClass: string
  price: string
  priceSub?: string
  perks: string[]
  footer: React.ReactNode
  badge?: string | null
}) {
  return (
    <section className="premium-plan-card flex flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-elevated/40">
      <div className={cn('flex items-start justify-between gap-2 px-5 py-4', headerClass)}>
        <div>
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-90">
            <SparklesIcon className="h-4 w-4" />
            {eyebrow}
          </span>
          <h3 className="mt-1 text-2xl font-black">{name}</h3>
        </div>
        {badge && (
          <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide">
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-2xl font-black text-primary">{price}</p>
        {priceSub && <p className="mt-1 text-xs font-semibold text-secondary">{priceSub}</p>}
        <ul className="mt-5 grid flex-1 gap-3 text-sm text-primary">
          {perks.map((perk) => (
            <li key={perk} className="flex gap-2">
              <CheckIcon className="h-5 w-5 shrink-0 text-accent" />
              {perk}
            </li>
          ))}
        </ul>
        <div className="mt-6">{footer}</div>
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
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plansFocused, setPlansFocused] = useState(false)

  useEffect(() => {
    billingService.getPlans().then(setPlans).catch(() => setPlans([]))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    billingService.getSubscription().then(setSubscription).catch(() => setSubscription(null))
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

  return (
    <div className="premium-page pb-12">
      {/* Hero */}
      <div className="premium-hero relative overflow-hidden px-6 py-14 text-center sm:py-20">
        <div className="premium-glow premium-glow-left" />
        <div className="premium-glow premium-glow-right" />
        <div className="relative mx-auto max-w-4xl">
          <p className="premium-reveal text-sm font-bold uppercase tracking-wider text-accent">not-spotify Premium</p>
          <h1
            className="premium-reveal mt-3 text-4xl font-black leading-tight text-white sm:text-6xl"
            style={{ animationDelay: '70ms' }}
          >
            Affordable plans for any situation
          </h1>
          <p
            className="premium-reveal mx-auto mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-white/80 sm:text-base"
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
              className="premium-cta rounded-full bg-white px-8 py-3 text-sm font-black text-black transition-all hover:scale-105 active:scale-95"
            >
              View all plans
            </button>
            {isPremium && (
              <button
                onClick={manageBilling}
                disabled={busyPlan === 'portal'}
                className="inline-flex items-center gap-2 rounded-full border border-white/35 px-8 py-3 text-sm font-bold text-white transition-all hover:scale-105 hover:border-white active:scale-95"
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface ring-1 ring-accent/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">🎉</span>
              <div>
                <p className="font-black text-primary text-sm sm:text-base">
                  5% off your first month — no strings attached.
                </p>
                <p className="text-xs text-secondary mt-0.5">
                  Enter code{' '}
                  <strong className="font-black text-accent tracking-wide">5OFF</strong>
                  {' '}at checkout. Valid on any plan. Expires August 1st.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={scrollToPlans}
              className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
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
              headerClass="bg-elevated text-primary"
              price="$0"
              priceSub="The current baseline account."
              perks={FREE_PERKS}
              footer={
                <div className="text-sm font-bold capitalize text-secondary">
                  {(user?.plan ?? 'free') === 'free' ? 'Your current plan' : 'Included'}
                </div>
              }
            />

            {plans.map((plan, i) => (
              <PlanCard
                key={plan.plan}
                eyebrow="Premium"
                name={plan.label}
                headerClass={cn(
                  'text-white',
                  i % 2 === 0 ? 'bg-gradient-to-br from-accent to-accent-dark' : 'bg-gradient-to-br from-accent-dark to-accent-dim',
                )}
                price={plan.displayPrice ?? 'Not configured'}
                priceSub={
                  plan.isConfigured
                    ? `${plan.interval === 'yearly' ? 'Billed yearly' : 'Billed monthly'} · secure via Stripe`
                    : (plan.missingConfiguration ?? 'Billing not configured')
                }
                badge={plan.maxMembers > 1 ? `Up to ${plan.maxMembers}` : plan.discountLabel}
                perks={
                  plan.maxMembers > 1
                    ? [`${plan.maxMembers} accounts under one bill`, 'Each member gets full Premium', ...PREMIUM_PERKS.slice(0, 3)]
                    : PREMIUM_PERKS
                }
                footer={
                  <Button
                    onClick={() => checkout(plan.plan)}
                    disabled={!plan.isConfigured || busyPlan === plan.plan}
                    className="w-full gap-2"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    {busyPlan === plan.plan ? 'Opening…' : 'Choose plan'}
                  </Button>
                }
              />
            ))}
          </div>
        </section>

        {/* Current subscription */}
        {isPremium && (
          <div className="mx-auto mt-10 max-w-5xl rounded-lg bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-primary">Your subscription</h2>
                <p className="mt-1 text-sm capitalize text-secondary">
                  {subscription?.status ?? user?.subscriptionStatus ?? 'Premium'}{' '}
                  {subscription?.interval ?? user?.subscriptionInterval ?? ''}
                </p>
              </div>
              <button
                onClick={manageBilling}
                disabled={busyPlan === 'portal'}
                className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-5 py-2.5 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95 disabled:opacity-50"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {busyPlan === 'portal' ? 'Opening…' : 'Manage billing'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mx-auto mt-6 max-w-5xl text-sm font-semibold text-red-400">{error}</p>}
      </div>
    </div>
  )
}
