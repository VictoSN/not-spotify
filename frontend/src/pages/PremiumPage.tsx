import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowTopRightOnSquareIcon, CheckIcon, MinusIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'
import { billingService, type BillingPlan, type BillingSubscription } from '@/services/billingService'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

const COMPARISON: { label: string; free: boolean }[] = [
  { label: 'Ad-free music listening', free: false },
  { label: 'Download to listen offline', free: false },
  { label: 'Play songs in any order', free: true },
  { label: 'High audio quality', free: false },
  { label: 'Listen with friends in real time', free: false },
  { label: 'Organize your listening queue', free: true },
]

const PREMIUM_PERKS = [
  'Ad-free, uninterrupted listening',
  'Unlimited skips and any-order play',
  'Stripe-hosted secure checkout',
  'Manage everything from the billing portal',
]

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
    <section className="flex flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-elevated/40">
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated } = useAuthStore()
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [busyInterval, setBusyInterval] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    billingService.getPlans().then(setPlans).catch(() => setPlans([]))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    billingService.getSubscription().then(setSubscription).catch(() => setSubscription(null))
  }, [isAuthenticated])

  const checkout = async (interval: BillingPlan['interval']) => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    setBusyInterval(interval)
    setError(null)
    try {
      const url = await billingService.createCheckoutSession(interval)
      window.location.assign(url)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Could not start checkout.')
    } finally {
      setBusyInterval(null)
    }
  }

  const manageBilling = async () => {
    setBusyInterval('portal')
    setError(null)
    try {
      const url = await billingService.createPortalSession()
      window.location.assign(url)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Billing portal is not available for this account yet.')
    } finally {
      setBusyInterval(null)
    }
  }

  const status = searchParams.get('checkout')
  const hasMissingBillingConfig = plans.some((plan) => !plan.isConfigured)
  const isPremium = subscription?.plan === 'premium' || user?.plan === 'premium'

  return (
    <div className="pb-12">
      {/* Hero */}
      <div className="bg-gradient-to-b from-accent-dim to-page px-6 py-14 text-center sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wider text-accent">not-spotify Premium</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-primary sm:text-5xl">
            Get more out of your music with Premium.
          </h1>
          <p className="mt-4 text-secondary">Enjoy ad-free, uninterrupted listening. Cancel anytime.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a
              href="#plans"
              className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-white transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
            >
              View all plans
            </a>
            {isPremium && (
              <button
                onClick={manageBilling}
                disabled={busyInterval === 'portal'}
                className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-8 py-3 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {busyInterval === 'portal' ? 'Opening…' : 'Manage billing'}
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
            <span className="font-bold text-primary">Billing setup required.</span> Add the Stripe secret key plus
            monthly and yearly Price IDs in backend user-secrets to enable checkout.
          </div>
        )}

        {/* Comparison */}
        <section className="mx-auto mt-14 max-w-2xl">
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
                  {row.free ? <CheckIcon className="h-5 w-5 text-primary" /> : <MinusIcon className="h-5 w-5 text-muted" />}
                </span>
                <span className="flex justify-center">
                  <CheckIcon className="h-5 w-5 text-accent" />
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="mx-auto mt-14 max-w-5xl scroll-mt-6">
          <h2 className="text-center text-2xl font-black text-primary">Affordable plans for any situation</h2>
          <p className="mt-1 text-center text-sm text-secondary">Choose a plan and listen ad-free. Cancel anytime.</p>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            <PlanCard
              eyebrow="Free plan"
              name="Free"
              headerClass="bg-elevated text-primary"
              price="$0"
              priceSub="The current baseline account."
              perks={['Listen with a free account', 'Save playlists to your library', 'Personal history and searches']}
              footer={
                <div className="text-sm font-bold capitalize text-secondary">
                  {(user?.plan ?? 'free') === 'free' ? 'Your current plan' : 'Included'}
                </div>
              }
            />

            {plans.map((plan, i) => (
              <PlanCard
                key={plan.interval}
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
                badge={plan.discountLabel}
                perks={PREMIUM_PERKS}
                footer={
                  <Button
                    onClick={() => checkout(plan.interval)}
                    disabled={!plan.isConfigured || busyInterval === plan.interval}
                    className="w-full gap-2"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    {busyInterval === plan.interval ? 'Opening…' : 'Choose plan'}
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
                disabled={busyInterval === 'portal'}
                className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-5 py-2.5 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95 disabled:opacity-50"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {busyInterval === 'portal' ? 'Opening…' : 'Manage billing'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mx-auto mt-6 max-w-5xl text-sm font-semibold text-red-400">{error}</p>}
      </div>
    </div>
  )
}
