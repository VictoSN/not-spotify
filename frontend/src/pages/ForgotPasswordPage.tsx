import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, MusicalNoteIcon, KeyIcon } from '@heroicons/react/24/outline'
import { authService } from '@/services/authService'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

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
      setCode(res.code)
      if (res.resetUrl) setDevLink(res.resetUrl)
    } catch {
      setMessage('If an account exists for that email, a 6-digit code has been generated.')
    } finally {
      setLoading(false)
    }
  }

  const handleUseCode = () => {
    if (code) navigate(`/reset-password?email=${encodeURIComponent(email.trim())}&code=${code}`)
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
          <h1 className="text-4xl font-black leading-tight text-primary">Reset your password</h1>
          <p className="mt-3 text-sm font-medium text-secondary">
            Enter the email for your account and we'll generate a 6-digit code to reset your password.
          </p>
        </div>

        {message ? (
          <div className="rounded-md border border-accent/30 bg-accent-dim/30 px-4 py-4">
            <p className="text-sm font-medium text-primary">{message}</p>
            {code && (
              <div className="mt-4 rounded-md bg-elevated p-4 text-center">
                <KeyIcon className="mx-auto mb-2 h-6 w-6 text-accent" />
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary">Your reset code</p>
                <p className="mt-1 text-3xl font-black tracking-[0.3em] text-primary">{code}</p>
                <Button size="lg" className="mt-4 w-full" onClick={handleUseCode}>
                  Use this code to reset password
                </Button>
              </div>
            )}
            {devLink && (
              <div className="mt-3 border-t border-elevated/60 pt-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">🔧 Dev fallback link</p>
                <Link to={devLink.replace(/^https?:\/\/[^/]+/, '')} className="break-all text-sm font-semibold text-accent hover:underline">
                  Open reset link →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-primary">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-elevated/50 bg-elevated px-4 py-3 text-sm text-primary transition-colors placeholder:text-muted focus:border-accent focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Send reset code'}
            </Button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link to="/login" className="inline-flex text-base font-black text-primary transition-colors hover:text-accent">
            Return to log in
          </Link>
        </div>
      </div>
    </div>
  )
}
