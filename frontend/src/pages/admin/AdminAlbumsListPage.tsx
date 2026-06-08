import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusCircleIcon, PencilSquareIcon, TrashIcon,
  CheckCircleIcon, XCircleIcon, ChevronDownIcon, ChevronUpIcon,
  PlayIcon, StopCircleIcon, ArrowDownTrayIcon, ChevronRightIcon, Bars3Icon,
} from '@heroicons/react/24/outline'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { adminService } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ReviewNoteForm } from '@/components/admin/ReviewNoteForm'

type Tab = 'pending' | 'approved' | 'rejected' | 'all'

type SortDir = 'asc' | 'desc'
type ArtistSort = { field: 'name' | 'albums'; dir: SortDir }
type AlbumSort  = { field: 'title' | 'releaseDate' | 'type' | 'status'; dir: SortDir }
type TrackSort  = { field: 'trackNumber' | 'title' | 'duration' | 'status'; dir: SortDir }

interface ArtistGroup {
  id: string
  name: string
  imageUrl?: string | null
  albums: Album[]
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function cmp<T>(a: T, b: T, dir: SortDir): number {
  if (a < b) return dir === 'asc' ? -1 : 1
  if (a > b) return dir === 'asc' ? 1 : -1
  return 0
}

function SortTh({
  label, active, dir, onClick, className = '',
}: {
  label: string; active: boolean; dir: SortDir; onClick: () => void; className?: string
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition-colors hover:text-primary ${active ? 'text-accent' : 'text-secondary'} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}>
          {dir === 'asc' ? '↑' : '↓'}
        </span>
      </span>
    </th>
  )
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = status ?? 'approved'
  const cls =
    s === 'approved' ? 'bg-green-500/15 text-green-400' :
    s === 'pending'  ? 'bg-yellow-500/15 text-yellow-400' :
    s === 'rejected' ? 'bg-red-500/15 text-red-400' :
    'bg-elevated text-secondary'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold capitalize ${cls}`}>
      {s}
    </span>
  )
}

export function AdminAlbumsListPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('pending')
  const [albums, setAlbums] = useState<Album[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  // Expansion state
  const [openArtists, setOpenArtists] = useState<Set<string>>(new Set())
  const [openAlbums, setOpenAlbums] = useState<Set<string>>(new Set())
  const [trackCache, setTrackCache] = useState<Map<string, Track[] | 'loading' | 'error'>>(new Map())
  const [playingId, setPlayingId] = useState<string | null>(null)

  // Review-with-note state (shared for album and track reviews)
  type PendingReview = { id: string; kind: 'album' | 'track'; action: 'approve' | 'reject'; note: string; saving: boolean }
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)

  // Drag-to-reorder state
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)

  // Sort state
  const [artistSort, setArtistSort] = useState<ArtistSort>({ field: 'name', dir: 'asc' })
  const [albumSort, setAlbumSort] = useState<AlbumSort>({ field: 'releaseDate', dir: 'desc' })
  const [trackSort, setTrackSort] = useState<TrackSort>({ field: 'trackNumber', dir: 'asc' })

  const reload = async (t: Tab = tab) => {
    setIsLoading(true)
    setError(null)
    setOpenArtists(new Set())
    setOpenAlbums(new Set())
    setTrackCache(new Map())
    setPlayingId(null)
    try {
      setAlbums(
        t === 'pending'  ? await adminService.listPendingAlbums() :
        t === 'approved' ? await adminService.listAlbums('approved') :
        t === 'rejected' ? await adminService.listAlbums('rejected') :
                           await adminService.listAlbums()
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load albums')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { reload() }, [tab])

  // Group albums by artist
  const artistGroups = useMemo((): ArtistGroup[] => {
    const map = new Map<string, ArtistGroup>()
    for (const album of albums) {
      const g = map.get(album.artist.id)
      if (g) g.albums.push(album)
      else map.set(album.artist.id, { id: album.artist.id, name: album.artist.name, imageUrl: album.artist.imageUrl, albums: [album] })
    }
    return Array.from(map.values())
  }, [albums])

  // Sorted artist groups
  const sortedArtists = useMemo(() => {
    return [...artistGroups].sort((a, b) =>
      artistSort.field === 'name'
        ? cmp(a.name.toLowerCase(), b.name.toLowerCase(), artistSort.dir)
        : cmp(a.albums.length, b.albums.length, artistSort.dir)
    )
  }, [artistGroups, artistSort])

  const sortAlbums = (albs: Album[]) =>
    [...albs].sort((a, b) => {
      if (albumSort.field === 'title')       return cmp(a.title.toLowerCase(), b.title.toLowerCase(), albumSort.dir)
      if (albumSort.field === 'type')        return cmp(a.type, b.type, albumSort.dir)
      if (albumSort.field === 'status')      return cmp(a.status ?? '', b.status ?? '', albumSort.dir)
      /* releaseDate */                      return cmp(String(a.releaseDate), String(b.releaseDate), albumSort.dir)
    })

  const sortTracks = (trks: Track[]) =>
    [...trks].sort((a, b) => {
      if (trackSort.field === 'title')    return cmp(a.title.toLowerCase(), b.title.toLowerCase(), trackSort.dir)
      if (trackSort.field === 'duration') return cmp(a.durationMs, b.durationMs, trackSort.dir)
      if (trackSort.field === 'status')   return cmp(a.status ?? '', b.status ?? '', trackSort.dir)
      /* trackNumber */                   return cmp(a.trackNumber, b.trackNumber, trackSort.dir)
    })

  const toggleArtist = (id: string) =>
    setOpenArtists((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const toggleAlbum = async (albumId: string) => {
    const next = new Set(openAlbums)
    if (next.has(albumId)) {
      next.delete(albumId)
      setOpenAlbums(next)
      return
    }
    next.add(albumId)
    setOpenAlbums(next)

    if (!trackCache.has(albumId)) {
      setTrackCache((prev) => new Map(prev).set(albumId, 'loading'))
      try {
        const tracks = await adminService.getAlbumTracks(albumId)
        setTrackCache((prev) => new Map(prev).set(albumId, tracks))
      } catch (err) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(msg ?? 'Failed to load tracks for album.')
        setTrackCache((prev) => new Map(prev).set(albumId, 'error'))
      }
    }
  }

  const startReview = (id: string, kind: 'album' | 'track', action: 'approve' | 'reject') =>
    setPendingReview({ id, kind, action, note: '', saving: false })

  const confirmReview = async () => {
    if (!pendingReview) return
    const { id, kind, action, note } = pendingReview
    setPendingReview((p) => p && { ...p, saving: true })
    try {
      if (kind === 'album') {
        const updated = action === 'approve'
          ? await adminService.approveAlbum(id, note || undefined)
          : await adminService.rejectAlbum(id, note || undefined)
        // Remove from any single-status tab since status changed
        if (tab !== 'all') setAlbums((prev) => prev.filter((a) => a.id !== id))
        else setAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)))
      } else {
        // track
        if (action === 'approve') await adminService.approveTrack(id, note || undefined)
        else await adminService.rejectTrack(id, note || undefined)
        // Update status in track cache
        setTrackCache((prev) => {
          const next = new Map(prev)
          for (const [albumId, entry] of next) {
            if (Array.isArray(entry)) {
              const updated = entry.map((t) =>
                t.id === id ? { ...t, status: action === 'approve' ? 'approved' : 'rejected', reviewNote: note || null } as Track : t
              )
              next.set(albumId, updated)
            }
          }
          return next
        })
      }
      setPendingReview(null)
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? `${action === 'approve' ? 'Approval' : 'Rejection'} failed.`)
      setPendingReview((p) => p && { ...p, saving: false })
    }
  }

  const handleDelete = async (album: Album) => {
    if (!confirm(`Delete "${album.title}"? This cannot be undone.`)) return
    setActingId(album.id)
    try {
      await adminService.deleteAlbum(album.id)
      setAlbums((prev) => prev.filter((a) => a.id !== album.id))
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Delete failed.')
    } finally { setActingId(null) }
  }

  const cycleArtistSort = (field: ArtistSort['field']) =>
    setArtistSort((prev) => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })

  const cycleAlbumSort = (field: AlbumSort['field']) =>
    setAlbumSort((prev) => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })

  const cycleTrackSort = (field: TrackSort['field']) =>
    setTrackSort((prev) => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })

  const handleTrackDragStart = (e: React.DragEvent, trackId: string) => {
    setDragId(trackId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleTrackDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (trackId !== dragId) setDropId(trackId)
  }

  const handleTrackDrop = async (e: React.DragEvent, dropTrackId: string, albumId: string) => {
    e.preventDefault()
    if (!dragId || dragId === dropTrackId) { setDragId(null); setDropId(null); return }

    const cached = trackCache.get(albumId)
    if (!Array.isArray(cached)) { setDragId(null); setDropId(null); return }

    const list = [...cached]
    const fromIdx = list.findIndex((t) => t.id === dragId)
    const toIdx   = list.findIndex((t) => t.id === dropTrackId)
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); setDropId(null); return }

    // Reorder
    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)

    // Reassign track numbers 1-N
    const updated = list.map((t, i) => ({ ...t, trackNumber: i + 1 }))
    setTrackCache((prev) => new Map(prev).set(albumId, updated))
    setDragId(null)
    setDropId(null)

    // PATCH only tracks whose number actually changed
    const changed = updated.filter((u) => {
      const orig = cached.find((c) => c.id === u.id)
      return orig && orig.trackNumber !== u.trackNumber
    })
    await Promise.all(
      changed.map((t) =>
        adminService.updateTrack(t.id, { trackNumber: t.trackNumber }).catch(() => {})
      )
    )
  }

  const handleTrackDragEnd = () => { setDragId(null); setDropId(null) }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Albums</h1>
          <p className="text-secondary text-sm mt-1">Sorted by artist · expand an album to review its tracks.</p>
        </div>
        <Button onClick={() => navigate('/admin/albums/new')}>
          <PlusCircleIcon className="w-5 h-5" />
          New album
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([
          ['pending',  'Pending'],
          ['approved', 'Approved'],
          ['rejected', 'Rejected'],
          ['all',      'All'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              tab === t ? 'bg-accent text-white' : 'bg-elevated text-secondary hover:text-primary'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-xs font-semibold">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : sortedArtists.length === 0 ? (
        <div className="bg-surface rounded-lg border border-elevated/40 px-6 py-12 text-center text-secondary text-sm">
          {tab === 'pending' ? 'No albums awaiting review.' : tab === 'approved' ? 'No approved albums.' : tab === 'rejected' ? 'No rejected albums.' : 'No albums yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Artist sort header */}
          <div className="flex items-center gap-2 px-2 text-xs text-secondary">
            <span className="font-semibold">Sort artists by:</span>
            {(['name', 'albums'] as ArtistSort['field'][]).map((f) => (
              <button key={f} onClick={() => cycleArtistSort(f)}
                className={`px-2 py-0.5 rounded-full border text-xs font-semibold transition-colors ${
                  artistSort.field === f
                    ? 'border-accent text-accent'
                    : 'border-elevated/40 text-secondary hover:text-primary'
                }`}>
                {f === 'name' ? 'Name' : 'Albums'} {artistSort.field === f ? (artistSort.dir === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>

          {sortedArtists.map((artist) => {
            const isArtistOpen = openArtists.has(artist.id)
            const sorted = sortAlbums(artist.albums)

            return (
              <div key={artist.id} className="bg-surface border border-elevated/40 rounded-lg overflow-hidden">
                {/* Artist row */}
                <button type="button" onClick={() => toggleArtist(artist.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-elevated/30 transition-colors text-left">
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-elevated shrink-0 flex items-center justify-center text-secondary text-sm font-bold">
                      {artist.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-primary text-sm">{artist.name}</span>
                    <span className="ml-2 text-xs text-secondary">
                      {artist.albums.length} album{artist.albums.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {isArtistOpen
                    ? <ChevronUpIcon className="w-4 h-4 text-secondary shrink-0" />
                    : <ChevronDownIcon className="w-4 h-4 text-secondary shrink-0" />}
                </button>

                {/* Albums under this artist */}
                {isArtistOpen && (
                  <div className="border-t border-elevated/30">
                    {/* Album sort header */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 px-8 py-2 border-b border-elevated/20 bg-elevated/10">
                      <SortTh label="Title"    active={albumSort.field === 'title'}       dir={albumSort.dir} onClick={() => cycleAlbumSort('title')} />
                      <SortTh label="Type"     active={albumSort.field === 'type'}        dir={albumSort.dir} onClick={() => cycleAlbumSort('type')} />
                      <SortTh label="Released" active={albumSort.field === 'releaseDate'} dir={albumSort.dir} onClick={() => cycleAlbumSort('releaseDate')} />
                      <SortTh label="Status"   active={albumSort.field === 'status'}      dir={albumSort.dir} onClick={() => cycleAlbumSort('status')} />
                      <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-secondary">Actions</th>
                    </div>

                    {sorted.map((album) => {
                      const isAlbumOpen = openAlbums.has(album.id)
                      const rawTracks = trackCache.get(album.id)
                      const tracks = Array.isArray(rawTracks) ? sortTracks(rawTracks) : []
                      const tracksLoading = rawTracks === 'loading'

                      return (
                        <React.Fragment key={album.id}>
                          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center px-8 py-2.5 border-b border-elevated/10 hover:bg-elevated/20 transition-colors">
                            {/* Title with expand toggle */}
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => toggleAlbum(album.id)}
                                  className="shrink-0 flex items-center justify-center w-5 h-5 rounded hover:bg-elevated/60 text-secondary hover:text-primary transition-colors">
                                  {isAlbumOpen
                                    ? <ChevronDownIcon className="w-3.5 h-3.5" />
                                    : <ChevronRightIcon className="w-3.5 h-3.5" />}
                                </button>
                                {album.coverUrl
                                  ? <img src={album.coverUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                  : <div className="w-8 h-8 rounded bg-elevated shrink-0" />}
                                <span className="text-sm font-medium text-primary truncate">{album.title}</span>
                              </div>
                              {album.reviewNote && (
                                <p className="ml-7 text-xs text-secondary italic truncate" title={album.reviewNote}>
                                  Note: {album.reviewNote}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-secondary capitalize">{album.type}</span>
                            <span className="text-xs text-secondary">{String(album.releaseDate)}</span>
                            <StatusBadge status={album.status} />
                            <div className="flex gap-1.5 justify-end flex-wrap">
                              {album.status === 'pending' ? (
                                <>
                                  <Button size="sm" onClick={() => startReview(album.id, 'album', 'approve')} disabled={!!actingId}>
                                    <CheckCircleIcon className="w-4 h-4" />
                                    Approve
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => startReview(album.id, 'album', 'reject')} disabled={!!actingId}>
                                    <XCircleIcon className="w-4 h-4" />
                                    Reject
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/albums/${album.id}/edit`)}>
                                    <PencilSquareIcon className="w-4 h-4" />
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDelete(album)} disabled={actingId === album.id}>
                                    {actingId === album.id ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                                    Delete
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Album review note panel */}
                          {pendingReview?.id === album.id && pendingReview.kind === 'album' && (
                            <div className="px-8 py-3 border-b border-elevated/10 bg-elevated/5">
                              <ReviewNoteForm
                                action={pendingReview.action}
                                note={pendingReview.note}
                                saving={pendingReview.saving}
                                onNoteChange={(v) => setPendingReview((p) => p && { ...p, note: v })}
                                onConfirm={confirmReview}
                                onCancel={() => setPendingReview(null)}
                              />
                            </div>
                          )}

                          {/* Tracks */}
                          {isAlbumOpen && (
                            <div className="border-b border-elevated/10 bg-elevated/5 pl-14">
                              {tracksLoading ? (
                                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                              ) : rawTracks === 'error' ? (
                                <p className="px-4 py-3 text-xs text-red-400">Failed to load tracks.</p>
                              ) : tracks.length === 0 ? (
                                <p className="px-4 py-3 text-xs text-secondary italic">No tracks uploaded yet.</p>
                              ) : (
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-elevated/20">
                                      <th className="w-6 px-1 py-2"></th>{/* drag handle */}
                                      <SortTh label="#"        active={trackSort.field === 'trackNumber'} dir={trackSort.dir} onClick={() => cycleTrackSort('trackNumber')} className="w-10" />
                                      <SortTh label="Title"    active={trackSort.field === 'title'}       dir={trackSort.dir} onClick={() => cycleTrackSort('title')} />
                                      <SortTh label="Duration" active={trackSort.field === 'duration'}    dir={trackSort.dir} onClick={() => cycleTrackSort('duration')} />
                                      <SortTh label="Status"   active={trackSort.field === 'status'}      dir={trackSort.dir} onClick={() => cycleTrackSort('status')} />
                                      <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-secondary">Preview</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tracks.map((t) => {
                                      const isDragging   = dragId === t.id
                                      const isDropTarget = dropId === t.id && dragId !== t.id
                                      return (
                                      <React.Fragment key={t.id}>
                                        <tr
                                          draggable
                                          onDragStart={(e) => handleTrackDragStart(e, t.id)}
                                          onDragOver={(e) => handleTrackDragOver(e, t.id)}
                                          onDrop={(e) => handleTrackDrop(e, t.id, album.id)}
                                          onDragEnd={handleTrackDragEnd}
                                          className={`border-b border-elevated/10 transition-colors ${
                                            isDropTarget ? 'bg-accent/10 border-t-2 border-t-accent'
                                            : isDragging  ? 'opacity-40 bg-elevated/30'
                                            : 'hover:bg-elevated/20'
                                          }`}
                                        >
                                          <td className="w-6 px-1 py-2">
                                            <span className="cursor-grab active:cursor-grabbing text-muted hover:text-secondary transition-colors">
                                              <Bars3Icon className="w-3.5 h-3.5" />
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-secondary text-sm w-10">{t.trackNumber}</td>
                                          <td className="px-3 py-2">
                                            <div className="flex flex-col gap-0.5">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-sm text-primary">{t.title}</span>
                                                {t.explicit && <span className="text-xs px-1 py-0.5 rounded bg-elevated text-secondary font-mono">E</span>}
                                              </div>
                                              {t.reviewNote && (
                                                <span className="text-xs text-secondary italic truncate" title={t.reviewNote}>
                                                  Note: {t.reviewNote}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-secondary text-sm">{fmtDuration(t.durationMs)}</td>
                                          <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                                          <td className="px-3 py-2 text-right">
                                            <div className="inline-flex gap-1 items-center flex-wrap justify-end">
                                              {t.status === 'pending' && (
                                                <>
                                                  <button type="button" onClick={() => startReview(t.id, 'track', 'approve')}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors">
                                                    <CheckCircleIcon className="w-3.5 h-3.5" />Approve
                                                  </button>
                                                  <button type="button" onClick={() => startReview(t.id, 'track', 'reject')}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
                                                    <XCircleIcon className="w-3.5 h-3.5" />Reject
                                                  </button>
                                                </>
                                              )}
                                              {t.audioUrl ? (
                                                <>
                                                  <button type="button" onClick={() => setPlayingId(playingId === t.id ? null : t.id)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors">
                                                    {playingId === t.id
                                                      ? <><StopCircleIcon className="w-3.5 h-3.5" />Stop</>
                                                      : <><PlayIcon className="w-3.5 h-3.5" />Play</>}
                                                  </button>
                                                  <a href={t.audioUrl} download
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors">
                                                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />DL
                                                  </a>
                                                </>
                                              ) : (
                                                <span className="text-xs text-muted italic">No audio</span>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                        {/* Track review note panel */}
                                        {pendingReview?.id === t.id && pendingReview.kind === 'track' && (
                                          <tr className="border-b border-elevated/10 bg-elevated/5">
                                            <td colSpan={6} className="px-4 py-3">
                                              <ReviewNoteForm
                                                action={pendingReview.action}
                                                note={pendingReview.note}
                                                saving={pendingReview.saving}
                                                onNoteChange={(v) => setPendingReview((p) => p && { ...p, note: v })}
                                                onConfirm={confirmReview}
                                                onCancel={() => setPendingReview(null)}
                                              />
                                            </td>
                                          </tr>
                                        )}
                                        {playingId === t.id && (
                                          <tr className="bg-elevated/10 border-b border-elevated/10">
                                            <td colSpan={6} className="px-3 py-2">
                                              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                              <audio controls autoPlay src={t.audioUrl} className="w-full h-9"
                                                onEnded={() => setPlayingId(null)} />
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </React.Fragment>
                      )
                    })}
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
