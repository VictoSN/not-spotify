import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { MusicalNoteIcon, ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/services/api'
import { authService } from '@/services/authService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { useTranslation } from '@/i18n/useTranslation'
import { useEffect, useState } from 'react'

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

export function SignupPage() {
  useDocumentTitle('Sign up')
  const navigate = useNavigate()
  const { signup, hydrateFromCookie, isLoading, error, isAuthenticated, clearError } = useAuthStore()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>()
  const [socialNotice, setSocialNotice] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [facebookEnabled, setFacebookEnabled] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  // Google sign-up uses the same find-or-create OAuth flow as login.
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
      // Auto-submit artist application after account creation (fire-and-forget; user can also apply from Account settings)
      api.post('/me/artist-application', { displayName: data.name, bio: '' }).catch(() => {})
    }
  }

  return (
    <div className="min-h-screen bg-base px-4 py-8 text-primary">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary transition-colors">
        <ArrowLeftIcon className="h-4 w-4" />
        {t('auth.backHome')}
      </Link>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <MusicalNoteIcon className="mb-5 h-11 w-11 text-accent" />
          <h1 className="text-5xl font-black leading-tight text-primary">{t('auth.signup.title')}</h1>
          <p className="mt-3 text-sm font-medium text-secondary">{t('auth.signup.subtitle')}</p>
        </div>

        <SocialAuthButtons
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

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-elevated" />
          <span className="text-sm font-bold text-primary">{t('auth.or')}</span>
          <div className="h-px flex-1 bg-elevated" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">{t('auth.name')}</label>
            <input
              type="text"
              {...register('name', { required: t('auth.err.nameRequired') })}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 text-sm focus:outline-none transition-colors"
              placeholder={t('auth.namePlaceholder')}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">{t('auth.email')}</label>
            <input
              type="email"
              {...register('email', { required: t('auth.err.emailRequired') })}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 text-sm focus:outline-none transition-colors"
              placeholder={t('auth.emailPlaceholder')}
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">{t('auth.password')}</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                {...register('password', { required: t('auth.err.passwordRequired'), minLength: { value: 8, message: t('auth.err.passwordMin8') } })}
                className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 pr-11 text-sm focus:outline-none transition-colors"
                placeholder={t('auth.signup.passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors"
                tabIndex={-1}
                aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPw ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">{t('auth.confirmPassword')}</label>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                {...register('confirmPassword', {
                  required: t('auth.err.confirmRequired'),
                  validate: (v) => v === watch('password') || t('auth.err.passwordsNoMatch'),
                })}
                className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 pr-11 text-sm focus:outline-none transition-colors"
                placeholder={t('auth.confirmPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors"
                tabIndex={-1}
                aria-label={showConfirmPw ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showConfirmPw ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              {...register('wantsArtist')}
              className="mt-0.5 accent-accent w-4 h-4 shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-primary">{t('auth.signup.artistTitle')}</p>
              <p className="text-xs text-secondary">{t('auth.signup.artistSub')}</p>
            </div>
          </label>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {socialNotice && (
            <div className="rounded-md border border-accent/30 bg-accent-dim/30 px-4 py-3">
              <p className="text-sm font-medium text-primary">{socialNotice}</p>
            </div>
          )}

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={isLoading}>
            {isLoading ? <Spinner size="sm" /> : t('auth.signup.submit')}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-secondary text-sm">{t('auth.signup.haveAccount')}</p>
          <Link to="/login" className="mt-2 inline-flex text-base font-black text-primary transition-colors hover:text-accent">
            {t('auth.signup.loginLink')}
          </Link>
        </div>
      </div>
    </div>
  )
}
