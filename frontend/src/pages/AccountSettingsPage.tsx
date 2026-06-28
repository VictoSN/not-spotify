import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { useConfirm } from '@/hooks/useConfirm'
import {
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
  CreditCardIcon,
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
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  UsersIcon,
  KeyIcon,
  MegaphoneIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'
import { billingService, type BillingSubscription } from '@/services/billingService'
import { meService } from '@/services/meService'
import { PlanMembersCard } from '@/components/settings/PlanMembersCard'
import { ChangePasswordModal } from '@/components/settings/ChangePasswordModal'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/services/api'
import { cn } from '@/utils/cn'
import { notify } from '@/utils/toast'
import type { AccountPreferences, DeletedPlaylist, LoginMethods } from '@/services/meService'

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
  disabledReason?: string
  expanded?: boolean
  controls?: string
}

function SettingRow({ icon: Icon, label, sub, to, onClick, external, disabled, disabledReason, expanded, controls }: RowProps) {
  const description = disabled && disabledReason ? disabledReason : sub
  const inner = (
    <div
      aria-disabled={disabled || undefined}
      title={disabledReason}
      className={cn(
        'flex items-center gap-4 px-4 transition-colors',
        'min-h-[60px] py-3',
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-primary/5',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface">
        <Icon className="h-[17px] w-[17px] text-secondary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-tight text-primary">{label}</p>
        {description && <p className="mt-0.5 truncate text-[12px] text-secondary">{description}</p>}
      </div>
      {external ? (
        <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />
      ) : (
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-secondary" />
      )}
    </div>
  )

  if (to && !disabled) return <Link to={to} className="block w-full">{inner}</Link>
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      aria-controls={controls}
      className="block w-full text-left"
    >
      {inner}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 overflow-hidden rounded-[4px] bg-elevated">
      <h2 className="px-4 pb-3 pt-5 text-[22px] font-bold text-primary">{title}</h2>
      <div className="divide-y divide-primary/10">{children}</div>
    </section>
  )
}

export function AccountSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showChangePw, setShowChangePw] = useState(false)
  const [showPlanMembers, setShowPlanMembers] = useState(false)

  // Artist application state
  const [artistApp, setArtistApp] = useState<ArtistApplication | null | undefined>(undefined)
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [applyName, setApplyName] = useState(user?.name ?? '')
  const [applyBio, setApplyBio] = useState('')
  const [applySample, setApplySample] = useState('')
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [panel, setPanel] = useState<'recover' | 'redeem' | 'apps' | 'ads' | 'delete' | null>(null)
  const [panelBusy, setPanelBusy] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)
  const [deletedPlaylists, setDeletedPlaylists] = useState<DeletedPlaylist[]>([])
  const [loginMethods, setLoginMethods] = useState<LoginMethods | null>(null)
  const [prefs, setPrefs] = useState<AccountPreferences | null>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const isArtist = user?.roles?.includes('Artist')

  useEffect(() => {
    billingService.getSubscription()
      .then(setSubscription)
      .catch(() => setSubscription(null))
      .finally(() => setSubscriptionLoaded(true))
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
      await useAuthStore.getState().refreshToken()
      setSubscription({ plan: 'free', tier: 'individual', status: 'canceled', interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
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

  const downloadData = async () => {
    if (downloadBusy) return
    setDownloadBusy(true)
    try {
      const data = await meService.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `not-spotify-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      notify.success('Your data export is downloading.')
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notify.error(msg ?? 'Could not download your data. Please try again.')
    } finally {
      setDownloadBusy(false)
    }
  }

  const errMsg = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string; errors?: string[] } } })?.response?.data?.errors?.join(' ')
      ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? fallback

  const openRecover = async () => {
    setPanel('recover')
    setPanelError(null)
    setPanelBusy(true)
    try {
      setDeletedPlaylists(await meService.getDeletedPlaylists())
    } catch (err) {
      setPanelError(errMsg(err, 'Could not load deleted playlists.'))
    } finally {
      setPanelBusy(false)
    }
  }

  const restorePlaylist = async (id: string) => {
    setPanelBusy(true)
    setPanelError(null)
    try {
      await meService.restoreDeletedPlaylist(id)
      setDeletedPlaylists((rows) => rows.filter((p) => p.id !== id))
      notify.success('Playlist restored.')
    } catch (err) {
      setPanelError(errMsg(err, 'Could not restore that playlist.'))
    } finally {
      setPanelBusy(false)
    }
  }

  const openLoginMethods = async () => {
    setPanel('apps')
    setPanelError(null)
    setPanelBusy(true)
    try {
      setLoginMethods(await meService.getLoginMethods())
    } catch (err) {
      setPanelError(errMsg(err, 'Could not load login methods.'))
    } finally {
      setPanelBusy(false)
    }
  }

  const openAdPreferences = async () => {
    setPanel('ads')
    setPanelError(null)
    setPanelBusy(true)
    try {
      setPrefs(await meService.getAccountPreferences())
    } catch (err) {
      setPanelError(errMsg(err, 'Could not load ad preferences.'))
    } finally {
      setPanelBusy(false)
    }
  }

  const savePrefs = async () => {
    if (!prefs) return
    setPanelBusy(true)
    setPanelError(null)
    try {
      setPrefs(await meService.updateAccountPreferences(prefs))
      notify.success('Account preferences saved.')
    } catch (err) {
      setPanelError(errMsg(err, 'Could not save preferences.'))
    } finally {
      setPanelBusy(false)
    }
  }

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault()
    setPanelBusy(true)
    setPanelError(null)
    try {
      const result = await meService.redeem(redeemCode)
      if (result.user) useAuthStore.getState().setUser(result.user)
      notify.success(result.message)
      setRedeemCode('')
      setPanel(null)
    } catch (err) {
      setPanelError(errMsg(err, 'Could not redeem that code.'))
    } finally {
      setPanelBusy(false)
    }
  }

  const deleteAccount = async () => {
    setPanelBusy(true)
    setPanelError(null)
    try {
      await meService.deleteAccount(deleteConfirm)
      ;(window as { __authToken?: string }).__authToken = undefined
      useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
      window.location.assign('/login')
    } catch (err) {
      setPanelError(errMsg(err, 'Could not delete your account.'))
    } finally {
      setPanelBusy(false)
    }
  }

  if (!user) return null

  const isPremium = (subscription?.plan ?? user.plan) === 'premium'
  const canManageMembers = isPremium && (subscription?.tier === 'duo' || subscription?.tier === 'family')
  const billingInterval = subscription?.interval ?? user.subscriptionInterval
  const renews = subscription?.currentPeriodEnd ?? user.subscriptionCurrentPeriodEnd

  return (
    <div className="account-settings-page pb-12">
      {/* Search bar */}
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
        <input
          type="search"
          placeholder="Search account or help articles"
          className="h-[46px] w-full rounded-[4px] bg-elevated pl-11 pr-4 text-[14px] text-primary placeholder:text-secondary outline-none focus:ring-1 focus:ring-primary/20 border border-transparent focus:border-primary/20"
        />
      </div>

      {/* Top plan cardbox grid */}
      <div className="flex gap-2">
        {/* Left: plan card (~70%) */}
        <div className="flex-[7] rounded-[4px] bg-elevated p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">Your plan</p>
          <div className="mt-3 flex items-center gap-2">
            <SpotifyMark className="h-5 w-5 text-[#1db954]" />
            <span className="text-[13px] font-bold text-[#1db954]">
              {isPremium ? 'Premium' : 'Free'}
            </span>
          </div>
          <h2 className="mt-1 text-[30px] font-black leading-tight text-primary">
            {isPremium ? 'Premium' : 'Free'}
          </h2>
          <p className="mt-2 text-[13px] text-secondary">
            {isPremium ? (
              <>
                {renews ? <>Your next bill is for {formatDate(renews)}</> : <>Status{' '}<span className="font-semibold capitalize text-primary">{subscription?.status ?? 'active'}</span></>}
              </>
            ) : (
              'Upgrade for unlimited, uninterrupted listening.'
            )}
          </p>
          {isPremium && (
            <p className="mt-1 text-[13px] text-secondary">
              {billingInterval === 'monthly' ? 'Monthly billing' : billingInterval === 'yearly' ? 'Annual billing' : null}
            </p>
          )}
          {!isPremium && (
            <div className="mt-4">
              <Link
                to="/premium"
                className="inline-flex items-center rounded-full bg-white px-5 py-2 text-[13px] font-bold text-black transition-all hover:scale-105 active:scale-95"
              >
                Explore Premium
              </Link>
            </div>
          )}
        </div>

        {/* Right: action cards (~30%) */}
        <div className="flex flex-[3] flex-col gap-2">
          <Link
            to="/profile?edit=1"
            className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[4px] bg-elevated px-4 py-5 text-center transition-colors hover:bg-surface"
          >
            <PencilIcon className="h-6 w-6 text-secondary" />
            <span className="text-[13px] font-semibold text-primary">Edit personal info</span>
          </Link>
          <button
            type="button"
            onClick={openPortal}
            disabled={busy || !isPremium}
            title={isPremium ? undefined : 'Upgrade to Premium before managing a saved payment method.'}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-2 rounded-[4px] bg-elevated px-4 py-5 text-center transition-colors',
              isPremium ? 'hover:bg-surface cursor-pointer' : 'opacity-40 cursor-default',
            )}
          >
            <CreditCardIcon className="h-6 w-6 text-secondary" />
            <span className="text-[13px] font-semibold text-primary">{busy ? 'Opening…' : 'Update card'}</span>
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] font-semibold text-red-400">{error}</p>}

      {/* Account */}
      <Section title="Account">
        <SettingRow icon={UserIcon} label="Edit personal info" to="/profile?edit=1" />
        <SettingRow icon={ArrowPathIcon} label="Recover playlists" sub="Restore playlists deleted in the last 30 days" onClick={openRecover} />
      </Section>

      {/* Subscription */}
      <Section title="Subscription">
        <SettingRow icon={SparklesIcon} label="Available subscriptions" to="/premium" />
        <SettingRow
          icon={CreditCardIcon}
          label="Manage your subscription"
          onClick={isPremium ? openPortal : undefined}
          external={isPremium}
          disabled={!isPremium}
          disabledReason="Upgrade to Premium before managing a subscription."
        />
        {canManageMembers && (
          <SettingRow
            icon={UsersIcon}
            label="Manage members"
            sub="View, invite, or remove members from your shared plan"
            onClick={() => setShowPlanMembers((shown) => !shown)}
            expanded={showPlanMembers}
            controls="plan-members-card"
          />
        )}
        {isPremium && (
          <SettingRow
            icon={XCircleIcon}
            label="Cancel subscription"
            onClick={cancelSubscription}
          />
        )}
      </Section>

      {/* Plan members (self-hides when N/A) */}
      <div
        id="plan-members-card"
        className={cn('mt-5', (!subscriptionLoaded || (canManageMembers && !showPlanMembers)) && 'hidden')}
      >
        <PlanMembersCard />
      </div>

      {/* Payment */}
      <Section title="Payment">
        <SettingRow
          icon={DocumentTextIcon}
          label="Payment history"
          onClick={isPremium ? openPortal : undefined}
          external={isPremium}
          disabled={!isPremium}
          disabledReason="Payment history is available from the billing portal after upgrading to Premium."
        />
        <SettingRow
          icon={CreditCardIcon}
          label="Saved payment cards"
          onClick={isPremium ? openPortal : undefined}
          external={isPremium}
          disabled={!isPremium}
          disabledReason="Saved cards are managed by Stripe after upgrading to Premium."
        />
        <SettingRow icon={GiftIcon} label="Redeem" sub="Redeem a NotSpotify trial or gift code" onClick={() => { setPanel('redeem'); setPanelError(null) }} />
      </Section>

      {/* Security and privacy */}
      <Section title="Security and privacy">
        <SettingRow icon={LockClosedIcon} label="Change password" onClick={() => setShowChangePw(true)} />
        <SettingRow icon={BellIcon} label="Notification settings" to="/settings" />
        <SettingRow icon={EyeIcon} label="Account privacy" to="/settings" />
        <SettingRow icon={KeyIcon} label="Edit login methods" sub="Password and social sign-in options" onClick={openLoginMethods} />
        <SettingRow icon={TrashIcon} label="Delete account" sub="Permanently delete your account and personal data" onClick={() => { setPanel('delete'); setPanelError(null) }} />
        <SettingRow
          icon={ArrowDownTrayIcon}
          label="Download your data"
          sub={downloadBusy ? 'Preparing your export…' : 'Profile, library, history and more'}
          onClick={downloadData}
        />
        <SettingRow icon={ArrowRightOnRectangleIcon} label="Sign out everywhere" onClick={signOutEverywhere} />
      </Section>

      {/* Artist */}
      <Section title="Artist">
        {isArtist ? (
          <SettingRow
            icon={CheckCircleIcon}
            label="Artist Dashboard"
            sub="Manage and submit your tracks"
            to="/artist-dashboard"
          />
        ) : artistApp === undefined ? (
          <div className="flex min-h-[60px] items-center gap-4 px-4">
            <MusicalNoteIcon className="h-5 w-5 shrink-0 text-secondary" />
            <p className="text-[14px] text-secondary">Loading…</p>
          </div>
        ) : artistApp === null ? (
          <div className="px-4 py-4">
            <div className="flex items-center gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface">
                <MusicalNoteIcon className="h-[17px] w-[17px] text-secondary" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-primary">Become an artist</p>
                <p className="text-[12px] text-secondary">Apply to publish your music</p>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyForm((v) => !v)}
                className="text-[13px] font-semibold text-accent hover:text-primary transition-colors"
              >
                {showApplyForm ? 'Cancel' : 'Apply'}
              </button>
            </div>
            {showApplyForm && (
              <form onSubmit={handleApply} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-primary mb-1">Artist name</label>
                  <input
                    required
                    value={applyName}
                    onChange={(e) => setApplyName(e.target.value)}
                    className="w-full bg-surface border border-transparent focus:border-primary/30 text-primary placeholder:text-secondary rounded px-3 py-2 text-[13px] focus:outline-none"
                    placeholder="Your artist name"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-primary mb-1">Bio (optional)</label>
                  <textarea
                    value={applyBio}
                    onChange={(e) => setApplyBio(e.target.value)}
                    rows={3}
                    className="w-full bg-surface border border-transparent focus:border-primary/30 text-primary placeholder:text-secondary rounded px-3 py-2 text-[13px] focus:outline-none resize-none"
                    placeholder="Tell us about your music…"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-primary mb-1">Sample work URL (optional)</label>
                  <input
                    type="url"
                    value={applySample}
                    onChange={(e) => setApplySample(e.target.value)}
                    className="w-full bg-surface border border-transparent focus:border-primary/30 text-primary placeholder:text-secondary rounded px-3 py-2 text-[13px] focus:outline-none"
                    placeholder="https://soundcloud.com/…"
                  />
                </div>
                {applyError && <p className="text-[12px] text-red-400">{applyError}</p>}
                <button
                  type="submit"
                  disabled={applyBusy}
                  className="self-start px-5 py-2 rounded-full bg-white text-black text-[13px] font-bold hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {applyBusy ? 'Submitting…' : 'Submit application'}
                </button>
              </form>
            )}
          </div>
        ) : artistApp.status === 'pending' ? (
          <div className="flex min-h-[60px] items-center gap-4 px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface">
              <ClockIcon className="h-[17px] w-[17px] text-yellow-400" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-primary">Application pending review</p>
              <p className="text-[12px] text-secondary">
                Submitted as &ldquo;{artistApp.displayName}&rdquo; · Admins will review it shortly
              </p>
            </div>
          </div>
        ) : artistApp.status === 'rejected' ? (
          <div className="flex min-h-[60px] items-center gap-4 px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface">
              <XCircleIcon className="h-[17px] w-[17px] text-red-400" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-primary">Application rejected</p>
              {artistApp.reviewNote && (
                <p className="text-[12px] text-secondary">Reason: {artistApp.reviewNote}</p>
              )}
              <button
                type="button"
                onClick={() => { setArtistApp(null); setShowApplyForm(true) }}
                className="text-[12px] font-semibold text-accent hover:text-primary transition-colors mt-1 block"
              >
                Apply again
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      {/* Advertising */}
      <Section title="Advertising">
        <SettingRow icon={MegaphoneIcon} label="Ad preferences" sub="Control personalized ad targeting" onClick={openAdPreferences} />
      </Section>

      {/* Help */}
      <Section title="Help">
        <SettingRow icon={QuestionMarkCircleIcon} label="Spotify support" to="/support" />
      </Section>

      <ChangePasswordModal open={showChangePw} onClose={() => setShowChangePw(false)} />
      {panel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-[6px] bg-elevated p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-primary">
                {panel === 'recover' && 'Recover playlists'}
                {panel === 'redeem' && 'Redeem code'}
                {panel === 'apps' && 'Login methods'}
                {panel === 'ads' && 'Ad preferences'}
                {panel === 'delete' && 'Delete account'}
              </h2>
              <button type="button" onClick={() => setPanel(null)} className="rounded-full px-3 py-1 text-sm font-bold text-secondary hover:text-primary">Close</button>
            </div>
            {panelError && <p role="alert" className="mb-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{panelError}</p>}

            {panel === 'recover' && (
              <div className="space-y-3">
                {panelBusy && <p className="text-sm text-secondary">Loading...</p>}
                {!panelBusy && deletedPlaylists.length === 0 && <p className="text-sm text-secondary">No recoverable playlists right now.</p>}
                {deletedPlaylists.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded bg-page p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-primary">{p.name}</p>
                      <p className="text-xs text-secondary">{p.trackCount} tracks - recoverable until {formatDate(p.expiresAt)}</p>
                    </div>
                    <button type="button" disabled={panelBusy} onClick={() => void restorePlaylist(p.id)} className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black disabled:opacity-50">Restore</button>
                  </div>
                ))}
              </div>
            )}

            {panel === 'redeem' && (
              <form onSubmit={redeem} className="space-y-4">
                <p className="text-sm text-secondary">Enter a NotSpotify gift or trial code. Try NOTSPOTIFY30 for a 30-day Premium trial.</p>
                <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} placeholder="NOTSPOTIFY30" className="w-full rounded bg-surface px-3 py-2 text-sm text-primary outline-none focus:ring-1 focus:ring-primary/30" />
                <button type="submit" disabled={panelBusy || !redeemCode.trim()} className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black disabled:opacity-50">Redeem</button>
              </form>
            )}

            {panel === 'apps' && (
              <div className="space-y-3">
                {panelBusy && <p className="text-sm text-secondary">Loading...</p>}
                {loginMethods && (
                  <>
                    <p className="text-sm text-secondary">Password sign-in is {loginMethods.hasPassword ? 'enabled' : 'not set for this account'}.</p>
                    {/* Only Google OAuth is supported; Facebook/Apple are not offered (bug 12). */}
                    {(['google'] as const).map((provider) => {
                      const state = loginMethods.externalProviders[provider]
                      const label = provider[0].toUpperCase() + provider.slice(1)
                      return (
                        <div key={provider} className="flex items-center justify-between rounded bg-page p-3">
                          <div>
                            <p className="text-sm font-bold text-primary">{label}</p>
                            <p className="text-xs text-secondary">{state.available ? 'Available for sign-in' : state.configured ? 'Disabled by admin' : 'Not configured'}</p>
                          </div>
                          {state.available && <a href={`${import.meta.env.VITE_API_URL}/auth/external/${provider}?mode=popup&returnUrl=${encodeURIComponent(window.location.origin)}`} className="rounded-full border border-secondary px-3 py-1 text-xs font-bold text-primary hover:border-primary">Connect</a>}
                        </div>
                      )
                    })}
                    <button type="button" onClick={() => setShowChangePw(true)} className="mt-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black">Change password</button>
                  </>
                )}
              </div>
            )}

            {panel === 'ads' && prefs && (
              <div className="space-y-3">
                {([
                  ['allowPersonalizedAds', 'Allow personalized ads', 'Use account country and campaign targeting to pick more relevant ads.'],
                  ['blockAlcoholAds', 'Reduce alcohol ads', 'Avoid alcohol-themed campaigns where possible.'],
                  ['blockGamblingAds', 'Reduce gambling ads', 'Avoid gambling-themed campaigns where possible.'],
                  ['emailProductUpdates', 'Product update emails', 'Receive occasional product announcements.'],
                  ['emailSecurityAlerts', 'Security emails', 'Receive security and account access alerts.'],
                ] as const).map(([key, label, sub]) => (
                  <label key={key} className="flex items-center justify-between gap-4 rounded bg-page p-3">
                    <span>
                      <span className="block text-sm font-bold text-primary">{label}</span>
                      <span className="block text-xs text-secondary">{sub}</span>
                    </span>
                    <input type="checkbox" checked={prefs[key]} onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })} className="h-5 w-5 accent-[#1db954]" />
                  </label>
                ))}
                <button type="button" disabled={panelBusy} onClick={savePrefs} className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black disabled:opacity-50">Save preferences</button>
              </div>
            )}

            {panel === 'delete' && (
              <div className="space-y-4">
                <p className="text-sm text-secondary">This permanently deletes your NotSpotify account, playlists, library, social data, and active sessions. This cannot be undone.</p>
                <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Type DELETE" className="w-full rounded bg-surface px-3 py-2 text-sm text-primary outline-none focus:ring-1 focus:ring-red-300" />
                <button type="button" disabled={panelBusy || deleteConfirm.trim().toUpperCase() !== 'DELETE'} onClick={deleteAccount} className="rounded-full bg-red-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Delete account</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
