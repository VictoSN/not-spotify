import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PlayIcon, ClockIcon } from '@heroicons/react/24/solid'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { albumService } from '@/services/albumService'
import { trackService } from '@/services/trackService'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { TrackRow } from '@/components/cards/TrackRow'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatMs } from '@/utils/formatTime'

export function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [album, setAlbum] = useState<Album | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const { play } = usePlayerStore()
  const { savedAlbumIds, saveAlbum, unsaveAlbum } = useLibraryStore()

  useEffect(() => {
    if (!id) return
    Promise.all([albumService.getById(id), trackService.getByAlbum(id)]).then(([a, t]) => {
      setAlbum(a)
      setTracks(t)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (!album) return <div className="p-8 text-secondary">Album not found.</div>

  const isSaved = savedAlbumIds.has(album.id)
  const totalDuration = tracks.reduce((acc, t) => acc + t.durationMs, 0)

  return (
    <div>
      <div className="flex items-end gap-6 p-6 pb-4 bg-gradient-to-b from-accent-dim/40 to-transparent">
        <img src={album.coverUrl} alt={album.title} className="w-44 h-44 sm:w-56 sm:h-56 rounded-md shadow-2xl flex-shrink-0 object-cover" />
        <div className="min-w-0 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">{album.type.toUpperCase()}</Badge>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-primary mb-2">{album.title}</h1>
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
            <span className="text-secondary">{tracks.length} songs, {formatMs(totalDuration)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 py-4">
        <Button onClick={() => tracks.length && play(tracks[0], tracks)} size="lg" className="gap-2">
          <PlayIcon className="w-5 h-5" /> Play
        </Button>
        <Button
          variant="outline"
          onClick={() => isSaved ? unsaveAlbum(album.id) : saveAlbum(album)}
        >
          {isSaved ? 'Saved' : 'Save to library'}
        </Button>
      </div>

      <div className="px-4">
        <div
          className="grid items-center gap-4 px-4 py-2 border-b border-elevated/30 mb-2"
          style={{ gridTemplateColumns: '16px 6fr 3fr 1fr' }}
        >
          <span className="text-xs text-secondary">#</span>
          <span className="text-xs text-secondary uppercase tracking-wider">Title</span>
          <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">Plays</span>
          <span className="flex justify-end"><ClockIcon className="w-4 h-4 text-secondary" /></span>
        </div>
        {tracks.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} queue={tracks} showPlayCount />
        ))}
      </div>
    </div>
  )
}
