import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { CaptchaWidget, type CaptchaWidgetHandle } from '@/components/auth/CaptchaWidget'
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTranslation } from '@/i18n/useTranslation'
import { authService, type CaptchaConfig } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { isDesktop } from '@/utils/platform'
import { isSafeReturnPath, parseHandoffEmailFragment } from '@/utils/accountHandoff'

const externalAuthUrl = (provider: 'google' | 'facebook') => {
  const params = new URLSearchParams({
    mode: 'popup',
    returnUrl: window.location.origin,
  })
  return `${import.meta.env.VITE_API_URL}/auth/external/${provider}?${params.toString()}`
}

interface FormValues {
  email: string
  password: string
}

const inputClass = 'h-12 w-full rounded border border-secondary bg-elevated px-3 text-sm font-semibold text-primary placeholder:text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'
const labelClass = 'mb-2 block text-sm font-bold text-primary'
const primaryButtonClass = 'mt-2 flex h-12 w-full items-center justify-center rounded-full bg-accent px-8 text-sm font-bold text-black transition-transform hover:scale-[1.02] hover:bg-accent/80 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70'
const showDevShortcuts = import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_SHORTCUTS === 'true'

export function LoginPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('auth.login'))
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { login, hydrateFromCookie, isLoading, error, isAuthenticated, user, clearError } = useAuthStore()
  const prefilledEmail = useMemo(
    () => parseHandoffEmailFragment(location.hash),
    [location.hash],
  )
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      email: prefilledEmail ?? '',
      password: '',
    },
  })
  const [socialNotice, setSocialNotice] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [facebookEnabled, setFacebookEnabled] = useState(false)
  const [captcha, setCaptcha] = useState<CaptchaConfig | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<CaptchaWidgetHandle>(null)

  useEffect(() => {
    if (!prefilledEmail || !location.hash) return
    // The fragment was never sent to the server; remove it from browser history too
    // once React Hook Form has copied the email into its own form state.
    navigate(
      { pathname: location.pathname, search: location.search, hash: '' },
      { replace: true },
    )
  }, [prefilledEmail, location.hash, location.pathname, location.search, navigate])

  useEffect(() => {
    if (!isAuthenticated) return
    // Honour a validated ?next= (used by the account-handoff round-trip). It is checked
    // against an internal allow-list, so it cannot be turned into an open redirect.
    const next = params.get('next')
    if (isSafeReturnPath(next)) {
      navigate(next, { replace: true })
      return
    }
    navigate(user?.roles.includes('Admin') ? '/admin/dashboard' : '/', { replace: true })
  }, [isAuthenticated, user, navigate, params])

  useEffect(() => {
    // reCAPTCHA can't render inside Tauri's embedded webview — desktop skips it.
    if (isDesktop()) return
    let active = true
    authService.captchaConfig()
      .then((config) => { if (active) setCaptcha(config) })
      .catch(() => { /* endpoint unavailable — render without captcha */ })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    authService.externalProviders()
      .then((p) => {
        if (!active) return
        setGoogleEnabled(p.google.available)
        setFacebookEnabled(p.facebook.available)
      })
      .catch(() => { /* leave disabled */ })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const oauth = params.get('oauth')
    if (oauth === 'error') setSocialNotice(t('auth.login.socialUnavailable', { provider: 'Google' }))
    else if (oauth === 'unconfigured') setSocialNotice(t('auth.login.socialUnavailable', { provider: 'Google' }))
  }, [params, t])

  // reCAPTCHA tokens are single-use: after a rejected login the widget must be
  // solved again, so reset it on every failure.
  const doLogin = async (email: string, password: string) => {
    clearError()
    setSocialNotice(null)
    try {
      await login(email, password, captchaToken)
    } catch {
      captchaRef.current?.reset()
    }
  }

  const onSubmit = (data: FormValues) => doLogin(data.email, data.password)

  const captchaRequired = (captcha?.enabled ?? false) && !captchaToken

  const DEV_ACCOUNTS = [
    { label: 'alex (admin)', email: 'alex@example.com', password: 'Password123!' },
    { label: 'testing1', email: 'testing1@example.com', password: 'Testing1' },
    { label: 'testing2', email: 'testing2@example.com', password: 'Testing2' },
  ]

  return (
    <div className="relative min-h-screen bg-page px-6 py-8 text-primary">
      <Link to="/" className="absolute left-6 top-8 inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-primary">
        <ArrowLeftIcon className="h-4 w-4" />
        {t('auth.backHome')}
      </Link>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[348px] flex-col items-center pt-[10vh] sm:pt-[9vh]">
        <div className="flex flex-col items-center text-center">
          <SpotifyMark className="mb-7 h-9 w-9 text-primary" />
          <h1 className="text-center text-[2.65rem] font-black leading-[1.05] text-primary sm:text-[2.85rem]">
            {t('auth.login.title')}
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex w-full flex-col gap-4">
          <div>
            <label className={labelClass}>{t('auth.email')}</label>
            <input
              type="email"
              {...register('email', { required: t('auth.err.emailRequired') })}
              className={inputClass}
              placeholder={t('auth.emailPlaceholder')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label className={labelClass}>{t('auth.password')}</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                {...register('password', { required: t('auth.err.passwordRequired'), minLength: { value: 6, message: t('auth.err.passwordMin6') } })}
                className={`${inputClass} pr-11`}
                placeholder={t('auth.passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-primary"
                tabIndex={-1}
                aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPw ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            <Link
              to="/forgot-password"
              className="mt-3 inline-flex text-xs font-bold text-primary underline transition-colors hover:text-accent"
            >
              Forgot your password?
            </Link>
          </div>

          {error && (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          {socialNotice && (
            <div className="rounded border border-accent/30 bg-accent-dim/30 px-4 py-3">
              <p className="text-sm font-medium text-primary">{socialNotice}</p>
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

          <button type="submit" className={primaryButtonClass} disabled={isLoading || captchaRequired}>
            {isLoading ? <Spinner size="sm" /> : t('auth.login.submit')}
          </button>

          {showDevShortcuts && (
            <button
              type="button"
              onClick={() => void doLogin('alex@example.com', 'Password123!')}
              disabled={isLoading || captchaRequired}
              className="h-12 w-full rounded-full border border-secondary/60 bg-transparent px-8 text-sm font-bold text-primary transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {t('auth.login.admin')}
            </button>
          )}
        </form>

        {showDevShortcuts && (
          <div className="mt-6 w-full rounded-md border border-dashed border-elevated/60 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('auth.devShortcuts')}</p>
            <div className="flex flex-wrap gap-2">
              {DEV_ACCOUNTS.map(({ label, email, password }) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => void doLogin(email, password)}
                  disabled={isLoading || captchaRequired}
                  className="rounded border border-elevated/60 bg-elevated px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-elevated/80 hover:text-primary"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="my-6 flex w-full items-center gap-4">
          <div className="h-px flex-1 bg-primary/15" />
          <span className="text-sm font-bold text-primary">{t('auth.or')}</span>
          <div className="h-px flex-1 bg-primary/15" />
        </div>

        <SocialAuthButtons
          className="w-full"
          googleHref={googleEnabled ? externalAuthUrl('google') : null}
          facebookHref={facebookEnabled ? externalAuthUrl('facebook') : null}
          showFacebook={facebookEnabled}
          onProviderSuccess={async () => {
            clearError()
            setSocialNotice(null)
            await hydrateFromCookie()
          }}
          onUnavailable={(provider) => {
            const name = `${provider[0].toUpperCase()}${provider.slice(1)}`
            setSocialNotice(t('auth.login.socialUnavailable', { provider: name }))
            clearError()
          }}
        />

        <div className="mt-14 text-center">
          <p className="text-sm text-secondary">{t('auth.login.noAccount')}</p>
          <Link to="/signup" className="mt-3 inline-flex text-sm font-black text-primary underline transition-colors hover:text-accent">
            {t('auth.login.signupLink')}
          </Link>
        </div>

        <p className="mt-auto max-w-[300px] pt-16 text-center text-[0.68rem] font-semibold leading-relaxed text-muted">
          {t('auth.legalCaptcha')}
        </p>
      </main>
    </div>
  )
}
