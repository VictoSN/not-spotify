import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { authService } from '@/services/authService'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { notify } from '@/utils/toast'

const inputClass = 'h-12 w-full rounded border border-secondary bg-elevated px-3 text-sm font-semibold text-primary placeholder:text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'
const labelClass = 'mb-2 block text-sm font-bold text-primary'

export function ResetPasswordPage() {
  useDocumentTitle('Set a new password')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const emailFromUrl = params.get('email') ?? ''
  const codeFromUrl = params.get('code') ?? ''

  const [email, setEmail] = useState(emailFromUrl)
  const [code, setCode] = useState(codeFromUrl)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(email.trim() && code.trim() && password && confirm)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !canSubmit) return
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (code.trim().length !== 6 || !/^\d{6}$/.test(code.trim())) {
      setError('Please enter a valid 6-digit code.')
      return
    }
    setLoading(true)
    try {
      await authService.resetPassword(email.trim(), code.trim(), password)
      notify.success('Password updated. Please log in with your new password.')
      navigate('/login', { replace: true })
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Invalid or expired code. Request a new one.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-page px-6 py-8 text-primary">
      <Link to="/login" className="absolute left-6 top-8 inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-primary">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to log in
      </Link>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[348px] flex-col items-center pt-[8vh] sm:pt-[7vh]">
        <div className="flex flex-col items-center text-center">
          <SpotifyMark className="mb-7 h-9 w-9 text-primary" />
          <h1 className="text-center text-[2.55rem] font-black leading-[1.05] text-primary sm:text-[2.75rem]">
            Set a new password
          </h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-secondary">
            Enter the reset code from your email and choose a new password.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 flex w-full flex-col gap-4">
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className={labelClass}>6-digit reset code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              className={`${inputClass} text-center text-2xl font-black tracking-[0.3em]`}
              placeholder="000000"
            />
          </div>
          <div>
            <label className={labelClass}>New password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${inputClass} pr-11`}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-primary"
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={inputClass}
              placeholder="Re-enter your new password"
            />
          </div>

          {error && (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading || !canSubmit}>
            {loading ? <Spinner size="sm" /> : 'Update password'}
          </Button>
        </form>

        <div className="mt-10 text-center">
          <Link to="/forgot-password" className="text-sm font-black text-primary underline transition-colors hover:text-accent">
            Request a new code
          </Link>
        </div>
      </main>
    </div>
  )
}
