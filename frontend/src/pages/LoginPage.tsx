import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useEffect } from 'react'

interface FormValues {
  email: string
  password: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error, isAuthenticated, clearError } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  const onSubmit = async (data: FormValues) => {
    await login(data.email, data.password)
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <MusicalNoteIcon className="w-10 h-10 text-accent mb-3" />
          <h1 className="text-3xl font-bold text-primary">Log in to not-spotify</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
              {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-3 text-sm focus:outline-none transition-colors"
              placeholder="Password"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={isLoading} onClick={clearError}>
            {isLoading ? <Spinner size="sm" /> : 'Log In'}
          </Button>
        </form>

        <div className="mt-8 text-center border-t border-elevated/30 pt-6">
          <p className="text-secondary text-sm">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-semibold hover:text-accent transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
