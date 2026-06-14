import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfirm } from '@/hooks/useConfirm'
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
  MusicalNoteIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { billingService, type BillingSubscription } from '@/services/billingService'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/services/api'
import { cn } from '@/utils/cn'

interface ArtistApplication {
  id: string
  displayName: string
  bio: string
  sampleWorkUrl: string | null
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
  reviewNote: string | null
}

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
  const confirm = useConfirm()
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Artist application state
  const [artistApp, setArtistApp] = useState<ArtistApplication | null | undefined>(undefined)
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [applyName, setApplyName] = useState(user?.name ?? '')
  const [applyBio, setApplyBio] = useState('')
  const [applySample, setApplySample] = useState('')
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const isArtist = user?.roles?.includes('Artist')

  useEffect(() => {
    billingService.getSubscription().then(setSubscription).catch(() => setSubscription(null))
    api.get<ArtistApplication>('/me/artist-application')
      .then((r) => setArtistApp(r.data))
      .catch(() => setArtistApp(null))
  }, [])

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    setApplyBusy(true)
    setApplyError(null)
    try {
      const res = await api.post<ArtistApplication>('/me/artist-application', {
        displayName: applyName,
        bio: applyBio,
        sampleWorkUrl: applySample || null,
      })
      setArtistApp(res.data)
      setShowApplyForm(false)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setApplyError(msg ?? 'Failed to submit application.')
    } finally {
      setApplyBusy(false)
    }
  }

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
    if (!(await confirm({
      title: 'Cancel Premium?',
      message: 'You will lose access to Premium features immediately.',
      confirmText: 'Cancel subscription',
      danger: true,
    }))) return
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

      {/* Artist section */}
      <Section title="Artist">
        {isArtist ? (
          <SettingRow
            icon={CheckCircleIcon}
            label="Artist Dashboard"
            sub="Manage and submit your tracks"
            to="/artist-dashboard"
          />
        ) : artistApp === undefined ? (
          <div className="px-4 py-3.5 flex items-center gap-4">
            <MusicalNoteIcon className="h-5 w-5 shrink-0 text-secondary" />
            <p className="text-sm text-secondary">Loading…</p>
          </div>
        ) : artistApp === null ? (
          <>
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-4">
                <MusicalNoteIcon className="h-5 w-5 shrink-0 text-secondary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">Become an artist</p>
                  <p className="text-xs text-secondary">Apply to publish your music on not-spotify</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApplyForm((v) => !v)}
                  className="text-xs font-semibold text-accent hover:text-accent-dark transition-colors"
                >
                  {showApplyForm ? 'Cancel' : 'Apply'}
                </button>
              </div>
              {showApplyForm && (
                <form onSubmit={handleApply} className="mt-4 flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-primary mb-1">Artist name</label>
                    <input
                      required
                      value={applyName}
                      onChange={(e) => setApplyName(e.target.value)}
                      className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-3 py-2 text-sm focus:outline-none"
                      placeholder="Your artist name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-primary mb-1">Bio (optional)</label>
                    <textarea
                      value={applyBio}
                      onChange={(e) => setApplyBio(e.target.value)}
                      rows={3}
                      className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-3 py-2 text-sm focus:outline-none resize-none"
                      placeholder="Tell us about your music…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-primary mb-1">Sample work URL (optional)</label>
                    <input
                      type="url"
                      value={applySample}
                      onChange={(e) => setApplySample(e.target.value)}
                      className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-3 py-2 text-sm focus:outline-none"
                      placeholder="https://soundcloud.com/…"
                    />
                  </div>
                  {applyError && <p className="text-xs text-red-400">{applyError}</p>}
                  <button
                    type="submit"
                    disabled={applyBusy}
                    className="self-start px-5 py-2 rounded-full bg-accent text-white text-sm font-bold hover:bg-accent-dark transition-colors disabled:opacity-50"
                  >
                    {applyBusy ? 'Submitting…' : 'Submit application'}
                  </button>
                </form>
              )}
            </div>
          </>
        ) : artistApp.status === 'pending' ? (
          <div className="px-4 py-3.5 flex items-center gap-4">
            <ClockIcon className="h-5 w-5 shrink-0 text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-primary">Application pending review</p>
              <p className="text-xs text-secondary">
                Submitted as &ldquo;{artistApp.displayName}&rdquo; · Admins will review it shortly
              </p>
            </div>
          </div>
        ) : artistApp.status === 'rejected' ? (
          <div className="px-4 py-3.5 flex items-center gap-4">
            <XCircleIcon className="h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-medium text-primary">Application rejected</p>
              {artistApp.reviewNote && (
                <p className="text-xs text-secondary mt-0.5">Reason: {artistApp.reviewNote}</p>
              )}
              <button
                type="button"
                onClick={() => { setArtistApp(null); setShowApplyForm(true) }}
                className="text-xs font-semibold text-accent hover:text-accent-dark transition-colors mt-1 block"
              >
                Apply again
              </button>
            </div>
          </div>
        ) : null}
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
