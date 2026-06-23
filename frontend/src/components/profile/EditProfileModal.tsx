import { useEffect, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { CameraIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { ImageCropModal } from '@/components/common/ImageCropModal'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { meService } from '@/services/meService'
import { useAuthStore } from '@/stores/authStore'
import { COUNTRIES } from '@/utils/countries'

export function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center px-4">
        <DialogPanel className="relative w-full max-w-md rounded-lg bg-surface p-6 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 text-secondary transition-colors hover:bg-elevated hover:text-primary"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <DialogTitle className="mb-5 text-2xl font-bold text-primary">Profile details</DialogTitle>
          {/* Mounted fresh while open, so fields initialise from the current user. */}
          <EditProfileForm onClose={onClose} />
        </DialogPanel>
      </div>
    </Dialog>
  )
}

function EditProfileForm({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [country, setCountry] = useState(user?.country ?? 'US')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarCropSource, setAvatarCropSource] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setAvatarPreviewUrl(null)
    })
    if (!avatarFile) {
      return () => { cancelled = true }
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (!cancelled && typeof reader.result === 'string') {
        setAvatarPreviewUrl(reader.result)
      }
    }
    reader.onerror = () => {
      if (!cancelled) setAvatarPreviewUrl(null)
    }
    reader.readAsDataURL(avatarFile)

    return () => {
      cancelled = true
      if (reader.readyState === FileReader.LOADING) reader.abort()
    }
  }, [avatarFile])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let updated = await meService.updateProfile({ name, email, country })
      if (avatarFile) updated = await meService.uploadAvatar(avatarFile)
      setUser(updated)
      onClose()
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string; errors?: string[] } } })?.response?.data
      setError(data?.errors?.join(' ') ?? data?.message ?? 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  const removePhoto = async () => {
    if (avatarFile) {
      setAvatarFile(null)
      return
    }
    setSaving(true)
    setError(null)
    try {
      setUser(await meService.deleteAvatar())
    } catch {
      setError('Could not remove profile picture.')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (file) setAvatarCropSource(file)
  }

  const handleAvatarCropped = (file: File) => {
    setAvatarFile(file)
    setAvatarCropSource(null)
  }

  const inputClass =
    'h-11 rounded-md border border-secondary/20 bg-elevated px-3 text-sm text-primary outline-none transition-colors focus:border-accent'

  return (
    <>
    <form onSubmit={save} className="grid gap-4">
      <div className="flex items-center gap-4">
        <label className="group relative cursor-pointer">
          <Avatar src={avatarPreviewUrl ?? user?.avatarUrl} alt={name} size="xl" round />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <CameraIcon className="h-6 w-6 text-white" />
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleAvatarSelected}
          />
        </label>
        {(user?.avatarUrl || avatarFile) && (
          <button
            type="button"
            onClick={removePhoto}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm font-semibold text-secondary transition-colors hover:text-red-400 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
            Remove photo
          </button>
        )}
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-secondary">Display name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-secondary">Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-secondary">Country</span>
        <select
          value={COUNTRIES.some((c) => c.code === country) ? country : ''}
          onChange={(e) => setCountry(e.target.value)}
          className={inputClass}
          required
        >
          <option value="" disabled>
            Select a country
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-2 flex items-center justify-end gap-3">
        {error && <span className="mr-auto text-sm font-semibold text-red-400">{error}</span>}
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-2 text-sm font-bold text-secondary transition-colors hover:text-primary"
        >
          Cancel
        </button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>

    <ImageCropModal
      file={avatarCropSource}
      aspectRatio={1}
      outputWidth={800}
      title="Crop profile picture"
      onCancel={() => setAvatarCropSource(null)}
      onCrop={handleAvatarCropped}
    />
    </>
  )
}
