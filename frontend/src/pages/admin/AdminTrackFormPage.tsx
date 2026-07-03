import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeftIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import type { Artist } from '@/types/artist'
import type { MoodTag } from '@/types/mood'
import { adminService } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { adminPageNarrowClass } from './adminPageLayout'

interface FormValues {
  title: string
  albumId: string
  artistId: string
  trackNumber: number
  discNumber: number
  explicit: boolean
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function AdminTrackFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id

  const [track, setTrack] = useState<Track | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [durationMs, setDurationMs] = useState<number>(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const [moodTags, setMoodTags] = useState<MoodTag[]>([])
  const [selectedMoodIds, setSelectedMoodIds] = useState<Set<string>>(new Set())

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { title: '', albumId: '', artistId: '', trackNumber: 1, discNumber: 1, explicit: false },
  })

  const watchedAlbumId = watch('albumId')

  // When album selection changes, auto-fill artist from that album
  useEffect(() => {
    if (!watchedAlbumId) return
    const album = albums.find((a) => a.id === watchedAlbumId)
    if (album) setValue('artistId', album.artist.id)
  }, [watchedAlbumId, albums, setValue])

  // Load initial data
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [albumList, artistList, existingTrack, allMoodTags, trackMoodTags] = await Promise.all([
          adminService.listAlbums(),
          adminService.listArtists(),
          isEdit && id ? adminService.getTrack(id) : Promise.resolve(null),
          adminService.listMoodTags(),
          isEdit && id ? adminService.getTrackMoodTags(id) : Promise.resolve([]),
        ])
        if (cancelled) return
        setAlbums(albumList)
        setArtists(artistList)
        setMoodTags(allMoodTags)
        setSelectedMoodIds(new Set(trackMoodTags.map((t) => t.id)))
        if (existingTrack) {
          setTrack(existingTrack)
          setDurationMs(existingTrack.durationMs)
          reset({
            title: existingTrack.title,
            albumId: existingTrack.album.id,
            artistId: existingTrack.artist.id,
            trackNumber: existingTrack.trackNumber,
            discNumber: existingTrack.discNumber,
            explicit: existingTrack.explicit,
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

  // Read duration from selected audio file via HTML5 Audio API
  const handleAudioChange = (file: File | null) => {
    setAudioFile(file)
    setDurationMs(0)
    if (!file || !audioRef.current) return
    const url = URL.createObjectURL(file)
    audioRef.current.src = url
    audioRef.current.onloadedmetadata = () => {
      const ms = Math.round((audioRef.current?.duration ?? 0) * 1000)
      setDurationMs(ms)
      URL.revokeObjectURL(url)
    }
  }

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setServerError(null)
    try {
      const payload = {
        title: values.title.trim(),
        albumId: values.albumId,
        artistId: values.artistId,
        durationMs: durationMs || 0,
        trackNumber: values.trackNumber,
        discNumber: values.discNumber,
        explicit: values.explicit,
      }

      let saved: Track
      if (isEdit && track) {
        saved = await adminService.updateTrack(track.id, payload)
      } else {
        saved = await adminService.createTrack(payload)
      }

      if (audioFile) await adminService.uploadTrackAudio(saved.id, audioFile)

      await adminService.setTrackMoodTags(saved.id, [...selectedMoodIds])

      navigate('/admin/tracks')
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
    <div className={adminPageNarrowClass}>
      {/* Hidden audio element for duration detection */}
      <audio ref={audioRef} className="hidden" />

      <Link to="/admin/tracks" className="inline-flex items-center gap-1 text-secondary hover:text-primary text-sm mb-4">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to tracks
      </Link>
      <h1 className="text-3xl font-bold text-primary mb-1">{isEdit ? 'Edit track' : 'New track'}</h1>
      <p className="text-secondary text-sm mb-6">
        {isEdit ? 'Update track details and audio file.' : 'Add a new track to the catalogue.'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Album */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">Album *</label>
          <select
            {...register('albumId', { required: 'Album is required' })}
            className={inputCls}
          >
            <option value="">Select an album…</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>{a.title} — {a.artist.name}</option>
            ))}
          </select>
          {errors.albumId && <p className="text-red-400 text-xs mt-1">{errors.albumId.message}</p>}
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

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">Title *</label>
          <input
            {...register('title', { required: 'Title is required' })}
            className={inputCls}
            placeholder="Ocean Drive"
          />
          {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
        </div>

        {/* Track number + Disc number */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Track number</label>
            <input
              type="number"
              min={1}
              {...register('trackNumber', { valueAsNumber: true, min: 1 })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Disc number</label>
            <input
              type="number"
              min={1}
              {...register('discNumber', { valueAsNumber: true, min: 1 })}
              className={inputCls}
            />
          </div>
        </div>

        {/* Explicit */}
        <label className="inline-flex items-center gap-2 text-sm text-primary">
          <input type="checkbox" {...register('explicit')} className="w-4 h-4" />
          Explicit content
        </label>

        {/* Mood / activity tags */}
        {moodTags.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-primary mb-2">Mood &amp; activity tags</label>
            <p className="text-xs text-secondary mb-2">Powers the Moods &amp; activities browse pages.</p>
            <div className="flex flex-wrap gap-2">
              {moodTags.map((tag) => {
                const selected = selectedMoodIds.has(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setSelectedMoodIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(tag.id)) next.delete(tag.id)
                        else next.add(tag.id)
                        return next
                      })
                    }
                    aria-pressed={selected}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border ${
                      selected
                        ? 'text-white border-transparent'
                        : 'text-secondary border-elevated/60 hover:text-primary hover:border-primary/40'
                    }`}
                    style={selected ? { backgroundColor: tag.color } : undefined}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Audio file */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-2">Audio file (.mp3)</label>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-primary bg-surface hover:bg-elevated">
                <ArrowUpTrayIcon className="w-4 h-4" />
                {audioFile ? 'Change file' : isEdit ? 'Replace audio' : 'Choose file'}
              </span>
              <input
                type="file"
                accept="audio/mpeg,.mp3"
                className="hidden"
                onChange={(e) => handleAudioChange(e.target.files?.[0] ?? null)}
              />
            </label>
            {audioFile && (
              <button type="button" onClick={() => handleAudioChange(null)} className="text-secondary hover:text-primary text-xs">
                Remove
              </button>
            )}
          </div>
          {audioFile && (
            <p className="text-xs text-secondary mt-2">
              {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(1)} MB)
              {durationMs > 0 && <> · Duration: <span className="text-primary">{fmtDuration(durationMs)}</span></>}
              {durationMs === 0 && <> · Reading duration…</>}
            </p>
          )}
          {isEdit && track && !audioFile && track.audioUrl && (
            <p className="text-xs text-secondary mt-2">
              Current audio: <span className="text-primary">{fmtDuration(track.durationMs)}</span>
            </p>
          )}
        </div>

        {serverError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
            <p className="text-red-400 text-sm">{serverError}</p>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" /> : isEdit ? 'Save changes' : 'Create track'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/tracks')} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
