import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  MicrophoneIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { EpisodeMenu } from '@/components/cards/EpisodeMenu'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SearchInput } from '@/components/common/SearchInput'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useConfirm } from '@/hooks/useConfirm'
import { useDebounce } from '@/hooks/useDebounce'
import {
  artistMediaService,
  type ArtistEpisodeUpdatePayload,
  type ArtistEpisodeUploadPayload,
  type ArtistPodcastPayload,
} from '@/services/artistMediaService'
import type { Episode, Podcast } from '@/types/podcast'
import { notify } from '@/utils/toast'

interface Props {
  disabled?: boolean
}

const emptyPodcast = (): ArtistPodcastPayload => ({ title: '', description: '', category: '' })
const emptyEpisode = () => ({
  title: '',
  description: '',
  durationSeconds: 1800,
  episodeNumber: 1,
  explicit: false,
  publishedAt: '',
  file: null as File | null,
  image: null as File | null,
})

function fmtDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function toDateInput(iso: string) {
  return iso.slice(0, 10)
}

export function ArtistPodcastManager({ disabled = false }: Props) {
  const confirm = useConfirm()
  const [podcasts, setPodcasts] = useState<Podcast[] | null>(null)
  const [resubmittingPodcastId, setResubmittingPodcastId] = useState<string | null>(null)
  const [resubmittingEpisodeId, setResubmittingEpisodeId] = useState<string | null>(null)
  const [showQuery, setShowQuery] = useState('')
  const debouncedShowQuery = useDebounce(showQuery, 200)
  const [episodeQuery, setEpisodeQuery] = useState('')
  const debouncedEpisodeQuery = useDebounce(episodeQuery, 200)
  const [showForm, setShowForm] = useState(false)
  const [editingPodcastId, setEditingPodcastId] = useState<string | null>(null)
  const [podcastForm, setPodcastForm] = useState<ArtistPodcastPayload>(emptyPodcast())
  const [savingPodcast, setSavingPodcast] = useState(false)

  const [selectedPodcastId, setSelectedPodcastId] = useState<string | null>(null)
  const [episodeForm, setEpisodeForm] = useState(emptyEpisode())
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null)
  const [episodeEdit, setEpisodeEdit] = useState({
    title: '',
    description: '',
    durationSeconds: 0,
    episodeNumber: 1,
    explicit: false,
    publishedAt: '',
  })
  const [savingEpisode, setSavingEpisode] = useState(false)

  useEffect(() => {
    let cancelled = false
    artistMediaService.listPodcasts()
      .then((items) => {
        if (cancelled) return
        setPodcasts(items)
        setSelectedPodcastId((cur) => cur ?? items[0]?.id ?? null)
      })
      .catch(() => {
        if (!cancelled) setPodcasts([])
      })
    return () => { cancelled = true }
  }, [])

  const selectedPodcast = useMemo(
    () => podcasts?.find((p) => p.id === selectedPodcastId) ?? podcasts?.[0] ?? null,
    [podcasts, selectedPodcastId],
  )

  const visiblePodcasts = useMemo(() => {
    const q = debouncedShowQuery.trim().toLowerCase()
    if (!q) return podcasts ?? []
    return (podcasts ?? []).filter((p) => p.title.toLowerCase().includes(q))
  }, [podcasts, debouncedShowQuery])

  const visibleEpisodes = useMemo(() => {
    const episodes = selectedPodcast?.episodes ?? []
    const q = debouncedEpisodeQuery.trim().toLowerCase()
    const filtered = q ? episodes.filter((e) => e.title.toLowerCase().includes(q)) : episodes
    return filtered.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  }, [selectedPodcast, debouncedEpisodeQuery])

  useEffect(() => {
    if (!selectedPodcast) return
    const nextNumber = Math.max(0, ...selectedPodcast.episodes.map((e) => e.episodeNumber)) + 1
    setEpisodeForm((cur) => ({ ...cur, episodeNumber: nextNumber }))
  }, [selectedPodcast?.id, selectedPodcast?.episodes.length])

  const openCreatePodcast = () => {
    setPodcastForm(emptyPodcast())
    setEditingPodcastId(null)
    setShowForm(true)
  }

  const openEditPodcast = (podcast: Podcast) => {
    setPodcastForm({
      title: podcast.title,
      description: podcast.description ?? '',
      category: podcast.category ?? '',
    })
    setEditingPodcastId(podcast.id)
    setShowForm(true)
  }

  const savePodcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    if (!podcastForm.title.trim()) {
      notify.error('Show title is required.')
      return
    }
    setSavingPodcast(true)
    try {
      const payload = {
        title: podcastForm.title.trim(),
        description: podcastForm.description?.trim() || null,
        category: podcastForm.category?.trim() || null,
      }
      const saved = editingPodcastId
        ? await artistMediaService.updatePodcast(editingPodcastId, payload)
        : await artistMediaService.createPodcast(payload)
      setPodcasts((cur) => {
        const list = cur ?? []
        return editingPodcastId ? list.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...list]
      })
      setSelectedPodcastId(saved.id)
      setShowForm(false)
      notify.success(editingPodcastId ? 'Show updated.' : 'Show created.')
    } catch {
      notify.error('Could not save this show.')
    } finally {
      setSavingPodcast(false)
    }
  }

  const deletePodcast = async (podcast: Podcast) => {
    if (disabled) return
    const ok = await confirm({
      title: 'Delete this show?',
      message: `${podcast.title} and its episodes will be removed from the podcast catalogue.`,
      confirmText: 'Delete show',
      danger: true,
    })
    if (!ok) return
    try {
      await artistMediaService.deletePodcast(podcast.id)
      setPodcasts((cur) => {
        const next = (cur ?? []).filter((p) => p.id !== podcast.id)
        setSelectedPodcastId(next[0]?.id ?? null)
        return next
      })
      notify.success('Show deleted.')
    } catch {
      notify.error('Could not delete this show.')
    }
  }

  const resubmitPodcast = async (podcast: Podcast) => {
    if (disabled) return
    setResubmittingPodcastId(podcast.id)
    try {
      const updated = await artistMediaService.resubmitPodcast(podcast.id)
      setPodcasts((cur) => (cur ?? []).map((p) => (p.id === podcast.id ? updated : p)))
      notify.success('Show resubmitted for review.')
    } catch {
      notify.error('Could not resubmit this show.')
    } finally {
      setResubmittingPodcastId(null)
    }
  }

  const uploadEpisode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || !selectedPodcast) return
    if (!episodeForm.title.trim() || !episodeForm.file) {
      notify.error('Episode title and audio file are required.')
      return
    }
    setUploading(true)
    setUploadProgress(0)
    try {
      const payload: ArtistEpisodeUploadPayload = {
        title: episodeForm.title.trim(),
        description: episodeForm.description.trim() || null,
        durationMs: Math.max(1, Math.round(episodeForm.durationSeconds * 1000)),
        episodeNumber: Math.max(1, episodeForm.episodeNumber),
        explicit: episodeForm.explicit,
        publishedAt: episodeForm.publishedAt ? new Date(`${episodeForm.publishedAt}T00:00:00`).toISOString() : null,
        file: episodeForm.file,
        image: episodeForm.image,
      }
      const created = await artistMediaService.uploadEpisode(selectedPodcast.id, payload, setUploadProgress)
      setPodcasts((cur) => (cur ?? []).map((p) => (
        p.id === selectedPodcast.id ? { ...p, episodes: [created, ...p.episodes] } : p
      )))
      setEpisodeForm({ ...emptyEpisode(), episodeNumber: episodeForm.episodeNumber + 1 })
      notify.success('Episode published.')
    } catch {
      notify.error('Could not upload this episode.')
    } finally {
      setUploading(false)
    }
  }

  const startEditEpisode = (episode: Episode) => {
    setEditingEpisodeId(episode.id)
    setEpisodeEdit({
      title: episode.title,
      description: episode.description ?? '',
      durationSeconds: Math.round(episode.durationMs / 1000),
      episodeNumber: episode.episodeNumber,
      explicit: episode.explicit ?? false,
      publishedAt: toDateInput(episode.publishedAt),
    })
  }

  const saveEpisode = async (episodeId: string) => {
    if (disabled) return
    if (!episodeEdit.title.trim()) {
      notify.error('Episode title is required.')
      return
    }
    setSavingEpisode(true)
    try {
      const payload: ArtistEpisodeUpdatePayload = {
        title: episodeEdit.title.trim(),
        description: episodeEdit.description.trim() || null,
        durationMs: Math.max(1, Math.round(episodeEdit.durationSeconds * 1000)),
        episodeNumber: Math.max(1, episodeEdit.episodeNumber),
        explicit: episodeEdit.explicit,
        publishedAt: episodeEdit.publishedAt ? new Date(`${episodeEdit.publishedAt}T00:00:00`).toISOString() : null,
      }
      const updated = await artistMediaService.updateEpisode(episodeId, payload)
      setPodcasts((cur) => (cur ?? []).map((p) => ({
        ...p,
        episodes: p.episodes.map((ep) => (ep.id === episodeId ? updated : ep)),
      })))
      setEditingEpisodeId(null)
      notify.success('Episode updated.')
    } catch {
      notify.error('Could not update this episode.')
    } finally {
      setSavingEpisode(false)
    }
  }

  const deleteEpisode = async (episode: Episode) => {
    if (disabled) return
    const ok = await confirm({
      title: 'Delete this episode?',
      message: `${episode.title} will be removed from the podcast catalogue.`,
      confirmText: 'Delete episode',
      danger: true,
    })
    if (!ok) return
    try {
      await artistMediaService.deleteEpisode(episode.id)
      setPodcasts((cur) => (cur ?? []).map((p) => ({
        ...p,
        episodes: p.episodes.filter((ep) => ep.id !== episode.id),
      })))
      notify.success('Episode deleted.')
    } catch {
      notify.error('Could not delete this episode.')
    }
  }

  const resubmitEpisode = async (episode: Episode) => {
    if (disabled) return
    setResubmittingEpisodeId(episode.id)
    try {
      const updated = await artistMediaService.resubmitEpisode(episode.id)
      setPodcasts((cur) => (cur ?? []).map((p) => ({
        ...p,
        episodes: p.episodes.map((ep) => (ep.id === episode.id ? updated : ep)),
      })))
      notify.success('Episode resubmitted for review.')
    } catch {
      notify.error('Could not resubmit this episode.')
    } finally {
      setResubmittingEpisodeId(null)
    }
  }

  if (podcasts === null) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Podcasts & shows</h2>
          <p className="text-xs text-secondary">Publish artist-owned shows and episodes directly to the public podcast catalogue.</p>
        </div>
        {!showForm && (
          <Button onClick={openCreatePodcast} disabled={disabled}>
            <PlusCircleIcon className="h-5 w-5" /> New show
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={savePodcast} className="space-y-3 rounded-xl bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-secondary">Show title</span>
              <input
                value={podcastForm.title}
                onChange={(e) => setPodcastForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-secondary">Category</span>
              <input
                value={podcastForm.category ?? ''}
                onChange={(e) => setPodcastForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <label className="text-sm sm:col-span-3">
              <span className="mb-1 block text-secondary">Description</span>
              <textarea
                rows={3}
                value={podcastForm.description ?? ''}
                onChange={(e) => setPodcastForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full resize-none rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={savingPodcast || disabled}>{savingPodcast ? 'Saving...' : editingPodcastId ? 'Save show' : 'Create show'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={savingPodcast}>Cancel</Button>
          </div>
        </form>
      )}

      {podcasts.length === 0 ? (
        <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-secondary">
          No shows yet. Create one, then upload an episode when it is ready.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <SearchInput value={showQuery} onChange={setShowQuery} placeholder="Search shows…" ariaLabel="Search shows" />
            {visiblePodcasts.length === 0 && (
              <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-secondary">No results found.</p>
            )}
            {visiblePodcasts.map((podcast) => (
              <button
                key={podcast.id}
                type="button"
                onClick={() => setSelectedPodcastId(podcast.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${selectedPodcast?.id === podcast.id ? 'bg-accent/15 text-primary' : 'bg-surface text-secondary hover:bg-elevated/70 hover:text-primary'}`}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-elevated">
                  <MicrophoneIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{podcast.title}</p>
                  <p className="text-xs text-muted">{podcast.episodes.length} episodes</p>
                </div>
              </button>
            ))}
          </div>

          {selectedPodcast && (
            <div className="space-y-4">
              <div className="rounded-xl bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-primary">{selectedPodcast.title}</h3>
                      <StatusBadge status={selectedPodcast.status ?? 'approved'} />
                    </div>
                    <p className="mt-1 max-w-2xl text-sm text-secondary">{selectedPodcast.description || 'No description yet.'}</p>
                    {selectedPodcast.category && <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{selectedPodcast.category}</p>}
                    {selectedPodcast.status === 'rejected' && selectedPodcast.reviewNote && (
                      <p className="mt-1 text-xs italic text-red-400">Rejection note: {selectedPodcast.reviewNote}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" onClick={() => openEditPodcast(selectedPodcast)} disabled={disabled} title="Edit show">
                      <PencilSquareIcon className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => deletePodcast(selectedPodcast)} disabled={disabled} title="Delete show">
                      <TrashIcon className="h-4 w-4 text-red-300" />
                    </Button>
                    <Link to={`/podcasts/${selectedPodcast.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:bg-elevated/60 hover:text-primary" title="Open public show">
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </Link>
                    {selectedPodcast.status === 'rejected' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => resubmitPodcast(selectedPodcast)}
                        disabled={disabled || resubmittingPodcastId === selectedPodcast.id}
                      >
                        {resubmittingPodcastId === selectedPodcast.id ? <Spinner size="sm" /> : 'Resubmit for review'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={uploadEpisode} className="space-y-3 rounded-xl bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-primary">Upload episode</h3>
                  {uploading && <span className="text-xs font-semibold text-accent">{uploadProgress}%</span>}
                </div>
                {uploading && <div className="h-1.5 overflow-hidden rounded-full bg-elevated"><div className="h-full bg-accent" style={{ width: `${uploadProgress}%` }} /></div>}
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block text-secondary">Episode title</span>
                    <input
                      value={episodeForm.title}
                      onChange={(e) => setEpisodeForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-secondary">Number</span>
                    <input
                      type="number"
                      min={1}
                      value={episodeForm.episodeNumber}
                      onChange={(e) => setEpisodeForm((f) => ({ ...f, episodeNumber: Number(e.target.value) }))}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-secondary">Duration (auto-detected)</span>
                    <input
                      type="number"
                      min={1}
                      value={episodeForm.durationSeconds}
                      onChange={(e) => setEpisodeForm((f) => ({ ...f, durationSeconds: Number(e.target.value) }))}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block text-secondary">Audio file</span>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm,.weba"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        setEpisodeForm((f) => ({ ...f, file }))
                        if (file) {
                          const audio = new Audio()
                          const url = URL.createObjectURL(file)
                          audio.onloadedmetadata = () => {
                            if (isFinite(audio.duration)) {
                              setEpisodeForm((f) => ({ ...f, durationSeconds: Math.round(audio.duration) }))
                            }
                            URL.revokeObjectURL(url)
                          }
                          audio.src = url
                        }
                      }}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-black"
                      required
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-secondary">Cover art</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setEpisodeForm((f) => ({ ...f, image: e.target.files?.[0] ?? null }))}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-secondary">Release date</span>
                    <input
                      type="date"
                      value={episodeForm.publishedAt}
                      onChange={(e) => setEpisodeForm((f) => ({ ...f, publishedAt: e.target.value }))}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="text-sm md:col-span-4">
                    <span className="mb-1 block text-secondary">Description</span>
                    <textarea
                      rows={2}
                      value={episodeForm.description}
                      onChange={(e) => setEpisodeForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full resize-none rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <input
                      type="checkbox"
                      checked={episodeForm.explicit}
                      onChange={(e) => setEpisodeForm((f) => ({ ...f, explicit: e.target.checked }))}
                      className="h-4 w-4 accent-accent"
                    />
                    Explicit
                  </label>
                </div>
                <Button type="submit" disabled={uploading || disabled}>
                  {uploading ? <Spinner size="sm" /> : <PlusCircleIcon className="h-5 w-5" />}
                  Publish episode
                </Button>
              </form>

              <div className="space-y-2">
                {selectedPodcast.episodes.length > 0 && (
                  <SearchInput value={episodeQuery} onChange={setEpisodeQuery} placeholder="Search episodes…" ariaLabel="Search episodes" />
                )}
                {selectedPodcast.episodes.length === 0 ? (
                  <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-secondary">No episodes for this show yet.</p>
                ) : visibleEpisodes.length === 0 ? (
                  <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-secondary">No results found.</p>
                ) : visibleEpisodes
                  .map((episode) => (
                    <div key={episode.id} className="rounded-xl bg-surface p-4">
                      {editingEpisodeId === episode.id ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-4">
                            <input
                              value={episodeEdit.title}
                              onChange={(e) => setEpisodeEdit((f) => ({ ...f, title: e.target.value }))}
                              className="rounded-lg bg-elevated px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent md:col-span-2"
                            />
                            <input
                              type="number"
                              min={1}
                              value={episodeEdit.episodeNumber}
                              onChange={(e) => setEpisodeEdit((f) => ({ ...f, episodeNumber: Number(e.target.value) }))}
                              className="rounded-lg bg-elevated px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
                            />
                            <input
                              type="number"
                              min={1}
                              value={episodeEdit.durationSeconds}
                              onChange={(e) => setEpisodeEdit((f) => ({ ...f, durationSeconds: Number(e.target.value) }))}
                              className="rounded-lg bg-elevated px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
                            />
                            <input
                              type="date"
                              value={episodeEdit.publishedAt}
                              onChange={(e) => setEpisodeEdit((f) => ({ ...f, publishedAt: e.target.value }))}
                              className="rounded-lg bg-elevated px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
                            />
                            <label className="flex items-center gap-2 text-sm text-secondary">
                              <input
                                type="checkbox"
                                checked={episodeEdit.explicit}
                                onChange={(e) => setEpisodeEdit((f) => ({ ...f, explicit: e.target.checked }))}
                                className="h-4 w-4 accent-accent"
                              />
                              Explicit
                            </label>
                            <textarea
                              rows={2}
                              value={episodeEdit.description}
                              onChange={(e) => setEpisodeEdit((f) => ({ ...f, description: e.target.value }))}
                              className="resize-none rounded-lg bg-elevated px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent md:col-span-4"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEpisode(episode.id)} disabled={savingEpisode || disabled}>
                              <CheckIcon className="h-4 w-4" /> Save
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingEpisodeId(null)} disabled={savingEpisode}>
                              <XMarkIcon className="h-4 w-4" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          {episode.imageUrl ?? selectedPodcast.imageUrl ? (
                            <img src={episode.imageUrl ?? selectedPodcast.imageUrl ?? undefined} alt="" className="h-12 w-12 rounded object-cover" />
                          ) : (
                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-elevated text-secondary">
                              <MicrophoneIcon className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-primary">{episode.title}</p>
                              <StatusBadge status={episode.status ?? 'approved'} />
                              {episode.explicit && <span className="rounded bg-elevated px-1 text-xs font-bold text-secondary">E</span>}
                            </div>
                            <p className="mt-0.5 text-xs text-secondary">
                              Episode {episode.episodeNumber} - {fmtDuration(episode.durationMs)} - {new Date(episode.publishedAt).toLocaleDateString()}
                            </p>
                            {episode.description && <p className="mt-1 line-clamp-2 text-sm text-secondary">{episode.description}</p>}
                            {episode.status === 'rejected' && episode.reviewNote && (
                              <p className="mt-1 text-xs italic text-red-400">Rejection note: {episode.reviewNote}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <EpisodeMenu
                              episode={episode}
                              podcast={{ title: selectedPodcast.title, author: selectedPodcast.author, imageUrl: selectedPodcast.imageUrl }}
                              alwaysVisible
                              triggerClassName="h-9 w-9"
                            />
                            <Button type="button" size="icon" variant="ghost" onClick={() => startEditEpisode(episode)} disabled={disabled} title="Edit episode">
                              <PencilSquareIcon className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={() => deleteEpisode(episode)} disabled={disabled} title="Delete episode">
                              <TrashIcon className="h-4 w-4 text-red-300" />
                            </Button>
                            {episode.status === 'rejected' && (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => resubmitEpisode(episode)}
                                disabled={disabled || resubmittingEpisodeId === episode.id}
                              >
                                {resubmittingEpisodeId === episode.id ? <Spinner size="sm" /> : 'Resubmit'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
