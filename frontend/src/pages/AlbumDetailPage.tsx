import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PlayIcon, ClockIcon, HeartIcon as HeartSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { HeartIcon, StarIcon } from '@heroicons/react/24/outline'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { albumService } from '@/services/albumService'
import { trackService } from '@/services/trackService'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { TrackRow } from '@/components/cards/TrackRow'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatMs } from '@/utils/formatTime'
import { useDominantColor } from '@/hooks/useDominantColor'

export function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [album, setAlbum] = useState<Album | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const playWithGate = usePlaybackGate()
  const { savedAlbumIds, saveAlbum, unsaveAlbum } = useLibraryStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)

  useEffect(() => {
    if (!id) return
    Promise.all([albumService.getById(id), trackService.getByAlbum(id)]).then(([a, t]) => {
      setAlbum(a)
      setTracks(t)
      setLoading(false)
    })
  }, [id])

  const heroColor = useDominantColor(album?.coverUrl)

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  if (!album) return <div className="p-8 text-secondary">Album not found.</div>

  const isSaved = savedAlbumIds.has(album.id)
  const totalDuration = tracks.reduce((acc, t) => acc + t.durationMs, 0)
  const toggleSave = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Save music with a free account', imageUrl: album.coverUrl })
      return
    }
    if (isSaved) unsaveAlbum(album.id)
    else saveAlbum(album)
  }

  return (
    <div>
      <div
        className="flex items-end gap-6 p-6 pb-4 bg-gradient-to-b from-accent-dim/40 to-transparent"
        style={{
          background: heroColor
            ? `linear-gradient(to bottom, ${heroColor}b3 0%, ${heroColor}33 60%, transparent 100%)`
            : undefined,
        }}
      >
        <img
          src={album.coverUrl}
          alt={album.title}
          className="w-44 h-44 sm:w-56 sm:h-56 rounded-md shadow-2xl flex-shrink-0 object-cover"
        />
        <div className="min-w-0 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">{album.type.toUpperCase()}</Badge>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-primary mb-2">{album.title}</h1>
          {/* Stats row */}
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            {(album.ratingCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-sm text-yellow-400 font-semibold">
                <StarSolid className="w-4 h-4" />
                {(album.averageRating ?? 0).toFixed(1)}
                <span className="text-secondary font-normal ml-0.5">({(album.ratingCount ?? 0).toLocaleString()})</span>
              </span>
            )}
            <span className="flex items-center gap-1 text-sm text-secondary">
              <PlayIcon className="w-4 h-4" />
              {(album.totalPlays ?? 0).toLocaleString()} plays
            </span>
            <span className="flex items-center gap-1 text-sm text-secondary">
              <HeartSolid className="w-4 h-4 text-accent" />
              {(album.totalSaves ?? 0).toLocaleString()} saves
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {album.artist.imageUrl && (
              <img src={album.artist.imageUrl} alt={album.artist.name} className="w-6 h-6 rounded-full object-cover" />
            )}
            <Link to={`/artist/${album.artist.id}`} className="font-semibold text-primary hover:underline">
              {album.artist.name}
            </Link>
            <span className="text-secondary">·</span>
            <span className="text-secondary">{album.releaseDate.slice(0, 4)}</span>
            <span className="text-secondary">·</span>
            <span className="text-secondary">
              {tracks.length} songs, {formatMs(totalDuration)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 py-4">
        <Button onClick={() => tracks.length && playWithGate(tracks[0], tracks)} size="lg" className="gap-2">
          <PlayIcon className="w-5 h-5" /> Play
        </Button>
        <button
          onClick={toggleSave}
          title={isSaved ? 'Remove from library' : 'Save to library'}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
            isSaved
              ? 'border-accent text-accent hover:border-red-400 hover:text-red-400'
              : 'border-elevated/60 text-secondary hover:border-primary hover:text-primary'
          }`}
        >
          {isSaved ? <HeartSolid className="w-5 h-5" /> : <HeartIcon className="w-5 h-5" />}
          {isSaved ? 'Saved' : 'Save to library'}
        </button>
      </div>

      <div className="px-4">
        <div
          className="grid items-center gap-4 px-4 py-2 border-b border-elevated/30 mb-2"
          style={{ gridTemplateColumns: '16px 6fr 3fr var(--track-actions-width)' }}
        >
          <span className="text-xs text-secondary">#</span>
          <span className="text-xs text-secondary uppercase tracking-wider">Title</span>
          <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">Plays</span>
          <div className="grid grid-cols-[32px_50px_32px] sm:grid-cols-[80px_32px_50px_32px] items-center gap-1.5 sm:gap-2 justify-end w-[114px] sm:w-[194px] ml-auto">
            <span className="hidden sm:block" />
            <span />
            <span className="flex justify-end pr-1">
              <ClockIcon className="w-4 h-4 text-secondary" />
            </span>
            <span />
          </div>
        </div>
        {tracks.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} queue={tracks} showPlayCount />
        ))}
      </div>
    </div>
  )
}
