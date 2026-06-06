import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserIcon,
  ArrowPathIcon,
  XCircleIcon,
  DocumentTextIcon,
  GiftIcon,
  LockClosedIcon,
  BellIcon,
  EyeIcon,
  ArrowRightOnRectangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { billingService, type BillingSubscription } from '@/services/billingService'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not set'
}

interface RowProps {
  icon: React.ElementType
  label: string
  sub?: string
  to?: string
  onClick?: () => void
  external?: boolean
  disabled?: boolean
}

function SettingRow({ icon: Icon, label, sub, to, onClick, external, disabled }: RowProps) {
  const inner = (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3.5 transition-colors',
        disabled ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-elevated/60',
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-secondary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">{label}</p>
        {sub && <p className="text-xs text-secondary">{sub}</p>}
      </div>
      {external ? (
        <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />
      ) : disabled ? (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Soon</span>
      ) : (
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-secondary" />
      )}
    </div>
  )

  if (to) return <Link to={to}>{inner}</Link>
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="block w-full text-left">
      {inner}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 px-1 text-xl font-bold text-primary">{title}</h2>
      <div className="divide-y divide-elevated/40 overflow-hidden rounded-lg bg-surface">{children}</div>
    </section>
  )
}

export function AccountSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    billingService.getSubscription().then(setSubscription).catch(() => setSubscription(null))
  }, [])

  const openPortal = async () => {
    setBusy(true)
    setError(null)
    try {
      const url = await billingService.createPortalSession()
      window.location.assign(url)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Billing portal is not available for this account yet.')
    } finally {
      setBusy(false)
    }
  }

  const cancelSubscription = async () => {
    if (!confirm('Cancel your Premium subscription? You will lose access to Premium features immediately.')) return
    setBusy(true)
    setError(null)
    try {
      await billingService.cancelSubscription()
      // Refresh the auth token so the user object reflects the new free plan.
      await useAuthStore.getState().refreshToken()
      setSubscription({ plan: 'free', status: 'canceled', interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Could not cancel subscription. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const signOutEverywhere = async () => {
    await logout()
    navigate('/login')
  }

  if (!user) return null

  const isPremium = (subscription?.plan ?? user.plan) === 'premium'
  const renews = subscription?.currentPeriodEnd ?? user.subscriptionCurrentPeriodEnd

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <ShieldCheckIcon className="h-8 w-8 text-accent" />
        <div>
          <h1 className="text-3xl font-bold text-primary">Account</h1>
          <p className="text-sm text-secondary">Manage your plan, profile and settings.</p>
        </div>
      </div>

      {/* Your plan */}
      <div
        className={cn(
          'rounded-xl p-5 sm:p-6',
          isPremium ? 'bg-gradient-to-br from-accent-dim to-surface' : 'bg-surface',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-secondary">Your plan</p>
            <div className="mt-1 flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-accent" />
              <h2 className="text-2xl font-black text-primary">not-spotify {isPremium ? 'Premium' : 'Free'}</h2>
            </div>
            <p className="mt-2 text-sm text-secondary">
              {isPremium ? (
                <>
                  Status{' '}
                  <span className="font-semibold capitalize text-primary">
                    {subscription?.status ?? user.subscriptionStatus ?? 'active'}
                  </span>
                  {renews ? <> · Renews {formatDate(renews)}</> : null}
                </>
              ) : (
                'You are on the free plan. Upgrade for unlimited, uninterrupted listening.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isPremium ? (
              <button
                onClick={openPortal}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-5 py-2.5 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95 disabled:opacity-50"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {busy ? 'Opening…' : 'Manage billing'}
              </button>
            ) : (
              <Link
                to="/premium"
                className="inline-flex items-center rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
              >
                Explore Premium
              </Link>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-red-400">{error}</p>}

      <Section title="Account">
        <SettingRow icon={UserIcon} label="Edit profile" sub="Name, email, country and photo" to="/profile?edit=1" />
        <SettingRow icon={ArrowPathIcon} label="Recover playlists" sub="Restore recently deleted playlists" disabled />
      </Section>

      <Section title="Subscription">
        <SettingRow icon={SparklesIcon} label="Available plans" sub="Compare Free and Premium" to="/premium" />
        {isPremium && (
          <SettingRow icon={CreditCardIcon} label="Manage your subscription" sub="Update payment method or billing details" onClick={openPortal} external />
        )}
        {isPremium && (
          <SettingRow
            icon={XCircleIcon}
            label="Cancel subscription"
            sub="Downgrade to Free immediately"
            onClick={cancelSubscription}
          />
        )}
      </Section>

      <Section title="Payment">
        <SettingRow icon={DocumentTextIcon} label="Payment history" disabled />
        <SettingRow icon={CreditCardIcon} label="Saved payment cards" disabled />
        <SettingRow icon={GiftIcon} label="Redeem" disabled />
      </Section>

      <Section title="Security and privacy">
        <SettingRow icon={LockClosedIcon} label="Change password" disabled />
        <SettingRow icon={BellIcon} label="Notification settings" disabled />
        <SettingRow icon={EyeIcon} label="Account privacy" disabled />
        <SettingRow icon={ArrowRightOnRectangleIcon} label="Sign out everywhere" sub="Log out of all devices" onClick={signOutEverywhere} />
        <SettingRow icon={TrashIcon} label="Close account" disabled />
      </Section>
    </div>
  )
}
