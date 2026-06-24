import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { notify } from '@/utils/toast'

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const changePassword = useAuthStore((s) => s.changePassword)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setCurrent(''); setNext(''); setConfirm(''); setError(null); setShow(false)
  }

  const close = () => {
    if (loading) return
    reset()
    onClose()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await changePassword(current, next)
      notify.success('Password updated. Other devices have been signed out.')
      reset()
      onClose()
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response?.data
      setError(data?.errors?.join(' ') ?? data?.message ?? 'Could not change password. Check your current password and try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-md border border-elevated/50 bg-elevated px-4 py-3 text-sm text-primary transition-colors placeholder:text-muted focus:border-accent focus:outline-none'

  return (
    <Dialog open={open} onClose={close} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <DialogPanel className="relative w-full max-w-md rounded-lg bg-gradient-to-b from-elevated to-surface p-7 shadow-2xl">
        <button
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-1 text-secondary transition-colors hover:bg-surface hover:text-primary"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <DialogTitle className="text-2xl font-bold text-primary">Change password</DialogTitle>
        <p className="mt-1 text-sm text-secondary">For your security, this signs you out of all other devices.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Current password</label>
            <input type={show ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} required className={inputCls} placeholder="Your current password" autoComplete="current-password" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">New password</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} required className={`${inputCls} pr-11`} placeholder="At least 8 characters" autoComplete="new-password" />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-secondary"
                tabIndex={-1}
                aria-label={show ? 'Hide passwords' : 'Show passwords'}
              >
                {show ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Confirm new password</label>
            <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} placeholder="Re-enter your new password" autoComplete="new-password" />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={close} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Update password'}</Button>
          </div>
        </form>
      </DialogPanel>
    </Dialog>
  )
}
