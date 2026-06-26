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
  PuzzlePieceIcon,
  UsersIcon,
  ShieldCheckIcon,
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
        'flex items-center gap-4 px-4 transition-colors',
        'min-h-[60px] py-3',
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-white/[0.04]',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#3a3a3a]">
        <Icon className="h-[17px] w-[17px] text-[#b3b3b3]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-tight text-white">{label}</p>
        {sub && <p className="mt-0.5 truncate text-[12px] text-[#b3b3b3]">{sub}</p>}
      </div>
      {external ? (
        <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-[#b3b3b3]" />
      ) : (
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-[#b3b3b3]" />
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
    <section className="mt-5 overflow-hidden rounded-[4px] bg-[#282828]">
      <h2 className="px-4 pb-3 pt-5 text-[22px] font-bold text-white">{title}</h2>
      <div className="divide-y divide-[#333333]">{children}</div>
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
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showChangePw, setShowChangePw] = useState(false)

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

  if (!user) return null

  const isPremium = (subscription?.plan ?? user.plan) === 'premium'
  const renews = subscription?.currentPeriodEnd ?? user.subscriptionCurrentPeriodEnd

  return (
    <div className="pb-12">
      {/* Search bar */}
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#727272]" />
        <input
          type="search"
          placeholder="Search account or help articles"
          className="h-[46px] w-full rounded-[4px] bg-[#2a2a2a] pl-11 pr-4 text-[14px] text-white placeholder:text-[#727272] outline-none focus:ring-1 focus:ring-white/20 border border-transparent focus:border-white/10"
        />
      </div>

      {/* Top plan cardbox grid */}
      <div className="flex gap-2">
        {/* Left: plan card (~70%) */}
        <div className="flex-[7] rounded-[4px] bg-[#282828] p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#b3b3b3]">Your plan</p>
          <div className="mt-3 flex items-center gap-2">
            <SpotifyMark className="h-5 w-5 text-[#1db954]" />
            <span className="text-[13px] font-bold text-[#1db954]">
              {isPremium ? 'Premium' : 'Free'}
            </span>
          </div>
          <h2 className="mt-1 text-[30px] font-black leading-tight text-white">
            {isPremium ? (user.subscriptionPlan === 'family' ? 'Family' : 'Premium') : 'Free'}
          </h2>
          <p className="mt-2 text-[13px] text-[#b3b3b3]">
            {isPremium ? (
              <>
                {renews ? <>Your next bill is for {formatDate(renews)}</> : <>Status{' '}<span className="font-semibold capitalize text-white">{subscription?.status ?? 'active'}</span></>}
              </>
            ) : (
              'Upgrade for unlimited, uninterrupted listening.'
            )}
          </p>
          {isPremium && (
            <p className="mt-1 text-[13px] text-[#b3b3b3]">
              {subscription?.interval === 'month' ? 'Monthly billing' : subscription?.interval === 'year' ? 'Annual billing' : null}
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
            className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[4px] bg-[#282828] px-4 py-5 text-center transition-colors hover:bg-[#323232]"
          >
            <PencilIcon className="h-6 w-6 text-[#b3b3b3]" />
            <span className="text-[13px] font-semibold text-white">Edit personal info</span>
          </Link>
          <button
            type="button"
            onClick={openPortal}
            disabled={busy || !isPremium}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-2 rounded-[4px] bg-[#282828] px-4 py-5 text-center transition-colors',
              isPremium ? 'hover:bg-[#323232] cursor-pointer' : 'opacity-40 cursor-default',
            )}
          >
            <CreditCardIcon className="h-6 w-6 text-[#b3b3b3]" />
            <span className="text-[13px] font-semibold text-white">{busy ? 'Opening…' : 'Update card'}</span>
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] font-semibold text-red-400">{error}</p>}

      {/* Account */}
      <Section title="Account">
        <SettingRow icon={UserIcon} label="Edit personal info" to="/profile?edit=1" />
        <SettingRow icon={ArrowPathIcon} label="Recover playlists" disabled />
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
        />
        <SettingRow icon={UsersIcon} label="Manage members" disabled />
        {isPremium && (
          <SettingRow
            icon={XCircleIcon}
            label="Cancel subscription"
            onClick={cancelSubscription}
          />
        )}
      </Section>

      {/* Plan members (self-hides when N/A) */}
      <div className="mt-5">
        <PlanMembersCard />
      </div>

      {/* Payment */}
      <Section title="Payment">
        <SettingRow icon={DocumentTextIcon} label="Payment history" disabled />
        <SettingRow icon={CreditCardIcon} label="Saved payment cards" disabled />
        <SettingRow icon={GiftIcon} label="Redeem" disabled />
      </Section>

      {/* Security and privacy */}
      <Section title="Security and privacy">
        <SettingRow icon={LockClosedIcon} label="Change password" onClick={() => setShowChangePw(true)} />
        <SettingRow icon={PuzzlePieceIcon} label="Manage apps" disabled />
        <SettingRow icon={BellIcon} label="Notification settings" disabled />
        <SettingRow icon={EyeIcon} label="Account privacy" disabled />
        <SettingRow icon={KeyIcon} label="Edit login methods" disabled />
        <SettingRow icon={TrashIcon} label="Delete account" disabled />
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
            <MusicalNoteIcon className="h-5 w-5 shrink-0 text-[#b3b3b3]" />
            <p className="text-[14px] text-[#b3b3b3]">Loading…</p>
          </div>
        ) : artistApp === null ? (
          <div className="px-4 py-4">
            <div className="flex items-center gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#3a3a3a]">
                <MusicalNoteIcon className="h-[17px] w-[17px] text-[#b3b3b3]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-white">Become an artist</p>
                <p className="text-[12px] text-[#b3b3b3]">Apply to publish your music</p>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyForm((v) => !v)}
                className="text-[13px] font-semibold text-[#1db954] hover:text-white transition-colors"
              >
                {showApplyForm ? 'Cancel' : 'Apply'}
              </button>
            </div>
            {showApplyForm && (
              <form onSubmit={handleApply} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-white mb-1">Artist name</label>
                  <input
                    required
                    value={applyName}
                    onChange={(e) => setApplyName(e.target.value)}
                    className="w-full bg-[#3a3a3a] border border-transparent focus:border-white/20 text-white placeholder:text-[#727272] rounded px-3 py-2 text-[13px] focus:outline-none"
                    placeholder="Your artist name"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-white mb-1">Bio (optional)</label>
                  <textarea
                    value={applyBio}
                    onChange={(e) => setApplyBio(e.target.value)}
                    rows={3}
                    className="w-full bg-[#3a3a3a] border border-transparent focus:border-white/20 text-white placeholder:text-[#727272] rounded px-3 py-2 text-[13px] focus:outline-none resize-none"
                    placeholder="Tell us about your music…"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-white mb-1">Sample work URL (optional)</label>
                  <input
                    type="url"
                    value={applySample}
                    onChange={(e) => setApplySample(e.target.value)}
                    className="w-full bg-[#3a3a3a] border border-transparent focus:border-white/20 text-white placeholder:text-[#727272] rounded px-3 py-2 text-[13px] focus:outline-none"
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#3a3a3a]">
              <ClockIcon className="h-[17px] w-[17px] text-yellow-400" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-white">Application pending review</p>
              <p className="text-[12px] text-[#b3b3b3]">
                Submitted as &ldquo;{artistApp.displayName}&rdquo; · Admins will review it shortly
              </p>
            </div>
          </div>
        ) : artistApp.status === 'rejected' ? (
          <div className="flex min-h-[60px] items-center gap-4 px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#3a3a3a]">
              <XCircleIcon className="h-[17px] w-[17px] text-red-400" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-white">Application rejected</p>
              {artistApp.reviewNote && (
                <p className="text-[12px] text-[#b3b3b3]">Reason: {artistApp.reviewNote}</p>
              )}
              <button
                type="button"
                onClick={() => { setArtistApp(null); setShowApplyForm(true) }}
                className="text-[12px] font-semibold text-[#1db954] hover:text-white transition-colors mt-1 block"
              >
                Apply again
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      {/* Advertising */}
      <Section title="Advertising">
        <SettingRow icon={MegaphoneIcon} label="Ad preferences" disabled />
      </Section>

      {/* Help */}
      <Section title="Help">
        <SettingRow icon={QuestionMarkCircleIcon} label="Spotify support" to="/support" />
        <SettingRow icon={ShieldCheckIcon} label="App support" disabled />
      </Section>

      <ChangePasswordModal open={showChangePw} onClose={() => setShowChangePw(false)} />
    </div>
  )
}
