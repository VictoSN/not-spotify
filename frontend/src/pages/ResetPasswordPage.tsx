import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon, MusicalNoteIcon } from '@heroicons/react/24/outline'
import { authService } from '@/services/authService'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { notify } from '@/utils/toast'

export function ResetPasswordPage() {
  useDocumentTitle('Set a new password')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const linkValid = Boolean(email && token)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await authService.resetPassword(email, token, password)
      notify.success('Password updated. Please log in with your new password.')
      navigate('/login', { replace: true })
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'This reset link is invalid or has expired. Request a new one.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base px-4 py-8 text-primary">
      <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-primary">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to log in
      </Link>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <MusicalNoteIcon className="mb-5 h-11 w-11 text-accent" />
          <h1 className="text-4xl font-black leading-tight text-primary">Set a new password</h1>
          {linkValid && <p className="mt-3 text-sm font-medium text-secondary">Choose a new password for {email}.</p>}
        </div>

        {!linkValid ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-4 text-center">
            <p className="text-sm text-red-400">This reset link is missing information or has expired.</p>
            <Link to="/forgot-password" className="mt-3 inline-flex text-sm font-black text-primary transition-colors hover:text-accent">
              Request a new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-primary">New password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-md border border-elevated/50 bg-elevated px-4 py-3 pr-11 text-sm text-primary transition-colors placeholder:text-muted focus:border-accent focus:outline-none"
                  placeholder="At least 8 characters"
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
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-primary">Confirm new password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full rounded-md border border-elevated/50 bg-elevated px-4 py-3 text-sm text-primary transition-colors placeholder:text-muted focus:border-accent focus:outline-none"
                placeholder="Re-enter your new password"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
