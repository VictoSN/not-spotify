import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeftIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import type { Artist } from '@/types/artist'
import { adminService } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

interface FormValues {
  name: string
  bio: string
  instagram: string
  twitter: string
  website: string
  verified: boolean
}

export function AdminArtistFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id

  const [artist, setArtist] = useState<Artist | null>(null)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [headerFile, setHeaderFile] = useState<File | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: '', bio: '', instagram: '', twitter: '', website: '', verified: false },
  })

  useEffect(() => {
    if (!isEdit || !id) return
    let cancelled = false
    ;(async () => {
      try {
        const a = await adminService.getArtist(id)
        if (cancelled) return
        setArtist(a)
        reset({
          name: a.name,
          bio: a.bio ?? '',
          instagram: a.socialLinks.instagram ?? '',
          twitter: a.socialLinks.twitter ?? '',
          website: a.socialLinks.website ?? '',
          verified: a.verified,
        })
      } catch (err) {
        if (!cancelled) setServerError(err instanceof Error ? err.message : 'Failed to load artist')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, isEdit, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setServerError(null)
    try {
      const payload = {
        name: values.name.trim(),
        bio: values.bio.trim() || null,
        instagram: values.instagram.trim() || null,
        twitter: values.twitter.trim() || null,
        website: values.website.trim() || null,
        verified: values.verified,
      }

      let saved: Artist
      if (isEdit && artist) {
        saved = await adminService.updateArtist(artist.id, payload)
      } else {
        saved = await adminService.createArtist(payload)
      }

      if (profileFile) saved = await adminService.uploadArtistImage(saved.id, profileFile, 'profile')
      if (headerFile) saved = await adminService.uploadArtistImage(saved.id, headerFile, 'header')

      navigate('/admin/artists')
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setServerError(serverMsg ?? (err instanceof Error ? err.message : 'Save failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/admin/artists" className="inline-flex items-center gap-1 text-secondary hover:text-primary text-sm mb-4">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to artists
      </Link>
      <h1 className="text-3xl font-bold text-primary mb-1">{isEdit ? 'Edit artist' : 'New artist'}</h1>
      <p className="text-secondary text-sm mb-6">
        {isEdit ? 'Update artist details and images.' : 'Add a new artist to the catalogue.'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">Name *</label>
          <input
            {...register('name', { required: 'Name is required' })}
            className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-3 text-sm focus:outline-none"
            placeholder="Luna Waves"
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-primary mb-1">Bio</label>
          <textarea
            {...register('bio')}
            rows={4}
            className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-3 text-sm focus:outline-none resize-none"
            placeholder="Indie electronic artist…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Instagram</label>
            <input
              {...register('instagram')}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-3 text-sm focus:outline-none"
              placeholder="lunawaves"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Twitter</label>
            <input
              {...register('twitter')}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-3 text-sm focus:outline-none"
              placeholder="lunawaves"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Website</label>
            <input
              {...register('website')}
              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-3 text-sm focus:outline-none"
              placeholder="https://…"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-primary mt-2">
          <input type="checkbox" {...register('verified')} className="w-4 h-4" />
          Verified artist
        </label>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileField
            label="Profile image"
            current={artist?.imageUrl}
            file={profileFile}
            onChange={setProfileFile}
          />
          <FileField
            label="Header image"
            current={artist?.headerImageUrl}
            file={headerFile}
            onChange={setHeaderFile}
          />
        </div>

        {serverError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
            <p className="text-red-400 text-sm">{serverError}</p>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" /> : isEdit ? 'Save changes' : 'Create artist'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/artists')} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

interface FileFieldProps {
  label: string
  current?: string | null
  file: File | null
  onChange: (f: File | null) => void
}

function FileField({ label, current, file, onChange }: FileFieldProps) {
  const previewUrl = file ? URL.createObjectURL(file) : current

  return (
    <div>
      <label className="block text-sm font-semibold text-primary mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 rounded-md bg-elevated overflow-hidden flex-shrink-0">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-primary bg-surface hover:bg-elevated">
            <ArrowUpTrayIcon className="w-4 h-4" />
            {file ? 'Change file' : 'Choose file'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <button type="button" onClick={() => onChange(null)} className="text-secondary hover:text-primary text-xs">
            Remove
          </button>
        )}
      </div>
      {file && <p className="text-xs text-secondary mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
    </div>
  )
}
