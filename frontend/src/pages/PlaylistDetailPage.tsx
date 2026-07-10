import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useConfirm } from '@/hooks/useConfirm'
import { PlayIcon, PauseIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/solid'
import {
  GlobeAltIcon,
  LockClosedIcon,
  UsersIcon,
  PhotoIcon,
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  XMarkIcon,
  UserPlusIcon,
  ArrowDownCircleIcon,
  SparklesIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'
import type { Playlist, PlaylistVisibility, PlaylistTrack } from '@/types/playlist'
import type { Track } from '@/types/track'
import type { UserRef } from '@/types/user'
import { playlistService } from '@/services/playlistService'
import {
  collectionKey,
  getOfflineCollection,
  offlineCollectionToPlaylist,
  saveCollectionOffline,
} from '@/services/offlineAudio'
import { isDesktop } from '@/utils/platform'
import { collaboratorService } from '@/services/collaboratorService'
import { trackService } from '@/services/trackService'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useDominantColor, heroGradient } from '@/hooks/useDominantColor'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { TrackRow } from '@/components/cards/TrackRow'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { PlaylistCover } from '@/components/cards/PlaylistCover'
import { InviteCollaboratorModal } from '@/components/friends/InviteCollaboratorModal'
import { ShareToChatModal } from '@/components/chat/ShareToChatModal'
import { PlaylistAddableRow } from '@/components/player/PlaylistAddableRow'
import { PlaylistRowMenu } from '@/components/cards/PlaylistRowMenu'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'
import { cn } from '@/utils/cn'
import { notify } from '@/utils/toast'

type TrackSort = 'custom' | 'title' | 'artist' | 'album' | 'duration' | 'added'

const TRACK_SORT_OPTIONS: { value: TrackSort; label: string }[] = [
  { value: 'custom', label: 'Custom order' },
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'added', label: 'Date added' },
  { value: 'duration', label: 'Duration' },
]

const PLAYLIST_TRACK_REORDER_MIME = 'application/x-ns-playlist-track-reorder'

/** Returns a sorted copy of the playlist's tracks. 'custom' keeps server order. */
function sortPlaylistTracks(tracks: PlaylistTrack[], key: TrackSort): PlaylistTrack[] {
  if (key === 'custom') return tracks
  const copy = [...tracks]
  switch (key) {
    case 'title':
      return copy.sort((a, b) => a.track.title.localeCompare(b.track.title))
    case 'artist':
      return copy.sort((a, b) => a.track.artist.name.localeCompare(b.track.artist.name))
    case 'album':
      return copy.sort((a, b) => a.track.album.title.localeCompare(b.track.album.title))
    case 'duration':
      return copy.sort((a, b) => a.track.durationMs - b.track.durationMs)
    case 'added':
      // Most recently added first.
      return copy.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    default:
      return copy
  }
}

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [loadError, setLoadError] = useState<'notfound' | 'forbidden' | null>(null)
  useDocumentTitle(playlist?.name ?? null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [smartGenre, setSmartGenre] = useState('')
  const [smartRating, setSmartRating] = useState('')
  const [smartPlayCount, setSmartPlayCount] = useState('')
  const [smartDays, setSmartDays] = useState('')
  const [smartLimit, setSmartLimit] = useState('100')
  const [clearSmartRules, setClearSmartRules] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [collaborators, setCollaborators] = useState<UserRef[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [findPanelOpen, setFindPanelOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [recommendations, setRecommendations] = useState<Track[]>([])
  const [addingTrackIds, setAddingTrackIds] = useState<Set<string>>(new Set())
  const addingTrackLocks = useRef<Set<string>>(new Set())
  const debouncedQuery = useDebounce(searchQuery, 300)
  const [downloading, setDownloading] = useState(false)
  const [trackSort, setTrackSort] = useState<TrackSort>('custom')
  const [dragOverTrack, setDragOverTrack] = useState<{ id: string; edge: 'before' | 'after' } | null>(null)
  const trackReorderInFlight = useRef(false)
  const [shareToChatOpen, setShareToChatOpen] = useState(false)
  const startContext = usePlayContextGate()
  const isMobile = useIsMobile()
  const { isAuthenticated, user, offlineMode } = useAuthStore()
  const isPremium = user?.plan === 'premium'
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const savePlaylist = useLibraryStore((s) => s.savePlaylist)
  const unsavePlaylist = useLibraryStore((s) => s.unsavePlaylist)
  const setPlaylistVisibility = useLibraryStore((s) => s.setPlaylistVisibility)
  const deletePlaylistAction = useLibraryStore((s) => s.deletePlaylist)
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist)
  const syncPlaylistTracks = useLibraryStore((s) => s.syncPlaylistTracks)
  const syncPlaylist = useLibraryStore((s) => s.syncPlaylist)
  const savedPlaylists = useLibraryStore((s) => s.savedPlaylists)
  const shuffleEnabled = usePlayerStore((s) => s.shuffleEnabled)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  // This playlist is "active" only when it's the explicit playback context (a
  // track can live in many playlists, so we can't infer it from currentTrack).
  const { isActiveContext, isPlayingContext } = usePlaybackContext(id ? { type: 'playlist', id } : null)
  // Tint the header from the playlist's saved cover. Empty/default-cover
  // playlists use the default shade rather than deriving one from tracks.
  // resetOnChange: when navigating from a playlist with a cover to one without
  // (e.g. a sidebar-created playlist), clear the previous tint instead of
  // letting it bleed into the new page's header.
  const heroColor = useDominantColor(playlist?.coverUrl, { resetOnChange: true })
  // Subtle neutral grey fallback so empty-cover playlists still get a gentle
  // gradient wash instead of a flat background.
  const heroBackground = heroGradient(heroColor) ?? heroGradient('hsl(0 0% 38%)')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    if (offlineMode) {
      const offline = getOfflineCollection(collectionKey('playlist', id))
      if (offline) {
        const p = offlineCollectionToPlaylist(offline)
        setPlaylist(p)
        setEditName(p.name)
        setEditDescription(p.description ?? '')
        setSmartGenre('')
        setSmartRating('')
        setSmartPlayCount('')
        setSmartDays('')
        setSmartLimit('100')
        setClearSmartRules(false)
        syncPlaylistTracks(p.id, p.tracks)
        setLoadError(null)
      } else {
        setPlaylist(null)
        setLoadError('notfound')
      }
      setCollaborators([])
      setLoading(false)
      return
    }
    playlistService.getById(id)
      .then((p) => {
        setPlaylist(p)
        setEditName(p.name)
        setEditDescription(p.description ?? '')
        setSmartGenre(p.smartRules?.genre ?? '')
        setSmartRating(p.smartRules?.minimumRating?.toString() ?? '')
        setSmartPlayCount(p.smartRules?.minimumPlayCount?.toString() ?? '')
        setSmartDays(p.smartRules?.addedWithinDays?.toString() ?? '')
        setSmartLimit(p.smartRules?.limit?.toString() ?? '100')
        setClearSmartRules(false)
        syncPlaylistTracks(p.id, p.tracks)
      })
      .catch((err) => {
        // Offline fallback: render a downloaded playlist from local data.
        const offline = getOfflineCollection(collectionKey('playlist', id))
        if (offline) {
          const p = offlineCollectionToPlaylist(offline)
          setPlaylist(p)
          setEditName(p.name)
          syncPlaylistTracks(p.id, p.tracks)
          setLoadError(null)
          return
        }
        const status = err?.response?.status
        setLoadError(status === 403 ? 'forbidden' : 'notfound')
        setPlaylist(null)
      })
      .finally(() => setLoading(false))
    // Fetch collaborators in parallel (silently ignore if endpoint not yet live).
    collaboratorService.list(id).then(setCollaborators).catch(() => {})
  }, [id, offlineMode, syncPlaylistTracks])

  // Keep local playlist state in sync with the store so that add/remove operations
  // triggered from TrackRowMenu (which write to the store) are reflected immediately.
  useEffect(() => {
    const playlistId = playlist?.id
    if (!playlistId) return
    const storePlaylist = savedPlaylists.find((p) => p.id === playlistId)
    // Store entries are summaries until syncPlaylistTracks runs — mirroring an
    // unsynced entry would wipe local tracks to undefined and crash the memos.
    if (!storePlaylist?.tracks) return
    window.queueMicrotask(() => {
      setPlaylist((prev) =>
        prev?.id === playlistId
          ? { ...prev, tracks: storePlaylist.tracks, totalDurationMs: storePlaylist.totalDurationMs }
          : prev,
      )
    })
  }, [savedPlaylists, playlist?.id])

  // Fetch recommendations once the playlist (and its tracks/genres) are loaded — they
  // refresh after every add so newly-added tracks drop off the list.
  useEffect(() => {
    if (!playlist?.isOwner && !playlist?.isCollaborator) return
    playlistService.getRecommendations(playlist.id, 10).then(setRecommendations).catch(() => setRecommendations([]))
  }, [playlist?.id, playlist?.isOwner, playlist?.isCollaborator])

  // Live-search the catalog as the user types. Clearing the box restores recommendations.
  useEffect(() => {
    if (!playlist?.isOwner && !playlist?.isCollaborator) return
    const q = debouncedQuery.trim()
    if (!q) {
      const frame = window.requestAnimationFrame(() => setSearchResults([]))
      return () => window.cancelAnimationFrame(frame)
    }
    let cancelled = false
    trackService.search(q).then((tracks) => {
      if (!cancelled) setSearchResults(tracks)
    }).catch(() => {
      if (!cancelled) setSearchResults([])
    })
    return () => { cancelled = true }
  }, [debouncedQuery, playlist?.isOwner, playlist?.isCollaborator])

  // Existing and in-flight tracks disappear from recommendations immediately.
  const findCandidates = useMemo(() => {
    if (!playlist) return []
    const present = new Set(playlist.tracks.map((pt) => pt.track.id))
    const filter = (track: Track) => !present.has(track.id) && !addingTrackIds.has(track.id)
    const source = searchQuery.trim() ? searchResults : recommendations
    return source.filter(filter)
  }, [playlist, searchQuery, searchResults, recommendations, addingTrackIds])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  if (!playlist) return (
    <div className="flex flex-col items-center justify-center h-64 gap-2 text-center p-8">
      {loadError === 'forbidden' ? (
        <>
          <p className="text-lg font-semibold text-primary">This playlist is private</p>
          <p className="text-sm text-secondary">Only friends of the owner can view this playlist.</p>
        </>
      ) : (
        <p className="text-secondary">Playlist not found.</p>
      )}
    </div>
  )

  // Displayed (and play-queue) order follows the chosen sort; 'custom' = server order.
  const sortedPlaylistTracks = sortPlaylistTracks(playlist.tracks, trackSort)
  const tracks = sortedPlaylistTracks.map((pt) => pt.track)

  // The big button toggles play/pause while this playlist is the active context,
  // otherwise it starts it from the top.
  const isPlayingThisPlaylist = isPlayingContext

  const handlePlayAll = () => {
    if (tracks.length === 0) return
    if (isActiveContext) togglePlayPause()
    else startContext({ type: 'playlist', id: playlist.id }, tracks)
  }

  const handleDownload = async () => {
    if (!playlist || !isDesktop()) return
    setDownloading(true)
    try {
      await saveCollectionOffline(
        {
          kind: 'playlist',
          id: playlist.id,
          name: playlist.name,
          subtitle: playlist.owner.name,
          coverUrl: playlist.coverUrl ?? '',
        },
        tracks,
      )
    } finally {
      setDownloading(false)
    }
  }

  // Export the playlist as portable JSON (metadata only — no audio).
  const handleExport = () => {
    if (!playlist) return
    const data = {
      name: playlist.name,
      description: playlist.description ?? null,
      exportedAt: new Date().toISOString(),
      tracks: playlist.tracks.map((pt, i) => ({
        position: i + 1,
        title: pt.track.title,
        artist: pt.track.artist.name,
        album: pt.track.album.title,
        durationMs: pt.track.durationMs,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${playlist.name.replace(/[^\w\- ]+/g, '').trim() || 'playlist'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveToggle = async () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Save playlists with a free account' })
      return
    }
    if (!playlist) return
    setBusy(true)
    try {
      if (playlist.isSaved) {
        await unsavePlaylist(playlist.id)
        setPlaylist({ ...playlist, isSaved: false })
      } else {
        await savePlaylist(playlist)
        setPlaylist({ ...playlist, isSaved: true })
      }
    } finally {
      setBusy(false)
    }
  }

  const VISIBILITY_CYCLE: PlaylistVisibility[] = ['public', 'friends', 'private']

  const currentVisibility = (): PlaylistVisibility => {
    if (!playlist) return 'public'
    const v = playlist.visibility
    if (v === 'public' || v === 'friends' || v === 'private') return v
    // Fallback: empty string from migration default or missing field
    return playlist.isPublic ? 'public' : 'private'
  }

  const handleVisibilityToggle = async () => {
    if (!playlist) return
    const cur = currentVisibility()
    const next = VISIBILITY_CYCLE[(VISIBILITY_CYCLE.indexOf(cur) + 1) % VISIBILITY_CYCLE.length]
    setBusy(true)
    try {
      await setPlaylistVisibility(playlist.id, next)
      setPlaylist({ ...playlist, visibility: next, isPublic: next === 'public' })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!playlist) return
    if (!(await confirm({
      title: `Delete "${playlist.name}"?`,
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    }))) return
    setBusy(true)
    try {
      await deletePlaylistAction(playlist.id)
      navigate('/library')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveEdits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playlist) return
    setBusy(true)
    try {
      let updated = await playlistService.update(playlist.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        smartRules: playlist.smartRules && !clearSmartRules ? {
          genre: smartGenre.trim() || null,
          minimumRating: smartRating ? Number(smartRating) : null,
          minimumPlayCount: smartPlayCount ? Number(smartPlayCount) : null,
          addedWithinDays: smartDays ? Number(smartDays) : null,
          limit: Number(smartLimit) || 100,
        } : undefined,
        clearSmartRules,
      })
      if (coverFile) {
        updated = await playlistService.uploadCover(playlist.id, coverFile)
        setCoverFile(null)
        // Eagerly sync the new cover into the library store so the sidebar
        // and home page reflect the change without a full refresh.
        syncPlaylist(updated)
      }
      setPlaylist(updated)
      setEditName(updated.name)
      setEditDescription(updated.description ?? '')
      setEditOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const openEditDetails = () => {
    if (!playlist?.isOwner) return
    setEditName(playlist.name)
    setEditDescription(playlist.description ?? '')
    setSmartGenre(playlist.smartRules?.genre ?? '')
    setSmartRating(playlist.smartRules?.minimumRating?.toString() ?? '')
    setSmartPlayCount(playlist.smartRules?.minimumPlayCount?.toString() ?? '')
    setSmartDays(playlist.smartRules?.addedWithinDays?.toString() ?? '')
    setSmartLimit(playlist.smartRules?.limit?.toString() ?? '100')
    setClearSmartRules(false)
    setCoverFile(null)
    setEditOpen(true)
  }

  const closeEditDetails = () => {
    if (busy) return
    setCoverFile(null)
    setEditOpen(false)
  }

  const handleModalVisibilityToggle = async () => {
    if (!playlist) return
    const next: PlaylistVisibility = currentVisibility() === 'private' ? 'public' : 'private'
    setBusy(true)
    try {
      await setPlaylistVisibility(playlist.id, next)
      setPlaylist({ ...playlist, visibility: next, isPublic: next === 'public' })
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async (track: Track) => {
    if (!playlist) return
    if (
      addingTrackLocks.current.has(track.id) ||
      addingTrackIds.has(track.id) ||
      playlist.tracks.some((item) => item.track.id === track.id)
    ) return
    addingTrackLocks.current.add(track.id)
    setAddingTrackIds((s) => {
      const next = new Set(s)
      next.add(track.id)
      return next
    })
    try {
      await addTrackToPlaylist(playlist.id, track)
      setPlaylist((p) =>
        p
          ? {
              ...p,
              tracks: [
                ...p.tracks,
                { track, addedAt: new Date().toISOString(), addedBy: p.owner },
              ],
              totalDurationMs: p.totalDurationMs + track.durationMs,
            }
          : p,
      )
      // Refresh recs so the just-added track drops off and a new one fills the slot.
      playlistService.getRecommendations(playlist.id, 10).then(setRecommendations).catch(() => {})
    } finally {
      addingTrackLocks.current.delete(track.id)
      setAddingTrackIds((s) => {
        const next = new Set(s)
        next.delete(track.id)
        return next
      })
    }
  }

  const handleTrackRemoved = (trackId: string) => {
    setPlaylist((current) => {
      if (!current) return current
      const removed = current.tracks.find((item) => item.track.id === trackId)
      return {
        ...current,
        tracks: current.tracks.filter((item) => item.track.id !== trackId),
        totalDurationMs: Math.max(0, current.totalDurationMs - (removed?.track.durationMs ?? 0)),
      }
    })
  }

  const canReorderTracks = !playlist.smartRules && !!(playlist.isOwner || playlist.isCollaborator)

  const handleTrackReorder = async (fromId: string, toId: string, before: boolean) => {
    if (!canReorderTracks || trackSort !== 'custom' || fromId === toId || trackReorderInFlight.current) return
    const fromIndex = playlist.tracks.findIndex((item) => item.track.id === fromId)
    if (fromIndex < 0 || !playlist.tracks.some((item) => item.track.id === toId)) return

    const previousTracks = playlist.tracks
    const nextTracks = [...previousTracks]
    const [moved] = nextTracks.splice(fromIndex, 1)
    let insertAt = nextTracks.findIndex((item) => item.track.id === toId)
    if (!before) insertAt += 1
    nextTracks.splice(insertAt, 0, moved)

    trackReorderInFlight.current = true
    setPlaylist((current) => current ? { ...current, tracks: nextTracks } : current)
    syncPlaylistTracks(playlist.id, nextTracks)
    try {
      const updated = await playlistService.reorderTracks(
        playlist.id,
        nextTracks.map((item) => item.track.id),
      )
      setPlaylist(updated)
      syncPlaylistTracks(updated.id, updated.tracks)
    } catch {
      setPlaylist((current) => current ? { ...current, tracks: previousTracks } : current)
      syncPlaylistTracks(playlist.id, previousTracks)
      notify.error("Couldn't save the new track order.")
    } finally {
      trackReorderInFlight.current = false
    }
  }

  return (
    <div>
      {/* Header + actions: fuller colour block behind the cover, fading below */}
      <div style={{ background: heroBackground }}>
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 p-4 sm:p-6 pb-4">
        <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-56 md:h-56 rounded-md shadow-2xl overflow-hidden flex-shrink-0 bg-elevated self-center sm:self-auto">
          {/* Only render the explicit cover URL — no track-mosaic fallback.
              Sidebar-created playlists keep the default icon until the user uploads
              a cover. Track-created playlists have their cover stored permanently
              by the backend, so coverUrl will always be set for those. */}
          <PlaylistCover coverUrl={playlist.coverUrl} name={playlist.name} />
        </div>
        <div className="min-w-0 pb-2">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider">
            {playlist.smartRules ? 'Smart playlist' : { public: 'Public playlist', friends: 'Friends only', private: 'Private playlist' }[currentVisibility()]}
          </p>
          <h1 className="mt-1 mb-3 break-words text-3xl font-black text-primary sm:text-4xl md:text-5xl">
            {playlist.isOwner ? (
              <button
                type="button"
                onClick={openEditDetails}
                className="cursor-pointer text-left focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                aria-label={`Edit details for ${playlist.name}`}
              >
                {playlist.name}
              </button>
            ) : (
              playlist.name
            )}
          </h1>
          {playlist.description && <p className="text-secondary text-sm mb-2">{playlist.description}</p>}
          <p className="text-xs text-secondary">
            {playlist.owner.artistId ? (
              <Link
                to={`/artist/${playlist.owner.artistId}`}
                className="font-semibold text-primary hover:underline"
              >
                {playlist.owner.name}
              </Link>
            ) : (
              <span className="font-semibold text-primary">{playlist.owner.name}</span>
            )}
            {' · '}
            {formatNumber(playlist.followerCount)} likes
            {' · '}
            {tracks.length} songs, {formatMs(tracks.reduce((sum, pt) => sum + (pt.durationMs ?? 0), 0))}
          </p>
          {playlist.smartRules && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 font-semibold text-accent">
                <SparklesIcon className="h-3.5 w-3.5" /> Updates automatically
              </span>
              {playlist.smartRules.genre && <span className="rounded-full bg-elevated px-2.5 py-1 text-secondary">Genre: {playlist.smartRules.genre}</span>}
              {playlist.smartRules.minimumRating != null && <span className="rounded-full bg-elevated px-2.5 py-1 text-secondary">{playlist.smartRules.minimumRating}+ stars</span>}
              {playlist.smartRules.minimumPlayCount != null && <span className="rounded-full bg-elevated px-2.5 py-1 text-secondary">{playlist.smartRules.minimumPlayCount}+ plays</span>}
              {playlist.smartRules.addedWithinDays != null && <span className="rounded-full bg-elevated px-2.5 py-1 text-secondary">Added in {playlist.smartRules.addedWithinDays} days</span>}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4">
        <Button
          onClick={handlePlayAll}
          size="lg"
          className="gap-2"
          aria-label={isPlayingThisPlaylist ? 'Pause' : 'Play'}
        >
          {isPlayingThisPlaylist ? (
            <>
              <PauseIcon className="w-5 h-5" />
              Pause
            </>
          ) : (
            <>
              <PlayIcon className="w-5 h-5" />
              Play
            </>
          )}
        </Button>

        {/* Shuffle — visible to all viewers, playback pref only */}
        <button
          onClick={toggleShuffle}
          title={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
          aria-label={shuffleEnabled ? 'Turn shuffle off' : 'Turn shuffle on'}
          aria-pressed={shuffleEnabled}
          className={cn(
            'spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95',
            shuffleEnabled ? 'text-accent' : 'text-secondary hover:text-primary',
          )}
        >
          <ArrowsRightLeftIcon className="h-6 w-6 stroke-[2.5]" />
          {shuffleEnabled && (
            <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
          )}
          <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">
            {shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
          </span>
        </button>

        {/* Owner-only: visibility, collaborators, invite */}
        {playlist.isOwner && (
          <>
            <button
              onClick={handleVisibilityToggle}
              disabled={busy}
              title="Change visibility"
              aria-label={`Change visibility. Current: ${currentVisibility()}`}
              className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95 disabled:opacity-50"
            >
              {currentVisibility() === 'public' && <GlobeAltIcon className="h-6 w-6 stroke-[2.5]" />}
              {currentVisibility() === 'friends' && <UsersIcon className="h-6 w-6 stroke-[2.5]" />}
              {currentVisibility() === 'private' && <LockClosedIcon className="h-6 w-6 stroke-[2.5]" />}
              <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">
                {currentVisibility() === 'public' && 'Public'}
                {currentVisibility() === 'friends' && 'Friends only'}
                {currentVisibility() === 'private' && 'Private'}
              </span>
            </button>

            {/* Collaborator strip */}
            {collaborators.length > 0 && (
              <div className="flex items-center gap-1 ml-2">
                {collaborators.slice(0, 5).map((c) => (
                  <Avatar
                    key={c.id}
                    src={c.avatarUrl}
                    alt={c.name}
                    size="sm"
                    round
                    className="ring-2 ring-base -ml-2 first:ml-0"
                  />
                ))}
                {collaborators.length > 5 && (
                  <span className="text-xs text-secondary ml-1">+{collaborators.length - 5}</span>
                )}
              </div>
            )}

            {!playlist.smartRules && (
              <button
                onClick={() => setInviteOpen(true)}
                title="Invite collaborator"
                aria-label="Invite collaborator"
                className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
              >
                <UserPlusIcon className="h-6 w-6 stroke-[2.5]" />
                <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">Invite</span>
              </button>
            )}
          </>
        )}

        {/* Non-owner: save/unsave to library */}
        {!playlist.isOwner && (
          <button
            onClick={handleSaveToggle}
            disabled={busy}
            title={playlist.isSaved ? 'Remove from your library' : 'Save to your library'}
            aria-label={playlist.isSaved ? 'Remove from your library' : 'Save to your library'}
            className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95 disabled:opacity-50"
          >
            {playlist.isSaved ? (
              <CheckCircleIcon className="liked-heart-pop h-7 w-7 text-accent" />
            ) : (
              <PlusCircleIcon className="h-7 w-7 stroke-[2.4]" />
            )}
            <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">
              {playlist.isSaved ? 'Remove from your library' : 'Save to your library'}
            </span>
          </button>
        )}

        {/* Download — premium only */}
        {isPremium ? (
          <button
            onClick={handleDownload}
            disabled={downloading || !isDesktop()}
            title={!isDesktop() ? 'Available in the app' : 'Save for offline'}
            aria-label={!isDesktop() ? 'Available in the app' : downloading ? 'Downloading' : 'Save for offline'}
            className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:text-secondary"
          >
            <ArrowDownCircleIcon className="h-7 w-7 stroke-[2.4]" />
            <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">
              {!isDesktop() ? 'Available in the app' : downloading ? 'Downloading...' : 'Save for offline'}
            </span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/premium')}
            title="Download is a Premium feature"
            aria-label="Download is a Premium feature"
            className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-accent active:scale-95"
          >
            <ArrowDownCircleIcon className="h-7 w-7 stroke-[2.4]" />
            <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">Download - Premium</span>
          </button>
        )}

        {/* Send to a friend — opens chat-share modal */}
        {isAuthenticated && (
          <button
            onClick={() => setShareToChatOpen(true)}
            title="Send this playlist to a friend"
            aria-label="Send this playlist to a friend"
            className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
          >
            <PaperAirplaneIcon className="h-6 w-6 stroke-[2.5]" />
            <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">Send to friend</span>
          </button>
        )}

        <PlaylistRowMenu
          playlist={playlist}
          alwaysVisible
          triggerClassName="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
          triggerIconClassName="h-6 w-6 stroke-[2.7]"
          onEditDetails={openEditDetails}
          onAddSongs={!findPanelOpen ? () => setFindPanelOpen(true) : undefined}
          onExport={tracks.length > 0 ? handleExport : undefined}
          onDelete={handleDelete}
        />
      </div>
      </div>

      {playlist.isOwner && editOpen && (
        <Dialog open onClose={closeEditDetails} className="relative z-[100]">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-[1px]" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="spotify-scrollbar max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg bg-elevated p-6 text-primary shadow-2xl ring-1 ring-primary/10">
              <form onSubmit={handleSaveEdits}>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <DialogTitle className="text-2xl font-bold">Edit details</DialogTitle>
                  <button
                    type="button"
                    onClick={closeEditDetails}
                    disabled={busy}
                    className="rounded-full p-1 text-secondary transition-colors hover:bg-elevated hover:text-primary disabled:opacity-50"
                    aria-label="Close edit details"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="order-2 grid content-start gap-4 sm:col-start-2 sm:row-start-1">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-secondary">Name</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-10 rounded border border-primary/20 bg-surface px-3 text-sm text-primary outline-none transition-colors focus:border-primary/60"
                  autoFocus
                  required
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-secondary">Description</span>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add an optional description"
                  className="min-h-[124px] resize-none rounded border border-transparent bg-surface px-3 py-3 text-sm font-normal text-primary outline-none placeholder:text-secondary focus:border-primary/40"
                />
              </label>
              {playlist.smartRules && (
                <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold text-primary">
                    <SparklesIcon className="h-4 w-4 text-accent" />
                    Smart rules
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-secondary">
                      Genre slug
                      <input value={smartGenre} onChange={(e) => setSmartGenre(e.target.value)} disabled={clearSmartRules} className="h-10 rounded-md bg-elevated px-3 text-sm text-primary disabled:opacity-50" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-secondary">
                      Minimum rating
                      <input type="number" min="1" max="5" step="0.5" value={smartRating} onChange={(e) => setSmartRating(e.target.value)} disabled={clearSmartRules} className="h-10 rounded-md bg-elevated px-3 text-sm text-primary disabled:opacity-50" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-secondary">
                      Minimum plays
                      <input type="number" min="0" value={smartPlayCount} onChange={(e) => setSmartPlayCount(e.target.value)} disabled={clearSmartRules} className="h-10 rounded-md bg-elevated px-3 text-sm text-primary disabled:opacity-50" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-secondary">
                      Added within days
                      <input type="number" min="1" max="3650" value={smartDays} onChange={(e) => setSmartDays(e.target.value)} disabled={clearSmartRules} className="h-10 rounded-md bg-elevated px-3 text-sm text-primary disabled:opacity-50" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-secondary">
                      Maximum tracks
                      <input type="number" min="1" max="500" value={smartLimit} onChange={(e) => setSmartLimit(e.target.value)} disabled={clearSmartRules} className="h-10 rounded-md bg-elevated px-3 text-sm text-primary disabled:opacity-50" />
                    </label>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-secondary">
                    <input type="checkbox" checked={clearSmartRules} onChange={(e) => setClearSmartRules(e.target.checked)} />
                    Convert to a regular playlist
                  </label>
                </div>
              )}
            </div>

            <div className="order-1 sm:col-start-1 sm:row-start-1">
              <div className="aspect-square overflow-hidden rounded bg-elevated shadow-lg">
                {coverFile ? (
                  <img src={URL.createObjectURL(coverFile)} alt="Cover preview" className="h-full w-full object-cover" />
                ) : playlist.coverUrl ? (
                  <img src={playlist.coverUrl} alt={playlist.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl">🎵</div>
                )}
              </div>
              <label className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-elevated px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-elevated/70">
                <PhotoIcon className="h-4 w-4" />
                Choose cover
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {!playlist.smartRules && (
                <button
                  type="button"
                  onClick={() => void handleModalVisibilityToggle()}
                  disabled={busy}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-primary/60 px-4 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                >
                  {currentVisibility() === 'private' ? (
                    <GlobeAltIcon className="h-4 w-4" />
                  ) : (
                    <LockClosedIcon className="h-4 w-4" />
                  )}
                  {currentVisibility() === 'private' ? 'Make public' : 'Make private'}
                </button>
              )}
            </div>
          </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={busy || !editName.trim()}
                    className="h-12 min-w-24 rounded-full bg-white px-8 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Saving...' : 'Save'}
                  </button>
                </div>

                <p className="mt-3 text-[11px] font-semibold leading-4 text-primary">
                  By proceeding, you agree to give Spotify access to the image you choose to upload. Please make sure you have the right to upload the image.
                </p>
              </form>
            </DialogPanel>
          </div>
        </Dialog>
      )}

      {/* Track list */}
      <div className="px-4">
        {/* Sort control */}
        {playlist.tracks.length > 1 && (
          <div className="flex items-center justify-end pb-1">
            <label className="flex items-center gap-2 text-xs text-secondary">
              Sort by
              <select
                aria-label="Sort tracks"
                value={trackSort}
                onChange={(e) => setTrackSort(e.target.value as TrackSort)}
                className="rounded-md border border-secondary/20 bg-elevated px-2.5 py-1.5 text-sm font-medium text-primary outline-none transition-colors hover:border-secondary/40 focus:border-accent"
              >
                {TRACK_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Column headers */}
        <div
          className="grid items-center gap-4 px-4 py-2 border-b border-elevated/30 mb-2"
          style={{ gridTemplateColumns: isMobile ? '16px 1fr var(--track-actions-width)' : '16px 6fr 4fr 3fr var(--track-actions-width)' }}
        >
          <span className="text-xs text-secondary">#</span>
          <span className="text-xs text-secondary uppercase tracking-wider">Title</span>
          <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">Album</span>
          <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">Date added</span>
          <div className="grid grid-cols-[32px_50px_32px] sm:grid-cols-[80px_32px_50px_32px] items-center gap-1.5 sm:gap-2 justify-end w-[114px] sm:w-[194px] ml-auto">
            <span className="hidden sm:block" />
            <span />
            <span className="flex justify-end pr-1">
              <ClockIcon className="w-4 h-4 text-secondary" />
            </span>
            <span />
          </div>
        </div>

        {sortedPlaylistTracks.map((pt, i) => {
          const reorderEnabled = canReorderTracks && trackSort === 'custom'
          const dropEdge = dragOverTrack?.id === pt.track.id ? dragOverTrack.edge : null
          return (
            <div
              key={pt.track.id}
              className="relative"
              onDragStart={reorderEnabled ? (e) => {
                e.dataTransfer.setData(PLAYLIST_TRACK_REORDER_MIME, pt.track.id)
                e.dataTransfer.effectAllowed = 'copyMove'
              } : undefined}
              onDragOver={reorderEnabled ? (e) => {
                if (!e.dataTransfer.types.includes(PLAYLIST_TRACK_REORDER_MIME)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const rect = e.currentTarget.getBoundingClientRect()
                setDragOverTrack({
                  id: pt.track.id,
                  edge: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
                })
              } : undefined}
              onDragLeave={reorderEnabled ? (e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOverTrack(null)
              } : undefined}
              onDrop={reorderEnabled ? (e) => {
                if (!e.dataTransfer.types.includes(PLAYLIST_TRACK_REORDER_MIME)) return
                e.preventDefault()
                const fromId = e.dataTransfer.getData(PLAYLIST_TRACK_REORDER_MIME)
                const rect = e.currentTarget.getBoundingClientRect()
                const before = e.clientY < rect.top + rect.height / 2
                setDragOverTrack(null)
                void handleTrackReorder(fromId, pt.track.id, before)
              } : undefined}
              onDragEnd={reorderEnabled ? () => setDragOverTrack(null) : undefined}
            >
              {dropEdge && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-x-1 z-30 h-0.5 rounded bg-accent',
                    dropEdge === 'before' ? 'top-0' : 'bottom-0',
                  )}
                />
              )}
              <TrackRow
                track={pt.track}
                index={i}
                queue={tracks}
                showAlbum
                addedAt={pt.addedAt}
                currentPlaylistId={
                  !playlist.smartRules && (playlist.isOwner || playlist.isCollaborator)
                    ? playlist.id
                    : undefined
                }
                onRemovedFromCurrentPlaylist={handleTrackRemoved}
                context={{ type: 'playlist', id: playlist.id }}
              />
            </div>
          )
        })}
      </div>

      {/* "Let's find something for your playlist" panel — owner & collaborators */}
      {!playlist.smartRules && (playlist.isOwner || playlist.isCollaborator) && findPanelOpen && (
        <div className="px-6 pt-6 pb-10 border-t border-elevated/30 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-primary">Let's find something for your playlist</h2>
            <button
              onClick={() => setFindPanelOpen(false)}
              title="Close"
              className="text-secondary hover:text-primary hover:scale-110 active:scale-90 transition-all"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="relative mb-4 max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for songs or episodes"
              className="w-full h-10 rounded-md bg-elevated text-sm text-primary placeholder:text-muted pl-9 pr-3 outline-none focus:ring-1 focus:ring-accent/50"
            />
          </div>

          {findCandidates.length === 0 ? (
            <p className="text-sm text-secondary px-1 py-4">
              {searchQuery.trim()
                ? 'No matching songs found.'
                : 'No suggestions yet — add a song to get personalized recommendations.'}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {findCandidates.map((track) => (
                <PlaylistAddableRow
                  key={track.id}
                  track={track}
                  adding={addingTrackIds.has(track.id)}
                  onAdd={() => handleAdd(track)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Send-to-friend modal */}
      {shareToChatOpen && (
        <ShareToChatModal payload={{ kind: 'playlist', playlist }} onClose={() => setShareToChatOpen(false)} />
      )}

      {/* Invite collaborator modal */}
      {inviteOpen && playlist && (
        <InviteCollaboratorModal
          playlistId={playlist.id}
          existingCollaborators={collaborators}
          onInvited={(user) => setCollaborators((prev) => [...prev, user])}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  )
}
