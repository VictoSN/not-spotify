import { useState } from 'react'
import { api } from '@/services/api'
import { useConfirm } from '@/hooks/useConfirm'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export function AdminDevPage() {
  const confirm = useConfirm()
  const [resetting, setResetting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async () => {
    if (!(await confirm({
      title: 'Reset all play counts to zero?',
      message: 'Ratings and saves are not affected. This cannot be undone.',
      confirmText: 'Reset',
      danger: true,
    }))) return
    setResetting(true)
    setResult(null)
    setError(null)
    try {
      const res = await api.post<{ message: string }>('/admin/dev/reset-plays')
      setResult(res.data.message)
    } catch (e) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold text-primary mb-1">Dev Tools</h1>
      <p className="text-secondary text-sm mb-8">Development-only utilities. Do not use in production.</p>

      <div className="bg-surface border border-elevated/40 rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-primary">Reset play counts</h2>
        <p className="text-sm text-secondary">
          Zeroes every track's <span className="text-primary font-mono">playCount</span> and deletes all rows from{' '}
          <span className="text-primary font-mono">PlayHistories</span>.{' '}
          Ratings, saves, and other user data are left untouched.
        </p>

        {result && (
          <p className="text-sm text-green-400 font-semibold">✓ {result}</p>
        )}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <Button variant="ghost" onClick={handleReset} disabled={resetting}
          className="border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-400">
          {resetting ? <Spinner size="sm" /> : null}
          Reset play counts to zero
        </Button>
      </div>
    </div>
  )
}
