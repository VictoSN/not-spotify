import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeftIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import type { Album } from '@/types/album'
import type { Artist } from '@/types/artist'
import { adminService } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ImageCropModal } from '@/components/common/ImageCropModal'

interface FormValues {
  title: string
  artistId: string
  type: string
  releaseDate: string
  label: string
  copyright: string
}

const ALBUM_TYPES = ['album', 'single', 'ep', 'compilation']

export function AdminAlbumFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id

  const [album, setAlbum] = useState<Album | null>(null)
  const [artists, setArtists] = useState<Artist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverCropSource, setCoverCropSource] = useState<File | null>(null)
  const coverPreviewUrl = useMemo(() => coverFile ? URL.createObjectURL(coverFile) : null, [coverFile])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { title: '', artistId: '', type: 'album', releaseDate: '', label: '', copyright: '' },
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [artistList, existingAlbum] = await Promise.all([
          adminService.listArtists(),
          isEdit && id ? adminService.getAlbum(id) : Promise.resolve(null),
        ])
        if (cancelled) return
        setArtists(artistList)
        if (existingAlbum) {
          setAlbum(existingAlbum)
          reset({
            title: existingAlbum.title,
            artistId: existingAlbum.artist.id,
            type: existingAlbum.type,
            releaseDate: existingAlbum.releaseDate ?? '',
            label: existingAlbum.label ?? '',
            copyright: existingAlbum.copyright ?? '',
          })
        }
      } catch (err) {
        if (!cancelled) setServerError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, isEdit, reset])

  useEffect(() => {
    if (!coverPreviewUrl) return
    return () => URL.revokeObjectURL(coverPreviewUrl)
  }, [coverPreviewUrl])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setServerError(null)
    try {
      const payload = {
        title: values.title.trim(),
        artistId: values.artistId,
        type: values.type,
        releaseDate: values.releaseDate || null,
        label: values.label.trim() || null,
        copyright: values.copyright.trim() || null,
      }

      let saved: Album
      if (isEdit && album) {
        saved = await adminService.updateAlbum(album.id, payload)
      } else {
        saved = await adminService.createAlbum(payload)
      }

      if (coverFile) await adminService.uploadAlbumCover(saved.id, coverFile)

      navigate('/admin/albums')
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

  const inputCls = 'w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-3 text-sm focus:outline-none'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/admin/albums" className="inline-flex items-center gap-1 text-secondary hover:text-primary text-sm mb-4">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to albums
      </Link>
      <h1 className="text-3xl font-bold text-primary mb-1">{isEdit ? 'Edit album' : 'New album'}</h1>
      <p className="text-secondary text-sm mb-6">
        {isEdit ? 'Update album details and cover art.' : 'Add a new album to the catalogue.'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">Title *</label>
          <input
            {...register('title', { required: 'Title is required' })}
            className={inputCls}
            placeholder="Midnight Frequencies"
          />
          {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
        </div>

        {/* Artist */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">Artist *</label>
          <select
            {...register('artistId', { required: 'Artist is required' })}
            className={inputCls}
          >
            <option value="">Select an artist…</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {errors.artistId && <p className="text-red-400 text-xs mt-1">{errors.artistId.message}</p>}
        </div>

        {/* Type + Release date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Type</label>
            <select {...register('type')} className={inputCls}>
              {ALBUM_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Release date</label>
            <input type="date" {...register('releaseDate')} className={inputCls} />
          </div>
        </div>

        {/* Label + Copyright */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Label</label>
            <input {...register('label')} className={inputCls} placeholder="Indie Records" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Copyright</label>
            <input {...register('copyright')} className={inputCls} placeholder="© 2024 Artist" />
          </div>
        </div>

        {/* Cover art */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-2">Cover art</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-md bg-elevated overflow-hidden flex-shrink-0">
              {coverPreviewUrl ? (
                <img src={coverPreviewUrl} alt="" className="w-full h-full object-cover" />
              ) : album?.coverUrl ? (
                <img src={album.coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" />
              )}
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-primary bg-surface hover:bg-elevated">
                <ArrowUpTrayIcon className="w-4 h-4" />
                {coverFile ? 'Change file' : 'Choose file'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0]
                  event.target.value = ''
                  if (selected) setCoverCropSource(selected)
                }}
              />
            </label>
            {coverFile && (
              <button type="button" onClick={() => setCoverFile(null)} className="text-secondary hover:text-primary text-xs">
                Remove
              </button>
            )}
          </div>
          {coverFile && (
            <p className="text-xs text-secondary mt-1">{coverFile.name} ({(coverFile.size / 1024).toFixed(0)} KB)</p>
          )}
        </div>

        {serverError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
            <p className="text-red-400 text-sm">{serverError}</p>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" /> : isEdit ? 'Save changes' : 'Create album'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/albums')} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>

      <ImageCropModal
        file={coverCropSource}
        aspectRatio={1}
        title="Crop cover art"
        onCancel={() => setCoverCropSource(null)}
        onCrop={(cropped) => {
          setCoverFile(cropped)
          setCoverCropSource(null)
        }}
      />
    </div>
  )
}
