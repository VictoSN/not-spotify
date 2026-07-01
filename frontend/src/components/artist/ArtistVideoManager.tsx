import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  FilmIcon,
  LinkIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { VideoMenu } from '@/components/cards/VideoMenu'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SearchInput } from '@/components/common/SearchInput'
import { useConfirm } from '@/hooks/useConfirm'
import { useDebounce } from '@/hooks/useDebounce'
import {
  artistMediaService,
  readVideoDuration,
  type ArtistVideoUpdatePayload,
  type ArtistVideoUploadPayload,
} from '@/services/artistMediaService'
import type { MusicVideo } from '@/types/musicVideo'
import type { Track } from '@/types/track'
import { notify } from '@/utils/toast'

interface Props {
  tracks: Track[]
  disabled?: boolean
}

const emptyForm = () => ({
  title: '',
  description: '',
  durationSeconds: 180,
  trackId: '',
  video: null as File | null,
  thumbnail: null as File | null,
})

function fmtDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function DirectPublishedBadge() {
  return <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-300">Direct published</span>
}

export function ArtistVideoManager({ tracks, disabled = false }: Props) {
  const confirm = useConfirm()
  const [videos, setVideos] = useState<MusicVideo[] | null>(null)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 200)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', trackId: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    let cancelled = false
    artistMediaService.listVideos()
      .then((items) => { if (!cancelled) setVideos(items) })
      .catch(() => { if (!cancelled) setVideos([]) })
    return () => { cancelled = true }
  }, [])

  const trackTitle = useMemo(() => {
    const map = new Map(tracks.map((track) => [track.id, track.title]))
    return (id: string | null) => (id ? map.get(id) ?? 'Linked track' : 'No linked track')
  }, [tracks])

  const visibleVideos = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return videos ?? []
    return (videos ?? []).filter((v) => v.title.toLowerCase().includes(q))
  }, [videos, debouncedQuery])

  const onVideoFile = async (file: File | null) => {
    setForm((cur) => ({ ...cur, video: file }))
    if (!file) return
    const duration = await readVideoDuration(file)
    if (duration) {
      setForm((cur) => ({ ...cur, durationSeconds: Math.max(1, Math.round(duration / 1000)) }))
    }
  }

  const uploadVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    if (!form.title.trim() || !form.video) {
      notify.error('Video title and file are required.')
      return
    }
    setUploading(true)
    setUploadProgress(0)
    try {
      const payload: ArtistVideoUploadPayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        durationMs: Math.max(1, Math.round(form.durationSeconds * 1000)),
        trackId: form.trackId || null,
        video: form.video,
        thumbnail: form.thumbnail,
      }
      const created = await artistMediaService.uploadVideo(payload, setUploadProgress)
      setVideos((cur) => [created, ...(cur ?? [])])
      setForm(emptyForm())
      setShowForm(false)
      notify.success('Music video published.')
    } catch {
      notify.error('Could not upload this video.')
    } finally {
      setUploading(false)
    }
  }

  const startEdit = (video: MusicVideo) => {
    setEditingId(video.id)
    setEditForm({
      title: video.title,
      description: video.description ?? '',
      trackId: video.trackId ?? '',
    })
  }

  const saveEdit = async (video: MusicVideo) => {
    if (disabled) return
    if (!editForm.title.trim()) {
      notify.error('Video title is required.')
      return
    }
    setSavingEdit(true)
    try {
      const payload: ArtistVideoUpdatePayload = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        trackId: editForm.trackId || null,
        clearTrack: !editForm.trackId && Boolean(video.trackId),
      }
      const updated = await artistMediaService.updateVideo(video.id, payload)
      setVideos((cur) => (cur ?? []).map((item) => (item.id === video.id ? updated : item)))
      setEditingId(null)
      notify.success('Video updated.')
    } catch {
      notify.error('Could not update this video.')
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteVideo = async (video: MusicVideo) => {
    if (disabled) return
    const ok = await confirm({
      title: 'Delete this video?',
      message: `${video.title} will be removed from the public music-video catalogue.`,
      confirmText: 'Delete video',
      danger: true,
    })
    if (!ok) return
    try {
      await artistMediaService.deleteVideo(video.id)
      setVideos((cur) => (cur ?? []).filter((item) => item.id !== video.id))
      notify.success('Video deleted.')
    } catch {
      notify.error('Could not delete this video.')
    }
  }

  if (videos === null) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Music videos</h2>
          <p className="text-xs text-secondary">Upload artist-owned videos, optionally link them to one of your approved tracks, and manage the public listing.</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} disabled={disabled}>
            <PlusCircleIcon className="h-5 w-5" /> Upload video
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={uploadVideo} className="space-y-3 rounded-xl bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-primary">New music video</h3>
            {uploading && <span className="text-xs font-semibold text-accent">{uploadProgress}%</span>}
          </div>
          {uploading && <div className="h-1.5 overflow-hidden rounded-full bg-elevated"><div className="h-full bg-accent" style={{ width: `${uploadProgress}%` }} /></div>}
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-secondary">Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm((cur) => ({ ...cur, title: e.target.value }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-secondary">Linked track</span>
              <select
                value={form.trackId}
                onChange={(e) => setForm((cur) => ({ ...cur, trackId: e.target.value }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">None</option>
                {tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-secondary">Duration seconds</span>
              <input
                type="number"
                min={1}
                value={form.durationSeconds}
                onChange={(e) => setForm((cur) => ({ ...cur, durationSeconds: Number(e.target.value) }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-secondary">Video file</span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.mov,.webm"
                onChange={(e) => void onVideoFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-black"
                required
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-secondary">Thumbnail</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setForm((cur) => ({ ...cur, thumbnail: e.target.files?.[0] ?? null }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary"
              />
            </label>
            <label className="text-sm md:col-span-4">
              <span className="mb-1 block text-secondary">Description</span>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((cur) => ({ ...cur, description: e.target.value }))}
                className="w-full resize-none rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={uploading || disabled}>
              {uploading ? <Spinner size="sm" /> : <FilmIcon className="h-5 w-5" />}
              Publish video
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={uploading}>Cancel</Button>
          </div>
        </form>
      )}

      {videos.length > 0 && (
        <SearchInput value={query} onChange={setQuery} placeholder="Search music videos…" className="max-w-md" ariaLabel="Search music videos" />
      )}

      {videos.length === 0 ? (
        <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-secondary">
          No music videos yet. Upload a video to make it available in the public video catalogue.
        </p>
      ) : visibleVideos.length === 0 ? (
        <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-secondary">No results found.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleVideos.map((video) => (
            <div key={video.id} className="rounded-xl bg-surface p-4">
              {editingId === video.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm((cur) => ({ ...cur, title: e.target.value }))}
                      className="rounded-lg bg-elevated px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
                    />
                    <select
                      value={editForm.trackId}
                      onChange={(e) => setEditForm((cur) => ({ ...cur, trackId: e.target.value }))}
                      className="rounded-lg bg-elevated px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">No linked track</option>
                      {tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
                    </select>
                    <textarea
                      rows={2}
                      value={editForm.description}
                      onChange={(e) => setEditForm((cur) => ({ ...cur, description: e.target.value }))}
                      className="resize-none rounded-lg bg-elevated px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent sm:col-span-2"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(video)} disabled={savingEdit || disabled}>
                      <CheckIcon className="h-4 w-4" /> Save
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)} disabled={savingEdit}>
                      <XMarkIcon className="h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="grid aspect-video w-28 shrink-0 place-items-center overflow-hidden rounded bg-elevated">
                    {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <FilmIcon className="h-7 w-7 text-secondary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-primary">{video.title}</p>
                          <DirectPublishedBadge />
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-secondary">
                          <LinkIcon className="h-3.5 w-3.5" /> {trackTitle(video.trackId)} - {fmtDuration(video.durationMs)}
                        </p>
                      </div>
                      <VideoMenu video={video} alwaysVisible triggerClassName="h-9 w-9" />
                    </div>
                    {video.description && <p className="mt-2 line-clamp-2 text-sm text-secondary">{video.description}</p>}
                    <div className="mt-3 flex items-center gap-1">
                      <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(video)} disabled={disabled} title="Edit video">
                        <PencilSquareIcon className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => deleteVideo(video)} disabled={disabled} title="Delete video">
                        <TrashIcon className="h-4 w-4 text-red-300" />
                      </Button>
                      <Link to={`/videos/${video.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:bg-elevated/60 hover:text-primary" title="Open public video">
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
