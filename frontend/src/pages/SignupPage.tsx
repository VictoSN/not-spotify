import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useEffect } from 'react'

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

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  const onSubmit = async (data: FormValues) => {
    await signup(data.name, data.email, data.password)
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <MusicalNoteIcon className="w-10 h-10 text-accent mb-3" />
          <h1 className="text-3xl font-bold text-primary">Create your account</h1>
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

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={isLoading} onClick={clearError}>
            {isLoading ? <Spinner size="sm" /> : 'Sign Up'}
          </Button>
        </form>

        <div className="mt-8 text-center border-t border-elevated/30 pt-6">
          <p className="text-secondary text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:text-accent transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
