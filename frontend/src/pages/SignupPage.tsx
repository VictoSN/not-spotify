import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { CaptchaWidget, type CaptchaWidgetHandle } from '@/components/auth/CaptchaWidget'
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTranslation } from '@/i18n/useTranslation'
import { api } from '@/services/api'
import { authService } from '@/services/authService'
import type { CaptchaConfig, SignupStartResult } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { isDesktop } from '@/utils/platform'

const externalAuthUrl = (provider: 'google' | 'facebook') => {
  const params = new URLSearchParams({
    mode: 'popup',
    returnUrl: window.location.origin,
  })
  return `${import.meta.env.VITE_API_URL}/auth/external/${provider}?${params.toString()}`
}

interface FormValues {
  name: string
  email: string
  password: string
  confirmPassword: string
  wantsArtist: boolean
}

const inputClass = 'h-12 w-full rounded border border-secondary bg-elevated px-3 text-sm font-semibold text-primary placeholder:text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'
const labelClass = 'mb-2 block text-sm font-bold text-primary'
const primaryButtonClass = 'mt-2 flex h-12 w-full items-center justify-center rounded-full bg-accent px-8 text-sm font-bold text-black transition-transform hover:scale-[1.02] hover:bg-accent/80 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70'

export function SignupPage() {
  const { t } = useTranslation()
  useDocumentTitle('Sign up')
  const navigate = useNavigate()
  const { signup, verifySignup, hydrateFromCookie, isLoading, error, isAuthenticated, clearError } = useAuthStore()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>()
  const [socialNotice, setSocialNotice] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [facebookEnabled, setFacebookEnabled] = useState(false)
  const [pending, setPending] = useState<(SignupStartResult & { wantsArtist: boolean; name: string }) | null>(null)
  const [otp, setOtp] = useState('')
  const [resending, setResending] = useState(false)
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null)
  const [captcha, setCaptcha] = useState<CaptchaConfig | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<CaptchaWidgetHandle>(null)

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

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

  const onSubmit = async (data: FormValues) => {
    clearError()
    setSocialNotice(null)
    try {
      const result = await signup(data.name, data.email, data.password, captchaToken)
      setPending({ ...result, wantsArtist: data.wantsArtist, name: data.name })
    } catch {
      // reCAPTCHA tokens are single-use — require a fresh solve after a rejection.
      captchaRef.current?.reset()
    }
  }

  const captchaRequired = (captcha?.enabled ?? false) && !captchaToken

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault()
    if (!pending || otp.length !== 6) return
    clearError()
    setVerificationNotice(null)
    await verifySignup(pending.email, otp)
    if (pending.wantsArtist) {
      await api.post('/me/artist-application', { displayName: pending.name, bio: '' }).catch(() => {})
    }
  }

  const resendOtp = async () => {
    if (!pending || resending) return
    clearError()
    setVerificationNotice(null)
    setResending(true)
    try {
      const result = await authService.resendSignupOtp(pending.email)
      setPending((current) => current ? { ...current, ...result } : current)
      setOtp('')
      setVerificationNotice(result.message)
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'Could not resend the code. Please try again.'
      setVerificationNotice(message)
    } finally {
      setResending(false)
    }
  }

  if (pending) {
    return (
      <div className="relative min-h-screen bg-page px-6 py-8 text-primary">
        <Link to="/" className="absolute left-6 top-8 inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-primary">
          <ArrowLeftIcon className="h-4 w-4" />
          {t('auth.backHome')}
        </Link>

        <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[348px] flex-col items-center pt-[9vh]">
          <SpotifyMark className="mb-7 h-9 w-9 text-primary" />
          <h1 className="text-center text-[2.35rem] font-black leading-tight text-primary">Check your email</h1>
          <p className="mt-4 text-center text-sm font-medium leading-relaxed text-secondary">
            Enter the 6-digit code sent to <span className="font-bold text-primary">{pending.email}</span>.
          </p>

          <form onSubmit={verifyOtp} className="mt-8 flex w-full flex-col gap-4">
            <div>
              <label htmlFor="signup-otp" className={labelClass}>Verification code</label>
              <input
                id="signup-otp"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                className={`${inputClass} text-center text-xl tracking-[0.45em]`}
                placeholder="000000"
                aria-describedby="signup-otp-expiry"
              />
              <p id="signup-otp-expiry" className="mt-2 text-center text-xs font-medium text-muted">
                The code expires in 10 minutes.
              </p>
            </div>

            {pending.developmentCode && (
              <div className="rounded border border-accent/30 bg-accent-dim/30 px-4 py-3 text-center">
                <p className="text-xs font-semibold text-secondary">Development code</p>
                <p className="mt-1 font-mono text-lg font-black tracking-[0.25em] text-primary">{pending.developmentCode}</p>
              </div>
            )}
            {error && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            {verificationNotice && (
              <div className="rounded border border-primary/15 bg-elevated px-4 py-3">
                <p className="text-sm font-medium text-secondary">{verificationNotice}</p>
              </div>
            )}

            <button type="submit" className={primaryButtonClass} disabled={isLoading || otp.length !== 6}>
              {isLoading ? <Spinner size="sm" /> : 'Verify and create account'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void resendOtp()}
            disabled={resending}
            className="mt-6 inline-flex items-center gap-2 text-sm font-black text-primary underline transition-colors hover:text-accent disabled:opacity-60"
          >
            <ArrowPathIcon className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-page px-6 py-8 text-primary">
      <Link to="/" className="absolute left-6 top-8 inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-primary">
        <ArrowLeftIcon className="h-4 w-4" />
        {t('auth.backHome')}
      </Link>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[348px] flex-col items-center pt-[6vh] sm:pt-[7vh]">
        <div className="flex flex-col items-center text-center">
          <SpotifyMark className="mb-7 h-9 w-9 text-primary" />
          <h1 className="text-center text-[2.55rem] font-black leading-[1.05] text-primary sm:text-[2.75rem]">
            {t('auth.signup.title')}
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
            <label className={labelClass}>{t('auth.name')}</label>
            <input
              type="text"
              {...register('name', { required: t('auth.err.nameRequired') })}
              className={inputClass}
              placeholder={t('auth.namePlaceholder')}
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelClass}>{t('auth.password')}</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                {...register('password', { required: t('auth.err.passwordRequired'), minLength: { value: 8, message: t('auth.err.passwordMin8') } })}
                className={`${inputClass} pr-11`}
                placeholder={t('auth.signup.passwordPlaceholder')}
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
          </div>

          <div>
            <label className={labelClass}>{t('auth.confirmPassword')}</label>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                {...register('confirmPassword', {
                  required: t('auth.err.confirmRequired'),
                  validate: (v) => v === watch('password') || t('auth.err.passwordsNoMatch'),
                })}
                className={`${inputClass} pr-11`}
                placeholder={t('auth.confirmPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-primary"
                tabIndex={-1}
                aria-label={showConfirmPw ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showConfirmPw ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>}
          </div>

          <label className="flex cursor-pointer select-none items-start gap-3">
            <input
              type="checkbox"
              {...register('wantsArtist')}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <div>
              <p className="text-sm font-bold text-primary">{t('auth.signup.artistTitle')}</p>
              <p className="text-xs font-medium text-secondary">{t('auth.signup.artistSub')}</p>
            </div>
          </label>

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
            {isLoading ? <Spinner size="sm" /> : t('auth.signup.submit')}
          </button>
        </form>

        <div className="my-6 flex w-full items-center gap-4">
          <div className="h-px flex-1 bg-primary/15" />
          <span className="text-sm font-bold text-primary">{t('auth.or')}</span>
          <div className="h-px flex-1 bg-primary/15" />
        </div>

        <SocialAuthButtons
          actionLabel="Sign up with"
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
            setSocialNotice(t('auth.signup.socialUnavailable', { provider: name }))
            clearError()
          }}
        />

        <div className="mt-10 text-center">
          <p className="text-sm text-secondary">{t('auth.signup.haveAccount')}</p>
          <Link to="/login" className="mt-3 inline-flex text-sm font-black text-primary underline transition-colors hover:text-accent">
            {t('auth.signup.loginLink')}
          </Link>
        </div>

        <p className="mt-12 max-w-[300px] pb-2 text-center text-[0.68rem] font-semibold leading-relaxed text-muted">
          {t('auth.legalCaptcha')}
        </p>
      </main>
    </div>
  )
}
