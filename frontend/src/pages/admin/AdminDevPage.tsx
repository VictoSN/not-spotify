import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { adminService, type AdminAuthProviders } from '@/services/adminService'
import { useConfirm } from '@/hooks/useConfirm'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { adminPageMediumClass } from './adminPageLayout'

export function AdminDevPage() {
  const confirm = useConfirm()
  const [resetting, setResetting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [providers, setProviders] = useState<AdminAuthProviders | null>(null)
  const [savingProviders, setSavingProviders] = useState(false)
  const [providerMessage, setProviderMessage] = useState<string | null>(null)
  const [providerError, setProviderError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    adminService.getAuthProviders()
      .then((data) => { if (active) setProviders(data) })
      .catch(() => { if (active) setProviderError('Failed to load auth providers.') })
    return () => { active = false }
  }, [])

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

  const toggleProvider = async (provider: keyof AdminAuthProviders, enabled: boolean) => {
    if (!providers) return

    const next = {
      google: provider === 'google' ? enabled : providers.google.enabled,
      facebook: provider === 'facebook' ? enabled : providers.facebook.enabled,
      apple: provider === 'apple' ? enabled : providers.apple.enabled,
    }

    setSavingProviders(true)
    setProviderMessage(null)
    setProviderError(null)
    try {
      const updated = await adminService.updateAuthProviders(next)
      setProviders(updated)
      setProviderMessage('Auth provider settings saved.')
    } catch (e) {
      setProviderError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save auth provider settings.')
    } finally {
      setSavingProviders(false)
    }
  }

  return (
    <div className={adminPageMediumClass}>
      <h1 className="text-3xl font-bold text-primary mb-1">Dev Tools</h1>
      <p className="text-secondary text-sm mb-8">Development-only utilities. Do not use in production.</p>

      <div className="mb-6 rounded-lg border border-elevated/40 bg-surface p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-primary">Social login providers</h2>
          <p className="text-sm text-secondary">
            Choose which social sign-in buttons can appear on login and signup. A provider also needs credentials and backend support before users can use it.
          </p>
        </div>

        {providerMessage && <p className="mb-3 text-sm font-semibold text-green-400">{providerMessage}</p>}
        {providerError && <p className="mb-3 text-sm text-red-400">{providerError}</p>}

        <div className="space-y-3">
          {providers ? (
            ([
              ['google', 'Google'],
              ['facebook', 'Facebook'],
              ['apple', 'Apple'],
            ] as const).map(([key, label]) => {
              const state = providers[key]
              return (
                <label
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-md border border-elevated/50 bg-base/45 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-primary">{label}</span>
                    <span className="block text-xs text-secondary">
                      {state.status} | {state.configured ? 'credentials configured' : 'credentials missing'} | {state.available ? 'visible to users' : 'hidden from users'}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={state.enabled}
                    disabled={savingProviders}
                    onChange={(event) => toggleProvider(key, event.target.checked)}
                    className="h-5 w-5 shrink-0 accent-accent"
                    aria-label={`Enable ${label} login`}
                  />
                </label>
              )
            })
          ) : (
            <div className="flex items-center gap-2 text-sm text-secondary">
              <Spinner size="sm" />
              Loading provider settings
            </div>
          )}
        </div>
      </div>

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
