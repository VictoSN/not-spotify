import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MusicalNoteIcon, CloudArrowUpIcon, CheckCircleIcon, ClockIcon,
  XCircleIcon, PlusCircleIcon, ChevronDownIcon, ChevronUpIcon,
  PhotoIcon, TrashIcon, Bars3Icon, PencilSquareIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/services/api'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import type { ReviewHistoryEntry } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

const STATUS_CONFIG = {
  approved: { label: 'Live', icon: CheckCircleIcon, cls: 'text-green-400', bg: 'bg-green-500/15' },
  pending: { label: 'Pending', icon: ClockIcon, cls: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  rejected: { label: 'Rejected', icon: XCircleIcon, cls: 'text-red-400', bg: 'bg-red-500/15' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  )
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type AlbumWithTracks = Album & { trackList: Track[] }

export function ArtistDashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [albums, setAlbums] = useState<AlbumWithTracks[]>([])
  const [loading, setLoading] = useState(true)
  const [isRevoked, setIsRevoked] = useState(false)
  const [revocationNote, setRevocationNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Resubmit form state
  const [resubmitAlbumId, setResubmitAlbumId] = useState<string | null>(null)
  const [resubmitTrackId, setResubmitTrackId] = useState<string | null>(null)
  const [resubmitNote, setResubmitNote] = useState('')

  // Review history state
  const [reviewHistory, setReviewHistory] = useState<Record<string, ReviewHistoryEntry[]>>({})
  const [historyOpen, setHistoryOpen] = useState<Set<string>>(new Set())
  const [historyLoading, setHistoryLoading] = useState<Set<string>>(new Set())
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null)

  // Create album form
  const [showAlbumForm, setShowAlbumForm] = useState(false)
  const [albumTitle, setAlbumTitle] = useState('')
  const [albumType, setAlbumType] = useState<'album' | 'single' | 'ep'>('album')
  const [albumReleaseDate, setAlbumReleaseDate] = useState('')
  const [albumLabel, setAlbumLabel] = useState('')
  const [albumCopyright, setAlbumCopyright] = useState('')
  const [albumCoverFile, setAlbumCoverFile] = useState<File | null>(null)
  const [albumCoverPreview, setAlbumCoverPreview] = useState<string | null>(null)
  const [albumSubmitting, setAlbumSubmitting] = useState(false)
  const [albumFormError, setAlbumFormError] = useState<string | null>(null)

  // Pending album edit state
  const [editAlbumId, setEditAlbumId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState<'album' | 'single' | 'ep'>('album')
  const [editReleaseDate, setEditReleaseDate] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editCopyright, setEditCopyright] = useState('')
  const [editAlbumSaving, setEditAlbumSaving] = useState(false)
  const [editAlbumError, setEditAlbumError] = useState<string | null>(null)

  // Drag-to-reorder state
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)

  // Inline track-number edit state
  const [editTrackId, setEditTrackId] = useState<string | null>(null)
  const [editTrackNum, setEditTrackNum] = useState(1)
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null)

  // Add track form (per album)
  const [addingTrackToAlbum, setAddingTrackToAlbum] = useState<string | null>(null)
  const [trackTitle, setTrackTitle] = useState('')
  const [trackNumber, setTrackNumber] = useState(1)
  const [trackExplicit, setTrackExplicit] = useState(false)
  const [trackAudioFile, setTrackAudioFile] = useState<File | null>(null)
  const [trackDuration, setTrackDuration] = useState(0)
  const [trackSubmitting, setTrackSubmitting] = useState(false)
  const [trackFormError, setTrackFormError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isArtist = user?.roles?.includes('Artist')

  useEffect(() => {
    if (!isArtist) navigate('/', { replace: true })
  }, [isArtist, navigate])

  const reload = async () => {
    setLoading(true)
    try {
      const [tracksRes, albumsRes, profileRes] = await Promise.all([
        api.get<Track[]>('/me/artist-tracks'),
        api.get<Album[]>('/me/artist-albums'),
        api.get<{ isRevoked?: boolean; revocationNote?: string | null }>('/me/artist-profile').catch(() => ({ data: {} })),
      ])
      setIsRevoked(profileRes.data.isRevoked ?? false)
      setRevocationNote(profileRes.data.revocationNote ?? null)
      const tracksByAlbum = new Map<string, Track[]>()
      for (const t of tracksRes.data) {
        const list = tracksByAlbum.get(t.album.id) ?? []
        list.push(t)
        tracksByAlbum.set(t.album.id, list)
      }
      const merged: AlbumWithTracks[] = albumsRes.data.map((a) => ({
        ...a,
        trackList: (tracksByAlbum.get(a.id) ?? []).sort(
          (x, y) => x.trackNumber - y.trackNumber,
        ),
      }))
      setAlbums(merged)
      if (merged.length > 0 && !expandedAlbum) setExpandedAlbum(merged[0].id)
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(`Failed to load your releases. (${status ?? 'network'}) ${msg ?? ''}`.trim())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isArtist) reload() }, [isArtist])

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setAlbumCoverFile(file)
    if (albumCoverPreview) URL.revokeObjectURL(albumCoverPreview)
    setAlbumCoverPreview(file ? URL.createObjectURL(file) : null)
  }

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault()
    setAlbumSubmitting(true)
    setAlbumFormError(null)
    try {
      const res = await api.post<Album>('/me/artist-albums', {
        title: albumTitle,
        type: albumType,
        releaseDate: albumReleaseDate || undefined,
        label: albumLabel || undefined,
        copyright: albumCopyright || undefined,
      })
      const albumId = res.data.id
      if (albumCoverFile) {
        const fd = new FormData()
        fd.append('file', albumCoverFile)
        await api.post(`/me/artist-albums/${albumId}/cover`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      setShowAlbumForm(false)
      setAlbumTitle(''); setAlbumType('album'); setAlbumReleaseDate(''); setAlbumLabel(''); setAlbumCopyright('')
      setAlbumCoverFile(null); setAlbumCoverPreview(null)
      await reload()
      setExpandedAlbum(albumId)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setAlbumFormError(msg ?? 'Failed to create release.')
    } finally {
      setAlbumSubmitting(false)
    }
  }

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setTrackAudioFile(file)
    if (!file) { setTrackDuration(0); return }
    const url = URL.createObjectURL(file)
    const audio = new Audio(url)
    audio.addEventListener('loadedmetadata', () => {
      setTrackDuration(Math.round(audio.duration * 1000))
      URL.revokeObjectURL(url)
    })
    audioRef.current = audio
  }

  const handleAddTrack = async (e: React.FormEvent, albumId: string) => {
    e.preventDefault()
    if (!trackAudioFile) { setTrackFormError('Please select an audio file.'); return }
    if (trackDuration < 1) { setTrackFormError('Could not read audio duration. Try again.'); return }

    setTrackSubmitting(true)
    setTrackFormError(null)
    try {
      const trackRes = await api.post<Track>('/me/artist-tracks', {
        title: trackTitle, albumId, durationMs: trackDuration, trackNumber, discNumber: 1, explicit: trackExplicit,
      })
      const fd = new FormData()
      fd.append('file', trackAudioFile)
      await api.post(`/me/artist-tracks/${trackRes.data.id}/audio`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAddingTrackToAlbum(null)
      setTrackTitle(''); setTrackNumber(1); setTrackExplicit(false); setTrackAudioFile(null); setTrackDuration(0)
      await reload()
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setTrackFormError(msg ?? 'Submission failed.')
    } finally {
      setTrackSubmitting(false)
    }
  }

  const handleDeleteAlbum = async (album: AlbumWithTracks) => {
    if (!confirm(`Delete "${album.title}" and all its tracks? This cannot be undone.`)) return
    try {
      await api.delete(`/me/artist-albums/${album.id}`)
      setAlbums((prev) => prev.filter((a) => a.id !== album.id))
      if (expandedAlbum === album.id) setExpandedAlbum(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Failed to delete release.')
    }
  }

  const handleResubmitAlbum = async (album: AlbumWithTracks, note: string) => {
    try {
      const res = await api.post<Album>(`/me/artist-albums/${album.id}/resubmit`, { note: note.trim() || null })
      setAlbums((prev) => prev.map((a) => a.id === album.id ? { ...a, ...res.data, trackList: a.trackList.map((t) => ({ ...t, status: t.status === 'rejected' ? 'pending' : t.status })) } : a))
      setResubmitAlbumId(null)
      setResubmitNote('')
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Failed to resubmit release.')
    }
  }

  const handleResubmitTrack = async (track: Track, albumId: string, note: string) => {
    try {
      const res = await api.post<Track>(`/me/artist-tracks/${track.id}/resubmit`, { note: note.trim() || null })
      setAlbums((prev) => prev.map((a) => a.id === albumId
        ? { ...a, trackList: a.trackList.map((t) => t.id === track.id ? { ...t, ...res.data } : t) }
        : a
      ))
      setResubmitTrackId(null)
      setResubmitNote('')
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Failed to resubmit track.')
    }
  }

  const toggleHistory = async (id: string, kind: 'album' | 'track') => {
    const next = new Set(historyOpen)
    if (next.has(id)) { next.delete(id); setHistoryOpen(next); return }
    next.add(id); setHistoryOpen(next)
    if (reviewHistory[id] !== undefined) return
    setHistoryLoading((s) => new Set(s).add(id))
    try {
      const res = await api.get<ReviewHistoryEntry[]>(
        kind === 'album' ? `/me/artist-albums/${id}/review-history` : `/me/artist-tracks/${id}/review-history`
      )
      setReviewHistory((prev) => ({ ...prev, [id]: res.data }))
    } finally {
      setHistoryLoading((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  const handleDeleteTrack = async (track: Track, albumId: string) => {
    if (!confirm(`Delete "${track.title}"?`)) return
    try {
      await api.delete(`/me/artist-tracks/${track.id}`)
      setAlbums((prev) => prev.map((a) =>
        a.id === albumId ? { ...a, trackList: a.trackList.filter((t) => t.id !== track.id) } : a
      ))
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Failed to delete track.')
    }
  }

  // ── Pending album inline edit ────────────────────────────────────────────────

  const startEditAlbum = (album: AlbumWithTracks, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditAlbumId(album.id)
    setEditTitle(album.title)
    setEditType((album.type as 'album' | 'single' | 'ep') || 'album')
    setEditReleaseDate(album.releaseDate ? String(album.releaseDate) : '')
    setEditLabel(album.label ?? '')
    setEditCopyright(album.copyright ?? '')
    setEditAlbumError(null)
  }

  const handleSaveAlbum = async (e: React.FormEvent, albumId: string) => {
    e.preventDefault()
    setEditAlbumSaving(true)
    setEditAlbumError(null)
    try {
      const res = await api.patch<Album>(`/me/artist-albums/${albumId}`, {
        title: editTitle,
        type: editType,
        releaseDate: editReleaseDate || undefined,
        label: editLabel || undefined,
        copyright: editCopyright || undefined,
      })
      setAlbums((prev) => prev.map((a) => (a.id === albumId ? { ...a, ...res.data } : a)))
      setEditAlbumId(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setEditAlbumError(msg ?? 'Failed to save changes.')
    } finally {
      setEditAlbumSaving(false)
    }
  }

  // ── Drag-to-reorder ──────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, trackId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragId(trackId)
  }

  const handleDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (trackId !== dragId) setDropId(trackId)
  }

  const handleDrop = async (e: React.DragEvent, targetId: string, albumId: string, trackList: Track[]) => {
    e.preventDefault()
    const from = dragId
    setDragId(null)
    setDropId(null)
    if (!from || from === targetId) return

    const fromIdx = trackList.findIndex((t) => t.id === from)
    const toIdx = trackList.findIndex((t) => t.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...trackList]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const updated = reordered.map((t, i) => ({ ...t, trackNumber: i + 1 }))

    // Optimistic UI update
    setAlbums((prev) => prev.map((a) => (a.id === albumId ? { ...a, trackList: updated } : a)))

    // Persist only the track numbers that changed
    for (const t of updated) {
      const orig = trackList.find((x) => x.id === t.id)
      if (orig && orig.trackNumber !== t.trackNumber) {
        try { await api.patch(`/me/artist-tracks/${t.id}`, { trackNumber: t.trackNumber }) }
        catch { /* already reflected in UI */ }
      }
    }
  }

  const handleDragEnd = () => { setDragId(null); setDropId(null) }

  // ── Inline track-number edit ──────────────────────────────────────────────

  const startEditTrackNum = (track: Track) => {
    setEditTrackId(track.id)
    setEditTrackNum(track.trackNumber)
  }

  const commitEditTrackNum = async (track: Track, albumId: string, trackList: Track[]) => {
    setEditTrackId(null)
    if (editTrackNum === track.trackNumber) return
    const clamped = Math.max(1, Math.min(trackList.length, editTrackNum))
    setSavingTrackId(track.id)
    try {
      await api.patch(`/me/artist-tracks/${track.id}`, { trackNumber: clamped })
      setAlbums((prev) => prev.map((a) => {
        if (a.id !== albumId) return a
        const updated = a.trackList
          .map((t) => (t.id === track.id ? { ...t, trackNumber: clamped } : t))
          .sort((x, y) => x.trackNumber - y.trackNumber)
        return { ...a, trackList: updated }
      }))
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Failed to update track number.')
    } finally {
      setSavingTrackId(null)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  const openTrackForm = (albumId: string, trackCount: number) => {
    setAddingTrackToAlbum(albumId)
    setTrackNumber(trackCount + 1)
    setTrackTitle(''); setTrackExplicit(false); setTrackAudioFile(null); setTrackDuration(0); setTrackFormError(null)
    setExpandedAlbum(albumId)
  }

  if (!isArtist) return null

  return (
    <div>
      {isRevoked && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-4">
          <p className="font-semibold text-red-400">Your artist account has been revoked.</p>
          <p className="text-sm text-red-400/80 mt-0.5">
            You cannot submit or resubmit content. Contact support to appeal.
          </p>
          {revocationNote && (
            <p className="text-sm text-red-400/70 italic mt-1">Admin note: {revocationNote}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">Artist Dashboard</h1>
          <p className="text-secondary text-sm mt-1">Submit albums and tracks for admin review. Approved releases go live.</p>
        </div>
        {!isRevoked && (
          <Button onClick={() => { setShowAlbumForm((v) => !v); setAlbumFormError(null) }}>
            <PlusCircleIcon className="w-5 h-5" />
            {showAlbumForm ? 'Cancel' : 'New release'}
          </Button>
        )}
      </div>

      {/* Create album form */}
      {showAlbumForm && (
        <form onSubmit={handleCreateAlbum} className="bg-surface border border-elevated/40 rounded-lg p-6 mb-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-primary">New release</h2>

          <div className="flex gap-4">
            {/* Cover preview */}
            <label className="shrink-0 cursor-pointer">
              <div className="w-24 h-24 rounded-lg bg-elevated border border-elevated/50 flex items-center justify-center overflow-hidden hover:border-accent transition-colors">
                {albumCoverPreview ? (
                  <img src={albumCoverPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <PhotoIcon className="w-8 h-8 text-muted" />
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
              <p className="text-xs text-muted mt-1 text-center">Cover art</p>
            </label>

            <div className="flex-1 flex flex-col gap-3">
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Title</label>
                <input
                  required
                  value={albumTitle}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                  className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-2.5 text-sm focus:outline-none"
                  placeholder="Album or single title"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Type</label>
                <select
                  value={albumType}
                  onChange={(e) => setAlbumType(e.target.value as 'album' | 'single' | 'ep')}
                  className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-2.5 text-sm focus:outline-none"
                >
                  <option value="album">Album</option>
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Release date <span className="text-muted font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={albumReleaseDate}
                  onChange={(e) => setAlbumReleaseDate(e.target.value)}
                  className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-2.5 text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-primary mb-1">Label <span className="text-muted font-normal">(optional)</span></label>
              <input
                value={albumLabel}
                onChange={(e) => setAlbumLabel(e.target.value)}
                className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-2.5 text-sm focus:outline-none"
                placeholder="Record label"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-primary mb-1">Copyright <span className="text-muted font-normal">(optional)</span></label>
              <input
                value={albumCopyright}
                onChange={(e) => setAlbumCopyright(e.target.value)}
                className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-4 py-2.5 text-sm focus:outline-none"
                placeholder="© 2024 Artist Name"
              />
            </div>
          </div>

          {albumFormError && <p className="text-sm text-red-400">{albumFormError}</p>}

          <Button type="submit" disabled={albumSubmitting} className="self-start">
            {albumSubmitting ? <Spinner size="sm" /> : <CloudArrowUpIcon className="w-4 h-4" />}
            {albumSubmitting ? 'Creating…' : 'Create release'}
          </Button>
        </form>
      )}

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : albums.length === 0 ? (
        <div className="bg-surface border border-elevated/40 rounded-lg px-6 py-12 text-center">
          <MusicalNoteIcon className="w-10 h-10 text-secondary mx-auto mb-3" />
          <p className="text-secondary text-sm">No releases yet. Hit "New release" to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {albums.map((album) => {
            const isOpen = expandedAlbum === album.id
            const addingHere = addingTrackToAlbum === album.id

            return (
              <div key={album.id} className="bg-surface border border-elevated/40 rounded-lg overflow-hidden">
                {/* Album header */}
                <button
                  type="button"
                  onClick={() => setExpandedAlbum(isOpen ? null : album.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-elevated/30 transition-colors text-left"
                >
                  {album.coverUrl ? (
                    <img src={album.coverUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-elevated shrink-0 flex items-center justify-center">
                      <MusicalNoteIcon className="w-5 h-5 text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-primary">{album.title}</span>
                      <span className="text-xs text-secondary capitalize px-1.5 py-0.5 rounded bg-elevated">
                        {album.type}
                      </span>
                      <StatusBadge status={album.status ?? 'approved'} />
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {album.trackList.length} track{album.trackList.length !== 1 ? 's' : ''}
                    </p>
                    {album.reviewNote && (
                      <p className={`text-xs mt-1 px-2 py-1 rounded italic ${album.status === 'rejected'
                          ? 'bg-red-500/10 text-red-400'
                          : album.status === 'approved'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                        {album.status === 'rejected' ? 'Rejection note' : album.status === 'approved' ? 'Approval note' : 'Previous rejection'}: {album.reviewNote}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleHistory(album.id, 'album') }}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors"
                    >
                      <ClockIcon className="w-3.5 h-3.5" />
                      {historyOpen.has(album.id) ? 'Hide history' : 'Review history'}
                    </button>
                  </div>
                  {album.status !== 'approved' && (
                    <>
                      {album.status === 'rejected' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setResubmitAlbumId(resubmitAlbumId === album.id ? null : album.id); setResubmitNote('') }}
                          className={`p-1.5 rounded transition-colors shrink-0 ${resubmitAlbumId === album.id ? 'bg-green-500/20 text-green-400' : 'hover:bg-green-500/20 text-muted hover:text-green-400'}`}
                          title="Resubmit for review"
                        >
                          <ArrowPathIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => startEditAlbum(album, e)}
                        className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors shrink-0"
                        title="Edit release"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteAlbum(album) }}
                        className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors shrink-0"
                        title="Delete release"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {isOpen ? (
                    <ChevronUpIcon className="w-4 h-4 text-secondary shrink-0" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4 text-secondary shrink-0" />
                  )}
                </button>

                {/* Inline album edit form */}
                {editAlbumId === album.id && (
                  <form
                    onSubmit={(e) => handleSaveAlbum(e, album.id)}
                    className="border-t border-elevated/40 p-4 flex flex-col gap-3 bg-elevated/10"
                  >
                    <p className="text-sm font-semibold text-primary">Edit release</p>
                    {editAlbumError && (
                      <p className="text-xs text-red-400">{editAlbumError}</p>
                    )}
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex-1 min-w-[160px]">
                        <label className="block text-xs font-semibold text-primary mb-1">Title</label>
                        <input
                          required
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs font-semibold text-primary mb-1">Type</label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as 'album' | 'single' | 'ep')}
                          className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-3 py-2 text-sm focus:outline-none"
                        >
                          <option value="album">Album</option>
                          <option value="single">Single</option>
                          <option value="ep">EP</option>
                        </select>
                      </div>
                      <div className="w-40">
                        <label className="block text-xs font-semibold text-primary mb-1">Release date</label>
                        <input
                          type="date"
                          value={editReleaseDate}
                          onChange={(e) => setEditReleaseDate(e.target.value)}
                          className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex-1 min-w-[160px]">
                        <label className="block text-xs font-semibold text-primary mb-1">Label</label>
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Record label"
                          className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <label className="block text-xs font-semibold text-primary mb-1">Copyright</label>
                        <input
                          value={editCopyright}
                          onChange={(e) => setEditCopyright(e.target.value)}
                          placeholder="© 2025 Artist Name"
                          className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditAlbumId(null)}
                        disabled={editAlbumSaving}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={editAlbumSaving}>
                        {editAlbumSaving ? <Spinner size="sm" /> : 'Save changes'}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Inline resubmit form */}
                {resubmitAlbumId === album.id && (
                  <div className="border-t border-elevated/40 p-4 flex flex-col gap-3 bg-green-500/5">
                    <p className="text-sm font-semibold text-green-400">Resubmit for review</p>
                    <textarea
                      autoFocus
                      rows={2}
                      value={resubmitNote}
                      onChange={(e) => setResubmitNote(e.target.value)}
                      placeholder="Optional message to the admin (what you changed, why it should be approved…)"
                      className="w-full bg-elevated border border-elevated/50 focus:border-green-400/60 text-primary placeholder:text-muted rounded px-3 py-2 text-sm resize-none focus:outline-none transition-colors"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setResubmitAlbumId(null); setResubmitNote('') }}
                        className="px-3 py-1.5 rounded text-sm font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResubmitAlbum(album, resubmitNote)}
                        className="px-3 py-1.5 rounded text-sm font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors"
                      >
                        Resubmit
                      </button>
                    </div>
                  </div>
                )}

                {/* Album review history panel */}
                {historyOpen.has(album.id) && (
                  <div className="border-t border-elevated/40 px-4 py-3 bg-elevated/5">
                    {historyLoading.has(album.id) ? (
                      <div className="flex items-center gap-1.5 text-xs text-secondary">
                        <Spinner size="sm" /> Loading…
                      </div>
                    ) : !reviewHistory[album.id] || reviewHistory[album.id].length === 0 ? (
                      <p className="text-xs text-muted italic">No review history yet.</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Album review history</p>
                        {reviewHistory[album.id].map((h) => (
                          <div key={h.id} className={`flex items-start gap-2 text-xs rounded px-2 py-1.5 ${h.action === 'rejected' ? 'bg-red-500/10' : h.action === 'resubmitted' ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
                            <span className={`font-semibold capitalize shrink-0 ${h.action === 'rejected' ? 'text-red-400' : h.action === 'resubmitted' ? 'text-amber-400' : 'text-green-400'}`}>{h.action}</span>
                            <span className="text-muted shrink-0">{new Date(h.reviewedAt).toLocaleString()}{h.reviewedByName && ` · ${h.reviewedByName}`}</span>
                            {h.note && <span className="text-secondary italic">— {h.note}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded: track list + add track */}
                {isOpen && (
                  <div className="border-t border-elevated/40">
                    {album.trackList.length > 0 && (
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wider text-secondary border-b border-elevated/20">
                            <th className="px-2 py-2 w-7"></th>{/* drag handle */}
                            <th className="px-2 py-2 w-10">#</th>
                            <th className="px-4 py-2">Title</th>
                            <th className="px-4 py-2">Duration</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {album.trackList.map((t) => {
                            const canEdit = t.status !== 'approved'
                            const isDragging = dragId === t.id
                            const isDropTarget = dropId === t.id && dragId !== t.id
                            return (
                              <React.Fragment key={t.id}>
                                <tr
                                  draggable={canEdit}
                                  onDragStart={(e) => canEdit && handleDragStart(e, t.id)}
                                  onDragOver={(e) => canEdit && handleDragOver(e, t.id)}
                                  onDrop={(e) => handleDrop(e, t.id, album.id, album.trackList)}
                                  onDragEnd={handleDragEnd}
                                  className={`border-b border-elevated/10 transition-colors ${isDropTarget ? 'bg-accent/10 border-t-2 border-t-accent'
                                      : isDragging ? 'opacity-40 bg-elevated/30'
                                        : 'hover:bg-elevated/20'
                                    }`}
                                >
                                  {/* Drag handle */}
                                  <td className="px-2 py-2.5 w-7">
                                    {canEdit && (
                                      <span className="cursor-grab active:cursor-grabbing text-muted hover:text-secondary transition-colors">
                                        <Bars3Icon className="w-4 h-4" />
                                      </span>
                                    )}
                                  </td>

                                  {/* Track number — click to edit inline */}
                                  <td className="px-2 py-2.5 w-10">
                                    {editTrackId === t.id ? (
                                      <input
                                        type="number"
                                        min={1}
                                        max={album.trackList.length}
                                        value={editTrackNum}
                                        onChange={(e) => setEditTrackNum(Number(e.target.value))}
                                        onBlur={() => commitEditTrackNum(t, album.id, album.trackList)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') commitEditTrackNum(t, album.id, album.trackList)
                                          if (e.key === 'Escape') setEditTrackId(null)
                                        }}
                                        autoFocus
                                        className="w-10 bg-elevated border border-accent text-primary text-sm text-center rounded px-1 py-0.5 focus:outline-none"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={() => canEdit && startEditTrackNum(t)}
                                        title={canEdit ? 'Click to edit track number' : undefined}
                                        className={`text-sm w-7 text-center rounded px-1 py-0.5 transition-colors ${canEdit ? 'text-secondary hover:text-primary hover:bg-elevated/60 cursor-text' : 'text-secondary cursor-default'}`}
                                      >
                                        {savingTrackId === t.id ? <Spinner size="sm" /> : t.trackNumber}
                                      </button>
                                    )}
                                  </td>

                                  <td className="px-4 py-2.5">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-primary text-sm font-medium">{t.title}</span>
                                        {t.explicit && (
                                          <span className="text-xs px-1 py-0.5 rounded bg-elevated text-secondary font-mono">E</span>
                                        )}
                                      </div>
                                      {t.reviewNote && (
                                        <span className={`text-xs italic ${t.status === 'rejected'
                                            ? 'text-red-400'
                                            : t.status === 'approved'
                                              ? 'text-green-400'
                                              : 'text-amber-400'
                                          }`}>
                                          {t.status === 'rejected' ? 'Rejection note' : t.status === 'approved' ? 'Approval note' : 'Previous rejection'}: {t.reviewNote}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleHistory(t.id, 'track') }}
                                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors w-fit"
                                      >
                                        <ClockIcon className="w-3 h-3" />
                                        {historyOpen.has(t.id) ? 'Hide history' : 'History'}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-secondary text-sm">{fmtDuration(t.durationMs)}</td>
                                  <td className="px-4 py-2.5"><StatusBadge status={t.status ?? 'pending'} /></td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex gap-1 items-center">
                                      {t.status === 'rejected' && (
                                        <button
                                          type="button"
                                          onClick={() => { setResubmitTrackId(resubmitTrackId === t.id ? null : t.id); setResubmitNote('') }}
                                          className={`p-1 rounded transition-colors ${resubmitTrackId === t.id ? 'bg-green-500/20 text-green-400' : 'hover:bg-green-500/20 text-muted hover:text-green-400'}`}
                                          title="Resubmit for review"
                                        >
                                          <ArrowPathIcon className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTrack(t, album.id)}
                                          className="p-1 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"
                                          title="Delete track"
                                        >
                                          <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {/* Inline track resubmit form */}
                                {resubmitTrackId === t.id && (
                                  <tr className="border-b border-elevated/20 bg-green-500/5">
                                    <td colSpan={5} className="px-4 py-3">
                                      <div className="flex flex-col gap-2 max-w-lg">
                                        <p className="text-xs font-semibold text-green-400">Resubmit track for review</p>
                                        <textarea
                                          autoFocus
                                          rows={2}
                                          value={resubmitNote}
                                          onChange={(e) => setResubmitNote(e.target.value)}
                                          placeholder="Optional message (what you changed…)"
                                          className="w-full bg-elevated border border-elevated/50 focus:border-green-400/60 text-primary placeholder:text-muted rounded px-3 py-2 text-xs resize-none focus:outline-none transition-colors"
                                        />
                                        <div className="flex gap-2">
                                          <button type="button" onClick={() => { setResubmitTrackId(null); setResubmitNote('') }}
                                            className="px-3 py-1 rounded text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors">
                                            Cancel
                                          </button>
                                          <button type="button" onClick={() => handleResubmitTrack(t, album.id, resubmitNote)}
                                            className="px-3 py-1 rounded text-xs font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors">
                                            Resubmit
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {/* Track review history panel */}
                                {historyOpen.has(t.id) && (
                                  <tr className="border-b border-elevated/20 bg-elevated/5">
                                    <td colSpan={6} className="px-4 py-2">
                                      {historyLoading.has(t.id) ? (
                                        <div className="flex items-center gap-1.5 text-xs text-secondary">
                                          <Spinner size="sm" /> Loading…
                                        </div>
                                      ) : !reviewHistory[t.id] || reviewHistory[t.id].length === 0 ? (
                                        <p className="text-xs text-muted italic">No review history yet.</p>
                                      ) : (
                                        <div className="flex flex-col gap-1">
                                          <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Track review history</p>
                                          {reviewHistory[t.id].map((h) => (
                                            <div key={h.id} className={`flex items-start gap-2 text-xs rounded px-2 py-1.5 ${h.action === 'rejected' ? 'bg-red-500/10' : h.action === 'resubmitted' ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
                                              <span className={`font-semibold capitalize shrink-0 ${h.action === 'rejected' ? 'text-red-400' : h.action === 'resubmitted' ? 'text-amber-400' : 'text-green-400'}`}>{h.action}</span>
                                              <span className="text-muted shrink-0">{new Date(h.reviewedAt).toLocaleString()}{h.reviewedByName && ` · ${h.reviewedByName}`}</span>
                                              {h.note && <span className="text-secondary italic">— {h.note}</span>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    )}

                    {/* Add track form */}
                    {addingHere ? (
                      <form
                        onSubmit={(e) => handleAddTrack(e, album.id)}
                        className="p-4 flex flex-col gap-3 border-t border-elevated/20"
                      >
                        <p className="text-sm font-semibold text-primary">Add track</p>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-primary mb-1">Title</label>
                            <input
                              required
                              value={trackTitle}
                              onChange={(e) => setTrackTitle(e.target.value)}
                              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-3 py-2 text-sm focus:outline-none"
                              placeholder="Track title"
                            />
                          </div>
                          <div className="w-20">
                            <label className="block text-xs font-semibold text-primary mb-1">Track #</label>
                            <input
                              type="number"
                              min={1}
                              max={album.trackList.length + 1}
                              value={trackNumber}
                              onChange={(e) => setTrackNumber(Number(e.target.value))}
                              className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="block text-xs font-semibold text-primary">Audio file</label>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleAudioChange}
                            className="text-xs text-secondary file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-dark"
                          />
                          {trackDuration > 0 && (
                            <span className="text-xs text-muted">{fmtDuration(trackDuration)}</span>
                          )}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={trackExplicit}
                            onChange={(e) => setTrackExplicit(e.target.checked)}
                            className="accent-accent w-4 h-4"
                          />
                          <span className="text-sm text-primary">Explicit</span>
                        </label>
                        {trackFormError && <p className="text-xs text-red-400">{trackFormError}</p>}
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={trackSubmitting}>
                            {trackSubmitting ? <Spinner size="sm" /> : <CloudArrowUpIcon className="w-4 h-4" />}
                            {trackSubmitting ? 'Submitting…' : 'Submit track'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setAddingTrackToAlbum(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openTrackForm(album.id, album.trackList.length)}
                          className="flex items-center gap-2 text-sm text-accent hover:text-accent-dark font-semibold transition-colors"
                        >
                          <PlusCircleIcon className="w-4 h-4" />
                          Add track
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
