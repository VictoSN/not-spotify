import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline'
import { CaptchaWidget, type CaptchaWidgetHandle } from '@/components/auth/CaptchaWidget'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { authService, type CaptchaConfig } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

interface FormValues {
  email: string
  password: string
}

/**
 * Dedicated admin sign-in at /admin/login — separate from the member login.
 * AdminRoute redirects unauthenticated admin-area visits here (with the
 * attempted URL in location.state.from so we can return to it after login).
 *
 * Minimal console styling to match AdminShell: no social buttons, no signup.
 */
export function AdminLoginPage() {
  useDocumentTitle('Admin login')
  const navigate = useNavigate()
  const location = useLocation()
  const { login, logout, isLoading, error, isAuthenticated, user, clearError } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()
  const [showPw, setShowPw] = useState(false)
  const [captcha, setCaptcha] = useState<CaptchaConfig | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<CaptchaWidgetHandle>(null)

  const isAdmin = user?.roles?.includes('Admin') ?? false
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/admin'

  // Already signed in as an admin → straight into the console (or where they were headed).
  useEffect(() => {
    if (isAuthenticated && isAdmin) navigate(from, { replace: true })
  }, [isAuthenticated, isAdmin, from, navigate])

  useEffect(() => {
    let active = true
    authService.captchaConfig()
      .then((config) => { if (active) setCaptcha(config) })
      .catch(() => { /* endpoint unavailable — render without captcha */ })
    return () => { active = false }
  }, [])

  const captchaRequired = (captcha?.enabled ?? false) && !captchaToken

  const onSubmit = async (data: FormValues) => {
    clearError()
    try {
      await login(data.email, data.password, captchaToken)
    } catch {
      // reCAPTCHA tokens are single-use — require a fresh solve after a rejection.
      captchaRef.current?.reset()
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page px-4 py-6 text-primary">
      <Link
        to="/"
        className="inline-flex items-center gap-2 self-start text-sm font-semibold text-secondary transition-colors hover:text-primary"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to app
      </Link>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-16">
        {/* Brand — mirrors the AdminShell header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-2 text-accent">
            <SpotifyMark className="h-8 w-8" />
            <span className="text-base font-normal text-secondary">Admin</span>
          </div>
          <h1 className="text-2xl font-bold text-primary">Sign in to the console</h1>
          <p className="mt-2 text-sm text-secondary">Restricted area — admin accounts only.</p>
        </div>

        {isAuthenticated && !isAdmin ? (
          /* Signed in, but not an admin — explain instead of looping redirects. */
          <div className="rounded-lg border border-elevated/50 bg-surface p-5 text-center">
            <ShieldExclamationIcon className="mx-auto mb-3 h-10 w-10 text-amber-400" />
            <p className="text-sm font-semibold text-primary">
              {user?.name} doesn&apos;t have admin access
            </p>
            <p className="mt-2 text-sm text-secondary">
              You&apos;re signed in, but this account isn&apos;t an administrator.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => { clearError(); logout() }}
                className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-page transition-transform hover:scale-[1.02] active:scale-95"
              >
                Switch account
              </button>
              <Link
                to="/"
                className="w-full rounded-full border border-elevated px-4 py-2.5 text-sm font-semibold text-secondary transition-colors hover:text-primary"
              >
                Back to the app
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4 rounded-lg border border-elevated/50 bg-surface p-5"
          >
            <div>
              <label className="mb-1 block text-sm font-semibold text-primary">Email</label>
              <input
                type="email"
                autoComplete="username"
                {...register('email', { required: 'Email is required' })}
                className="w-full rounded-md border border-elevated/50 bg-elevated px-4 py-3 text-sm text-primary transition-colors placeholder:text-muted focus:border-accent focus:outline-none"
                placeholder="admin@example.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-primary">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password', { required: 'Password is required' })}
                  className="w-full rounded-md border border-elevated/50 bg-elevated px-4 py-3 pr-11 text-sm text-primary transition-colors placeholder:text-muted focus:border-accent focus:outline-none"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-secondary"
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {captcha?.enabled && captcha.siteKey && (
              <CaptchaWidget
                ref={captchaRef}
                siteKey={captcha.siteKey}
                onToken={setCaptchaToken}
                className="flex justify-center"
              />
            )}

            <Button type="submit" size="lg" className="mt-1 w-full" disabled={isLoading || captchaRequired}>
              {isLoading ? <Spinner size="sm" /> : (
                <span className="inline-flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5" />
                  Sign in
                </span>
              )}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted">
          Not an admin?{' '}
          <Link to="/login" className="font-semibold text-secondary transition-colors hover:text-primary">
            Member log in
          </Link>
        </p>
      </div>
    </div>
  )
}
