import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, KeyIcon } from '@heroicons/react/24/outline'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { authService } from '@/services/authService'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

const inputClass = 'h-12 w-full rounded border border-secondary bg-elevated px-3 text-sm font-semibold text-primary placeholder:text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'
const labelClass = 'mb-2 block text-sm font-bold text-primary'

export function ForgotPasswordPage() {
  useDocumentTitle('Reset your password')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [devLink, setDevLink] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    setMessage(null)
    setCode(null)
    setDevLink(null)
    try {
      const res = await authService.forgotPassword(email.trim())
      setMessage(res.message)
      setCode(res.code ?? null)
      setDevLink(res.resetUrl ?? null)
    } catch {
      setMessage('If an account exists for that email, reset instructions have been sent.')
    } finally {
      setLoading(false)
    }
  }

  const handleUseCode = () => {
    if (code) navigate(`/reset-password?email=${encodeURIComponent(email.trim())}&code=${code}`)
  }

  return (
    <div className="relative min-h-screen bg-page px-6 py-8 text-primary">
      <Link to="/login" className="absolute left-6 top-8 inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-primary">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to log in
      </Link>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[348px] flex-col items-center pt-[10vh] sm:pt-[9vh]">
        <div className="flex flex-col items-center text-center">
          <SpotifyMark className="mb-7 h-9 w-9 text-primary" />
          <h1 className="text-center text-[2.55rem] font-black leading-[1.05] text-primary sm:text-[2.75rem]">
            Reset your password
          </h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-secondary">
            Enter your account email and we will send a secure reset link.
          </p>
        </div>

        {message ? (
          <div className="mt-8 w-full rounded border border-accent/30 bg-accent-dim/30 px-4 py-4">
            <p className="text-sm font-medium text-primary">{message}</p>
            {code && (
              <div className="mt-4 rounded bg-elevated p-4 text-center">
                <KeyIcon className="mx-auto mb-2 h-6 w-6 text-accent" />
                <p className="text-xs font-semibold uppercase text-secondary">Testing reset code</p>
                <p className="mt-2 text-3xl font-black tracking-[0.3em] text-primary">{code}</p>
                <Button size="lg" className="mt-4 w-full" onClick={handleUseCode}>
                  Continue
                </Button>
              </div>
            )}
            {devLink && !code && (
              <Link to={devLink.replace(/^https?:\/\/[^/]+/, '')} className="mt-4 inline-flex text-sm font-bold text-primary underline transition-colors hover:text-accent">
                Open reset link
              </Link>
            )}
          </div>
        ) : (
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
            <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Send reset link'}
            </Button>
          </form>
        )}

        <div className="mt-10 text-center">
          <Link to="/login" className="inline-flex text-sm font-black text-primary underline transition-colors hover:text-accent">
            Return to log in
          </Link>
        </div>
      </main>
    </div>
  )
}
