import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTranslation } from '@/i18n/useTranslation'
import { api } from '@/services/api'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

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

const inputClass = 'h-12 w-full rounded border border-secondary/60 bg-elevated px-3 text-sm font-semibold text-primary placeholder:text-secondary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'
const labelClass = 'mb-2 block text-sm font-bold text-primary'
const primaryButtonClass = 'mt-2 flex h-12 w-full items-center justify-center rounded-full bg-accent px-8 text-sm font-bold text-black transition-transform hover:scale-[1.02] hover:bg-accent/80 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70'

export function SignupPage() {
  const { t } = useTranslation()
  useDocumentTitle('Sign up')
  const navigate = useNavigate()
  const { signup, hydrateFromCookie, isLoading, error, isAuthenticated, clearError } = useAuthStore()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>()
  const [socialNotice, setSocialNotice] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [facebookEnabled, setFacebookEnabled] = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

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
    await signup(data.name, data.email, data.password)
    if (data.wantsArtist) {
      api.post('/me/artist-application', { displayName: data.name, bio: '' }).catch(() => {})
    }
  }

  return (
    <div className="relative min-h-screen bg-base px-6 py-8 text-primary">
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

          <button type="submit" className={primaryButtonClass} disabled={isLoading}>
            {isLoading ? <Spinner size="sm" /> : t('auth.signup.submit')}
          </button>
        </form>

        <div className="my-6 flex w-full items-center gap-4">
          <div className="h-px flex-1 bg-elevated" />
          <span className="text-sm font-bold text-primary">{t('auth.or')}</span>
          <div className="h-px flex-1 bg-elevated" />
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
