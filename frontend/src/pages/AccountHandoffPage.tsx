import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/stores/authStore'
import { HANDOFF_PATH, maskEmail, parseHandoffHint } from '@/utils/accountHandoff'

/**
 * Interstitial for the desktop -> browser account handoff (see utils/accountHandoff).
 *
 * The desktop app opens this route in the system browser carrying a non-secret hint:
 * the expected account id + a masked email + the intended destination. Here we compare
 * that hint against the browser's own authenticated account and, only on a mismatch,
 * ask the user what to do — we never switch accounts silently.
 *
 * Loop-safety: a mismatch renders UI and never auto-navigates. Only a confirmed match,
 * or an unauthenticated browser, redirects on its own — both terminal.
 */
export function AccountHandoffPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isInitializing = useAuthStore((s) => s.isInitializing)

  const { account: expected, hint, next } = useMemo(() => parseHandoffHint(params), [params])

  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  // The current handoff URL (path + query), used as the login round-trip target so the
  // account is re-checked after signing in — this is what makes "switch account"
  // loop-safe instead of dropping the user straight onto the destination.
  const handoffReturn = `${HANDOFF_PATH}?${params.toString()}`

  const matches = isAuthenticated && !!user && (!expected || user.id === expected)
  const unauthenticated = !isInitializing && !isAuthenticated

  useDocumentTitle('Choose an account')

  // Terminal auto-navigations only: a confirmed match continues to the destination; an
  // unauthenticated browser goes to login (which returns here to re-check).
  useEffect(() => {
    if (isInitializing || switching) return
    if (matches) {
      navigate(next, { replace: true })
    } else if (unauthenticated) {
      navigate(`/login?next=${encodeURIComponent(handoffReturn)}`, { replace: true })
    }
  }, [isInitializing, switching, matches, unauthenticated, next, handoffReturn, navigate])

  const onSwitch = async () => {
    setSwitching(true)
    setSwitchError(null)
    try {
      // Reuse the store's logout, but keep the SPA alive (no full reload) so we control
      // the redirect. Only the BROWSER session is cleared — the desktop app is untouched.
      await useAuthStore.getState().logout({ reload: false })
      navigate(`/login?next=${encodeURIComponent(handoffReturn)}`, { replace: true })
    } catch {
      setSwitching(false)
      setSwitchError('We could not sign out of this browser. Check your connection and try again.')
    }
  }

  const continueHere = () => navigate(next, { replace: true })
  const cancel = () => navigate('/', { replace: true })

  // While auth is resolving, or while a terminal redirect is about to fire, show a spinner
  // rather than flashing the mismatch UI.
  if (isInitializing || switching || matches || unauthenticated) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-6 text-secondary">
          <Spinner size="lg" />
          <p className="text-sm">{switching ? 'Signing out of this browser…' : 'Checking your account…'}</p>
        </div>
      </Shell>
    )
  }

  // Mismatch: browser is signed in as someone other than the account the link was for.
  const currentMasked = maskEmail(user?.email)
  const openedFor = hint ?? 'another account'

  return (
    <Shell>
      <h1 className="mb-2 text-center text-2xl font-black tracking-[-0.03em] text-primary">Choose an account</h1>
      <p className="mb-6 max-w-[320px] text-center text-sm leading-6 text-secondary">
        This link was opened for <span className="font-semibold text-primary">{openedFor}</span>, but this browser is
        signed in as <span className="font-semibold text-primary">{currentMasked}</span>.
      </p>

      {switchError && (
        <div className="mb-4 w-full rounded border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{switchError}</p>
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onSwitch}
          className="w-full rounded-full bg-accent px-6 py-3 text-sm font-black text-black transition-transform hover:scale-[1.02] active:scale-95"
        >
          Switch account
        </button>
        <button
          type="button"
          onClick={continueHere}
          className="w-full rounded-full border border-secondary/40 px-6 py-3 text-sm font-bold text-primary transition-colors hover:border-primary"
        >
          Continue as {currentMasked}
        </button>
      </div>

      <button
        type="button"
        onClick={cancel}
        className="mt-5 text-sm font-semibold text-secondary transition-colors hover:text-primary"
      >
        Cancel
      </button>
    </Shell>
  )
}

/** Shared centred frame, matching the login page's look. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-page px-6 py-8 text-primary">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[360px] flex-col items-center pt-[12vh]">
        <SpotifyMark className="mb-7 h-9 w-9 text-primary" />
        {children}
      </main>
    </div>
  )
}
