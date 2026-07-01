import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { Spinner } from '@/components/ui/Spinner'
import { authService } from '@/services/authService'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

// Shared classes keep this page visually identical to the Login/Register pages.
const inputClass = 'h-12 w-full rounded border border-secondary bg-elevated px-3 text-sm font-semibold text-primary placeholder:text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'
const labelClass = 'mb-2 block text-sm font-bold text-primary'
const primaryButtonClass = 'mt-2 flex h-12 w-full items-center justify-center rounded-full bg-accent px-8 text-sm font-bold text-black transition-transform hover:scale-[1.02] hover:bg-accent/80 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70'

const GENERIC_MESSAGE = "If an account exists for that email, we've sent a 6-digit code to reset your password."

export function ForgotPasswordPage() {
  useDocumentTitle('Reset your password')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState(GENERIC_MESSAGE)
  const [devCode, setDevCode] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    try {
      const res = await authService.forgotPassword(email.trim())
      setMessage(res.message || GENERIC_MESSAGE)
      setDevCode(res.developmentCode ?? null)
    } catch {
      // Anti-enumeration: the request never reveals whether the account exists,
      // so a failure still lands on the same generic confirmation screen.
      setMessage(GENERIC_MESSAGE)
      setDevCode(null)
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  const goToReset = () => {
    const query = new URLSearchParams({ email: email.trim() })
    if (devCode) query.set('code', devCode)
    navigate(`/reset-password?${query.toString()}`)
  }

  return (
    <div className="relative min-h-screen bg-page px-6 py-8 text-primary">
      <Link to="/login" className="absolute left-6 top-8 inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-primary">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to log in
      </Link>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[348px] flex-col items-center pt-[10vh] sm:pt-[9vh]">
        <SpotifyMark className="mb-7 h-9 w-9 text-primary" />

        {sent ? (
          <>
            <h1 className="text-center text-[2.35rem] font-black leading-[1.05] text-primary sm:text-[2.55rem]">
              Check your email
            </h1>
            <p className="mt-4 text-center text-sm font-medium leading-relaxed text-secondary">
              {message}
            </p>
            <p className="mt-2 text-center text-sm font-medium leading-relaxed text-secondary">
              The code expires in 10 minutes. Enter it on the next screen to choose a new password.
            </p>

            {devCode && (
              <div className="mt-6 w-full rounded border border-accent/30 bg-accent-dim/30 px-4 py-3 text-center">
                <p className="text-xs font-semibold text-secondary">Development code</p>
                <p className="mt-1 font-mono text-lg font-black tracking-[0.25em] text-primary">{devCode}</p>
              </div>
            )}

            <button type="button" onClick={goToReset} className={primaryButtonClass}>
              Enter reset code
            </button>

            <div className="mt-10 text-center">
              <Link to="/login" className="inline-flex text-sm font-black text-primary underline transition-colors hover:text-accent">
                Return to log in
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-center text-[2.35rem] font-black leading-[1.05] text-primary sm:text-[2.55rem]">
              Reset your password
            </h1>
            <p className="mt-4 text-center text-sm font-medium leading-relaxed text-secondary">
              Enter the email for your account and we'll send a 6-digit code to reset your password.
            </p>

            <form onSubmit={onSubmit} className="mt-8 flex w-full flex-col gap-4">
              <div>
                <label htmlFor="forgot-email" className={labelClass}>Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
              <button type="submit" className={primaryButtonClass} disabled={loading}>
                {loading ? <Spinner size="sm" /> : 'Send reset code'}
              </button>
            </form>

            <div className="mt-10 text-center">
              <Link to="/login" className="inline-flex text-sm font-black text-primary underline transition-colors hover:text-accent">
                Return to log in
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
