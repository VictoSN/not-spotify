import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { MusicalNoteIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { useEffect, useState } from 'react'

interface FormValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function SignupPage() {
  const navigate = useNavigate()
  const { signup, isLoading, error, isAuthenticated, clearError } = useAuthStore()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>()
  const [socialNotice, setSocialNotice] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  const onSubmit = async (data: FormValues) => {
    clearError()
    setSocialNotice(null)
    await signup(data.name, data.email, data.password)
  }

  return (
    <div className="min-h-screen bg-base px-4 py-8 text-primary">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary transition-colors">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to home
      </Link>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <MusicalNoteIcon className="mb-5 h-11 w-11 text-accent" />
          <h1 className="text-5xl font-black leading-tight text-primary">Create your account</h1>
          <p className="mt-3 text-sm font-medium text-secondary">Join with email or start with a provider.</p>
        </div>

        <SocialAuthButtons
          onUnavailable={(provider) => {
            setSocialNotice(`${provider[0].toUpperCase()}${provider.slice(1)} sign-up needs OAuth credentials before it can be enabled.`)
            clearError()
          }}
        />

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-elevated" />
          <span className="text-sm font-bold text-primary">or</span>
          <div className="h-px flex-1 bg-elevated" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Name</label>
            <input
              type="text"
              {...register('name', { required: 'Name is required' })}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 text-sm focus:outline-none transition-colors"
              placeholder="Your name"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Email</label>
            <input
              type="email"
              {...register('email', { required: 'Email is required' })}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 text-sm focus:outline-none transition-colors"
              placeholder="email@example.com"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Password</label>
            <input
              type="password"
              {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 text-sm focus:outline-none transition-colors"
              placeholder="Password (min 8 characters)"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Confirm Password</label>
            <input
              type="password"
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (v) => v === watch('password') || 'Passwords do not match',
              })}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 text-sm focus:outline-none transition-colors"
              placeholder="Confirm password"
            />
            {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
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
            {isLoading ? <Spinner size="sm" /> : 'Sign up'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-secondary text-sm">Already have an account?</p>
          <Link to="/login" className="mt-2 inline-flex text-base font-black text-primary transition-colors hover:text-accent">
            Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
