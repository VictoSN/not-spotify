import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PlayIcon, ClockIcon } from '@heroicons/react/24/solid'
import { HeartIcon as HeartOutlineIcon, TrashIcon, GlobeAltIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { TrackRow } from '@/components/cards/TrackRow'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const savePlaylist = useLibraryStore((s) => s.savePlaylist)
  const unsavePlaylist = useLibraryStore((s) => s.unsavePlaylist)
  const setPlaylistVisibility = useLibraryStore((s) => s.setPlaylistVisibility)
  const deletePlaylistAction = useLibraryStore((s) => s.deletePlaylist)

  useEffect(() => {
    if (!id) return
    playlistService.getById(id).then((p) => {
      setPlaylist(p)
      setLoading(false)
    })
  }, [id])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  if (!playlist) return <div className="p-8 text-secondary">Playlist not found.</div>

  const tracks = playlist.tracks.map((pt) => pt.track)

  const handlePlayAll = () => {
    if (tracks.length > 0) playWithGate(tracks[0], tracks)
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

  const handleVisibilityToggle = async () => {
    if (!playlist) return
    const next = !playlist.isPublic
    setBusy(true)
    try {
      await setPlaylistVisibility(playlist.id, next)
      setPlaylist({ ...playlist, isPublic: next })
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-end gap-6 p-6 pb-4 bg-gradient-to-b from-accent-dim/40 to-transparent">
        <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-md shadow-2xl overflow-hidden flex-shrink-0 bg-elevated">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🎵</div>
          )}
        </div>
        <div className="min-w-0 pb-2">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider">
            {playlist.isPublic ? 'Public playlist' : 'Private playlist'}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-primary mt-1 mb-3">{playlist.name}</h1>
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
      <div className="flex items-center gap-4 px-6 py-4">
        <Button onClick={handlePlayAll} size="lg" className="gap-2">
          <PlayIcon className="w-5 h-5" />
          Play
        </Button>

        {/* Owner-only: visibility toggle + delete */}
        {playlist.isOwner && (
          <>
            <button
              onClick={handleVisibilityToggle}
              disabled={busy}
              title={playlist.isPublic ? 'Make private' : 'Make public'}
              className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {playlist.isPublic ? (
                <>
                  <GlobeAltIcon className="w-5 h-5" />
                  Public
                </>
              ) : (
                <>
                  <LockClosedIcon className="w-5 h-5" />
                  Private
                </>
              )}
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
      </div>

      {/* Track list */}
      <div className="px-4">
        {/* Column headers */}
        <div
          className="grid items-center gap-4 px-4 py-2 border-b border-elevated/30 mb-2"
          style={{ gridTemplateColumns: '16px 6fr 4fr 3fr 1fr' }}
        >
          <span className="text-xs text-secondary">#</span>
          <span className="text-xs text-secondary uppercase tracking-wider">Title</span>
          <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">Album</span>
          <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">Date added</span>
          <span className="flex justify-end">
            <ClockIcon className="w-4 h-4 text-secondary" />
          </span>
        </div>

        {tracks.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} queue={tracks} showAlbum />
        ))}
      </div>
    </div>
  )
}
