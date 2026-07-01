import { useEffect, useMemo, useState } from 'react'
import {
  PlusCircleIcon, PencilSquareIcon, TrashIcon, CheckCircleIcon, XCircleIcon,
  MegaphoneIcon, SpeakerWaveIcon,
} from '@heroicons/react/24/outline'
import type { AdAdmin, AdSettings, UpsertAdPayload } from '@/types/ad'
import { adminAdService } from '@/services/adService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SearchInput } from '@/components/common/SearchInput'
import { useConfirm } from '@/hooks/useConfirm'
import { notify } from '@/utils/toast'
import { useDebounce } from '@/hooks/useDebounce'

const inputCls =
  'w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-2.5 text-sm focus:outline-none'

/** Empty form state for a brand-new ad. */
const blankForm = {
  title: '',
  advertiser: '',
  audioUrl: '',
  imageUrl: '',
  clickUrl: '',
  durationSeconds: '',
  country: '',
  weight: '1',
  isActive: true,
  startsAt: '',
  endsAt: '',
}

type FormState = typeof blankForm

/** An ISO timestamp → the value a <input type="datetime-local"> expects (local, no seconds). */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formToPayload(form: FormState): UpsertAdPayload {
  const seconds = Number(form.durationSeconds)
  return {
    title: form.title.trim(),
    advertiser: form.advertiser.trim(),
    audioUrl: form.audioUrl.trim(),
    imageUrl: form.imageUrl.trim() || null,
    clickUrl: form.clickUrl.trim() || null,
    durationMs: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0,
    country: form.country.trim() ? form.country.trim().toUpperCase() : null,
    weight: Math.max(1, Number(form.weight) || 1),
    isActive: form.isActive,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
  }
}

function adToForm(ad: AdAdmin): FormState {
  return {
    title: ad.title,
    advertiser: ad.advertiser,
    audioUrl: ad.audioUrl,
    imageUrl: ad.imageUrl ?? '',
    clickUrl: ad.clickUrl ?? '',
    durationSeconds: ad.durationMs ? String(Math.round(ad.durationMs / 1000)) : '',
    country: ad.country ?? '',
    weight: String(ad.weight),
    isActive: ad.isActive,
    startsAt: toLocalInput(ad.startsAt),
    endsAt: toLocalInput(ad.endsAt),
  }
}

export function AdminAdsPage() {
  const confirm = useConfirm()
  const [ads, setAds] = useState<AdAdmin[]>([])
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 200)
  const [settings, setSettings] = useState<AdSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  // null = form closed; '' = creating; an id = editing that ad.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([adminAdService.list(), adminAdService.getSettings()])
      .then(([adList, adSettings]) => {
        if (cancelled) return
        setAds(adList)
        setSettings(adSettings)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load advertisements')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const openCreate = () => {
    setForm(blankForm)
    setEditingId('')
    setFormError(null)
  }

  const openEdit = (ad: AdAdmin) => {
    setForm(adToForm(ad))
    setEditingId(ad.id)
    setFormError(null)
  }

  const closeForm = () => {
    setEditingId(null)
    setFormError(null)
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setFormError('Title is required.'); return }
    if (!form.audioUrl.trim()) { setFormError('An audio URL is required.'); return }
    setIsSubmitting(true)
    setFormError(null)
    try {
      const payload = formToPayload(form)
      if (editingId) {
        const updated = await adminAdService.update(editingId, payload)
        setAds((prev) => prev.map((a) => (a.id === editingId ? updated : a)))
        notify.success('Advertisement updated')
      } else {
        const created = await adminAdService.create(payload)
        setAds((prev) => [created, ...prev])
        notify.success('Advertisement created')
      }
      setEditingId(null)
    } catch (err) {
      const serverMsg = (err as { response?: { data?: string | { message?: string } } })?.response?.data
      const msg = typeof serverMsg === 'string' ? serverMsg : serverMsg?.message
      setFormError(msg ?? (err instanceof Error ? err.message : 'Save failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (ad: AdAdmin) => {
    if (!(await confirm({
      title: `Delete "${ad.title}"?`,
      message: 'Free-tier listeners will stop hearing this ad. This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    }))) return
    setActingId(ad.id)
    try {
      await adminAdService.remove(ad.id)
      setAds((prev) => prev.filter((a) => a.id !== ad.id))
      if (editingId === ad.id) closeForm()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setActingId(null)
    }
  }

  const visibleAds = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return ads
    return ads.filter((ad) =>
      ad.title.toLowerCase().includes(q) ||
      (ad.advertiser ?? '').toLowerCase().includes(q)
    )
  }, [ads, debouncedQuery])

  const saveSettings = async () => {
    if (!settings) return
    setSavingSettings(true)
    try {
      const saved = await adminAdService.updateSettings(settings)
      setSettings(saved)
      notify.success('Ad settings saved')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to save ad settings')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Advertisements</h1>
          <p className="text-secondary text-sm mt-1">
            Create and manage the house ads served to free-tier listeners.
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusCircleIcon className="w-5 h-5" />
          New ad
        </Button>
      </div>

      {/* Global serving settings */}
      {settings && (
        <div className="mb-6 rounded-lg border border-elevated/40 bg-surface p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <SpeakerWaveIcon className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-primary">Serving settings</h2>
          </div>
          <p className="text-secondary text-sm mb-4">
            Controls whether ads play at all and how often free accounts hear one.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Ad after every N tracks</span>
              <input
                type="number"
                min={1}
                aria-label="Ads per N tracks"
                value={settings.adsPerNTracks}
                onChange={(e) => setSettings({ ...settings, adsPerNTracks: Math.max(1, Number(e.target.value) || 1) })}
                className={`${inputCls} sm:w-48`}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-primary sm:pb-2.5">
              <input
                type="checkbox"
                checked={settings.isEnabled}
                onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })}
                className="w-4 h-4"
              />
              Ads enabled (serve to free tier)
            </label>
            <div className="sm:ml-auto">
              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? <Spinner size="sm" /> : 'Save settings'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Create / edit form */}
      {editingId !== null && (
        <form
          onSubmit={handleSubmit}
          aria-label={editingId ? 'Edit advertisement' : 'New advertisement'}
          className="mb-6 rounded-lg border border-elevated/40 bg-surface p-4 sm:p-5 flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <MegaphoneIcon className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-primary">{editingId ? 'Edit ad' : 'New ad'}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Title *</span>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} placeholder="Summer sale" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Advertiser</span>
              <input value={form.advertiser} onChange={(e) => set('advertiser', e.target.value)} className={inputCls} placeholder="not-spotify" />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-primary">Audio URL *</span>
            <input value={form.audioUrl} onChange={(e) => set('audioUrl', e.target.value)} className={inputCls} placeholder="https://cdn.example.com/ads/spot.mp3" />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Image URL</span>
              <input value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} className={inputCls} placeholder="https://…/cover.jpg" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Click-through URL</span>
              <input value={form.clickUrl} onChange={(e) => set('clickUrl', e.target.value)} className={inputCls} placeholder="https://advertiser.example.com" />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Duration (s)</span>
              <input type="number" min={0} value={form.durationSeconds} onChange={(e) => set('durationSeconds', e.target.value)} className={inputCls} placeholder="30" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Country</span>
              <input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls} placeholder="US" maxLength={2} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Weight</span>
              <input type="number" min={1} value={form.weight} onChange={(e) => set('weight', e.target.value)} className={inputCls} />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-primary self-end pb-2.5">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4" />
              Active
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Starts at</span>
              <input type="datetime-local" aria-label="Starts at" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">Ends at</span>
              <input type="datetime-local" aria-label="Ends at" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} className={inputCls} />
            </label>
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
              <p className="text-red-400 text-sm">{formError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" /> : editingId ? 'Save changes' : 'Create ad'}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by title or advertiser…"
        className="mb-4 max-w-md"
        ariaLabel="Search advertisements"
      />

      {/* Ad list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-surface rounded-lg border border-elevated/40 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-secondary border-b border-elevated/40">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Advertiser</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Weight</th>
                <th className="px-4 py-3">Impressions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleAds.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-secondary">
                  {debouncedQuery.trim() ? 'No results found.' : 'No advertisements yet.'}
                </td></tr>
              )}
              {visibleAds.map((ad) => (
                <tr key={ad.id} className="border-b border-elevated/20 hover:bg-elevated/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-primary font-medium">{ad.title}</span>
                  </td>
                  <td className="px-4 py-3 text-secondary text-sm">{ad.advertiser || '—'}</td>
                  <td className="px-4 py-3">
                    {ad.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400">
                        <CheckCircleIcon className="w-4 h-4" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                        <XCircleIcon className="w-4 h-4" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary text-sm">{ad.country ?? 'All'}</td>
                  <td className="px-4 py-3 text-secondary text-sm">{ad.weight}</td>
                  <td className="px-4 py-3 text-secondary text-sm">{ad.impressionCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2 items-center justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(ad)}>
                        <PencilSquareIcon className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(ad)} disabled={actingId === ad.id}>
                        {actingId === ad.id ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
