import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PlayIcon, ClockIcon } from '@heroicons/react/24/solid'
import {
  HeartIcon as HeartOutlineIcon,
  TrashIcon,
  GlobeAltIcon,
  LockClosedIcon,
  UsersIcon,
  PencilSquareIcon,
  PhotoIcon,
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  UserPlusIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import type { Playlist, PlaylistVisibility } from '@/types/playlist'
import type { Track } from '@/types/track'
import type { UserRef } from '@/types/user'
import { playlistService } from '@/services/playlistService'
import { collaboratorService } from '@/services/collaboratorService'
import { trackService } from '@/services/trackService'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useDominantColor, withAlpha } from '@/hooks/useDominantColor'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { TrackRow } from '@/components/cards/TrackRow'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { InviteCollaboratorModal } from '@/components/friends/InviteCollaboratorModal'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'
import { cn } from '@/utils/cn'

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [loadError, setLoadError] = useState<'notfound' | 'forbidden' | null>(null)
  useDocumentTitle(playlist?.name ?? null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [collaborators, setCollaborators] = useState<UserRef[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [findPanelOpen, setFindPanelOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [recommendations, setRecommendations] = useState<Track[]>([])
  const [addingTrackIds, setAddingTrackIds] = useState<Set<string>>(new Set())
  const debouncedQuery = useDebounce(searchQuery, 300)
  const [downloading, setDownloading] = useState(false)
  const playWithGate = usePlaybackGate()
  const isMobile = useIsMobile()
  const { isAuthenticated, user } = useAuthStore()
  const isPremium = user?.plan === 'premium'
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const savePlaylist = useLibraryStore((s) => s.savePlaylist)
  const unsavePlaylist = useLibraryStore((s) => s.unsavePlaylist)
  const setPlaylistVisibility = useLibraryStore((s) => s.setPlaylistVisibility)
  const deletePlaylistAction = useLibraryStore((s) => s.deletePlaylist)
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist)
  const syncPlaylistTracks = useLibraryStore((s) => s.syncPlaylistTracks)
  const savedPlaylists = useLibraryStore((s) => s.savedPlaylists)
  const shuffleEnabled = usePlayerStore((s) => s.shuffleEnabled)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  // Tint the header from the playlist cover; playlists without one fall back
  // to the first track's album art (matches what the placeholder tile shows).
  const heroColor = useDominantColor(playlist?.coverUrl ?? playlist?.tracks?.[0]?.album.coverUrl)

  useEffect(() => {
    if (!id) return
    playlistService.getById(id)
      .then((p) => {
        setPlaylist(p)
        setEditName(p.name)
        setEditDescription(p.description ?? '')
        syncPlaylistTracks(p.id, p.tracks)
      })
      .catch((err) => {
        const status = err?.response?.status
        setLoadError(status === 403 ? 'forbidden' : 'notfound')
        setPlaylist(null)
      })
      .finally(() => setLoading(false))
    // Fetch collaborators in parallel (silently ignore if endpoint not yet live).
    collaboratorService.list(id).then(setCollaborators).catch(() => {})
  }, [id])

  // Keep local playlist state in sync with the store so that add/remove operations
  // triggered from TrackRowMenu (which write to the store) are reflected immediately.
  useEffect(() => {
    if (!playlist) return
    const storePlaylist = savedPlaylists.find((p) => p.id === playlist.id)
    if (!storePlaylist) return
    setPlaylist((prev) => prev ? { ...prev, tracks: storePlaylist.tracks, totalDurationMs: storePlaylist.totalDurationMs } : prev)
  }, [savedPlaylists])

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
      setSearchResults([])
      return
    }
    let cancelled = false
    trackService.search(q).then((tracks) => {
      if (!cancelled) setSearchResults(tracks)
    }).catch(() => {
      if (!cancelled) setSearchResults([])
    })
    return () => { cancelled = true }
  }, [debouncedQuery, playlist?.isOwner, playlist?.isCollaborator])

  // Tracks already in the playlist (or in-flight) should never appear in the find panel.
  const findCandidates = useMemo(() => {
    if (!playlist) return []
    const present = new Set(playlist.tracks.map((pt) => pt.track.id))
    const filter = (t: Track) => !present.has(t.id) && !addingTrackIds.has(t.id)
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

  const tracks = playlist.tracks.map((pt) => pt.track)

  const handlePlayAll = () => {
    if (tracks.length > 0) playWithGate(tracks[0], tracks)
  }

  const handleDownload = async () => {
    if (!playlist) return
    setDownloading(true)
    try {
      await playlistService.downloadZip(playlist.id, playlist.name)
    } finally {
      setDownloading(false)
    }
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
    if (!confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return
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
      })
      if (coverFile) {
        updated = await playlistService.uploadCover(playlist.id, coverFile)
        setCoverFile(null)
      }
      setPlaylist(updated)
      setEditName(updated.name)
      setEditDescription(updated.description ?? '')
      setEditOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async (track: Track) => {
    if (!playlist) return
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
      setAddingTrackIds((s) => {
        const next = new Set(s)
        next.delete(track.id)
        return next
      })
    }
  }

  return (
    <div>
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 p-4 sm:p-6 pb-4 bg-gradient-to-b from-accent-dim/40 to-transparent"
        style={{
          background: heroColor
            ? `linear-gradient(to bottom, ${withAlpha(heroColor, 0.7)} 0%, ${withAlpha(heroColor, 0.2)} 60%, transparent 100%)`
            : undefined,
        }}
      >
        <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-56 md:h-56 rounded-md shadow-2xl overflow-hidden flex-shrink-0 bg-elevated self-center sm:self-auto">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🎵</div>
          )}
        </div>
        <div className="min-w-0 pb-2">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider">
            {{ public: 'Public playlist', friends: 'Friends only', private: 'Private playlist' }[currentVisibility()]}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mt-1 mb-3 break-words">{playlist.name}</h1>
          {playlist.description && <p className="text-secondary text-sm mb-2">{playlist.description}</p>}
          <p className="text-xs text-secondary">
            <span className="font-semibold text-primary">{playlist.owner.name}</span>
            {' · '}
            {formatNumber(playlist.followerCount)} likes
            {' · '}
            {tracks.length} songs, {formatMs(playlist.totalDurationMs)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4">
        <Button onClick={handlePlayAll} size="lg" className="gap-2">
          <PlayIcon className="w-5 h-5" />
          Play
        </Button>

        {/* Shuffle — visible to all viewers, playback pref only */}
        <button
          onClick={toggleShuffle}
          title={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
          aria-pressed={shuffleEnabled}
          className={cn(
            'relative flex items-center justify-center w-10 h-10 rounded-full transition-all hover:scale-110 active:scale-95',
            shuffleEnabled ? 'text-accent' : 'text-secondary hover:text-primary',
          )}
        >
          <ArrowsRightLeftIcon className="w-5 h-5" />
          {shuffleEnabled && (
            <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
          )}
        </button>

        {/* Owner-only: visibility toggle + delete + reopen find panel */}
        {playlist.isOwner && (
          <>
            <button
              onClick={() => setEditOpen((v) => !v)}
              disabled={busy}
              title="Edit details"
              className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              <PencilSquareIcon className="w-5 h-5" />
              Edit
            </button>
            <button
              onClick={handleVisibilityToggle}
              disabled={busy}
              title="Change visibility"
              className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {currentVisibility() === 'public' && <><GlobeAltIcon className="w-5 h-5" />Public</>}
              {currentVisibility() === 'friends' && <><UsersIcon className="w-5 h-5" />Friends Only</>}
              {currentVisibility() === 'private' && <><LockClosedIcon className="w-5 h-5" />Private</>}
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              title="Delete playlist"
              className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-red-400 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              <TrashIcon className="w-5 h-5" />
              Delete
            </button>
            {!findPanelOpen && (
              <button
                onClick={() => setFindPanelOpen(true)}
                title="Add songs"
                className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all"
              >
                <PlusIcon className="w-5 h-5" />
                Add songs
              </button>
            )}

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

            <button
              onClick={() => setInviteOpen(true)}
              title="Invite collaborator"
              className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all"
            >
              <UserPlusIcon className="w-5 h-5" />
              Invite
            </button>
          </>
        )}

        {/* Non-owner: save/unsave to library */}
        {!playlist.isOwner && (
          <button
            onClick={handleSaveToggle}
            disabled={busy}
            title={playlist.isSaved ? 'Remove from your library' : 'Save to your library'}
            className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {playlist.isSaved ? (
              <>
                <HeartSolidIcon className="w-7 h-7 text-accent" />
                In Library
              </>
            ) : (
              <>
                <HeartOutlineIcon className="w-7 h-7" />
                Add to Library
              </>
            )}
          </button>
        )}

        {/* Download — premium only */}
        {isPremium ? (
          <button
            onClick={handleDownload}
            disabled={downloading}
            title="Download playlist as ZIP"
            className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        ) : (
          <button
            onClick={() => navigate('/premium')}
            title="Download is a Premium feature"
            className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-accent hover:scale-105 active:scale-95 transition-all"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Download
            <span className="text-[10px] font-bold uppercase tracking-wide bg-accent/20 text-accent px-1.5 py-0.5 rounded">Premium</span>
          </button>
        )}
      </div>

      {playlist.isOwner && editOpen && (
        <form onSubmit={handleSaveEdits} className="mx-6 mb-4 rounded-lg bg-surface p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-secondary">Name</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-11 rounded-md border border-secondary/20 bg-elevated px-3 text-sm text-primary outline-none transition-colors focus:border-accent"
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-secondary">Description</span>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="min-h-24 rounded-md border border-secondary/20 bg-elevated px-3 py-2 text-sm text-primary outline-none transition-colors focus:border-accent"
                />
              </label>
            </div>

            <div>
              <div className="aspect-square overflow-hidden rounded-md bg-elevated">
                {coverFile ? (
                  <img src={URL.createObjectURL(coverFile)} alt="Cover preview" className="h-full w-full object-cover" />
                ) : playlist.coverUrl ? (
                  <img src={playlist.coverUrl} alt={playlist.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl">🎵</div>
                )}
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-elevated px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-elevated/70">
                <PhotoIcon className="h-4 w-4" />
                Choose cover
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="submit" disabled={busy || !editName.trim()}>
              {busy ? 'Saving...' : 'Save details'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Track list */}
      <div className="px-4">
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

        {playlist.tracks.map((pt, i) => (
          <TrackRow
            key={pt.track.id}
            track={pt.track}
            index={i}
            queue={tracks}
            showAlbum
            addedAt={pt.addedAt}
            currentPlaylistId={playlist.id}
          />
        ))}
      </div>

      {/* "Let's find something for your playlist" panel — owner & collaborators */}
      {(playlist.isOwner || playlist.isCollaborator) && findPanelOpen && (
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
                <AddableRow
                  key={track.id}
                  track={track}
                  disabled={addingTrackIds.has(track.id)}
                  onAdd={() => handleAdd(track)}
                />
              ))}
            </div>
          )}
        </div>
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

/** Lightweight row used inside the "find something" panel: cover, title, artist, album, + */
function AddableRow({
  track,
  onAdd,
  disabled,
}: {
  track: Track
  onAdd: () => void
  disabled?: boolean
}) {
  return (
    <div
      className="grid items-center gap-4 px-3 py-2 rounded-md hover:bg-elevated/50 transition-colors"
      style={{ gridTemplateColumns: '40px minmax(0, 5fr) minmax(0, 3fr) 40px' }}
    >
      <img src={track.album.coverUrl} alt={track.album.title} className="w-10 h-10 rounded object-cover" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary truncate">{track.title}</p>
        <p className="text-xs text-secondary truncate">{track.artist.name}</p>
      </div>
      <p className="text-xs text-secondary truncate hidden md:block">{track.album.title}</p>
      <button
        onClick={onAdd}
        disabled={disabled}
        title="Add to this playlist"
        aria-label={`Add ${track.title} to this playlist`}
        className="w-9 h-9 rounded-full border border-secondary/50 flex items-center justify-center text-primary hover:scale-105 hover:border-accent hover:text-accent active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
      >
        <PlusIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
