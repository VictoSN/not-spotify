import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { MusicalNoteIcon, ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { useTranslation } from '@/i18n/useTranslation'
import { useEffect, useState } from 'react'

interface FormValues {
  email: string
  password: string
}

export function LoginPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('auth.login'))
  const navigate = useNavigate()
  const { login, isLoading, error, isAuthenticated, clearError } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()
  const [socialNotice, setSocialNotice] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  const onSubmit = async (data: FormValues) => {
    clearError()
    setSocialNotice(null)
    await login(data.email, data.password)
  }

  const devLogin = (email: string, password: string) => {
    clearError()
    setSocialNotice(null)
    login(email, password)
  }

  const DEV_ACCOUNTS = [
    { label: 'alex (admin)', email: 'alex@example.com', password: 'Password123!' },
    { label: 'testing1', email: 'testing1@example.com', password: 'Testing1' },
    { label: 'testing2', email: 'testing2@example.com', password: 'Testing2' },
  ]

  return (
    <div className="min-h-screen bg-base px-4 py-8 text-primary">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary transition-colors">
        <ArrowLeftIcon className="h-4 w-4" />
        {t('auth.backHome')}
      </Link>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <MusicalNoteIcon className="mb-5 h-11 w-11 text-accent" />
<<<<<<< HEAD
          <h1 className="text-5xl font-black leading-tight text-primary">Welcome back</h1>
          <p className="mt-3 text-sm font-medium text-secondary">{t('auth.login')} with your account or continue with a provider.</p>
=======
          <h1 className="text-5xl font-black leading-tight text-primary">{t('auth.login.title')}</h1>
          <p className="mt-3 text-sm font-medium text-secondary">{t('auth.login.subtitle')}</p>
>>>>>>> dfcb47679fe886229488a4a8db238dbce172d7c8
        </div>

        <SocialAuthButtons
          onUnavailable={(provider) => {
            const name = `${provider[0].toUpperCase()}${provider.slice(1)}`
            setSocialNotice(t('auth.login.socialUnavailable', { provider: name }))
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
                {...register('password', { required: t('auth.err.passwordRequired'), minLength: { value: 6, message: t('auth.err.passwordMin6') } })}
                className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 pr-11 text-sm focus:outline-none transition-colors"
                placeholder={t('auth.passwordPlaceholder')}
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
<<<<<<< HEAD
            {isLoading ? <Spinner size="sm" /> : t('auth.loginButton')}
=======
            {isLoading ? <Spinner size="sm" /> : t('auth.login.submit')}
>>>>>>> dfcb47679fe886229488a4a8db238dbce172d7c8
          </Button>
        </form>

        {/* ── Dev-only quick login ── */}
        {import.meta.env.DEV && (
          <div className="mt-6 rounded-md border border-dashed border-elevated/60 p-3">
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">🔧 {t('auth.devShortcuts')}</p>
            <div className="flex flex-wrap gap-2">
              {DEV_ACCOUNTS.map(({ label, email, password }) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => devLogin(email, password)}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-elevated hover:bg-elevated/80 text-secondary hover:text-primary border border-elevated/60 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
<<<<<<< HEAD
          <p className="text-secondary text-sm">{t('auth.noAccount')}</p>
          <Link to="/signup" className="mt-2 inline-flex text-base font-black text-primary transition-colors hover:text-accent">
            {t('auth.signupLink')}
=======
          <p className="text-secondary text-sm">{t('auth.login.noAccount')}</p>
          <Link to="/signup" className="mt-2 inline-flex text-base font-black text-primary transition-colors hover:text-accent">
            {t('auth.login.signupLink')}
>>>>>>> dfcb47679fe886229488a4a8db238dbce172d7c8
          </Link>
        </div>
      </div>
    </div>
  )
}
