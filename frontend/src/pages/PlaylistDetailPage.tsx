import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PlayIcon, ClockIcon } from '@heroicons/react/24/solid'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { usePlayerStore } from '@/stores/playerStore'
import { TrackRow } from '@/components/cards/TrackRow'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [loading, setLoading] = useState(true)
  const { play } = usePlayerStore()

  useEffect(() => {
    if (!id) return
    playlistService.getById(id).then((p) => { setPlaylist(p); setLoading(false) })
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (!playlist) return <div className="p-8 text-secondary">Playlist not found.</div>

  const tracks = playlist.tracks.map((pt) => pt.track)

  const handlePlayAll = () => {
    if (tracks.length > 0) play(tracks[0], tracks)
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
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Playlist</p>
          <h1 className="text-4xl sm:text-5xl font-black text-primary mt-1 mb-3">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-secondary text-sm mb-2">{playlist.description}</p>
          )}
          <p className="text-xs text-secondary">
            <span className="font-semibold text-primary">{playlist.owner.name}</span>
            {' · '}{formatNumber(playlist.followerCount)} likes
            {' · '}{tracks.length} songs,{' '}
            {formatMs(playlist.totalDurationMs)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 py-4">
        <Button onClick={handlePlayAll} size="lg" className="gap-2">
          <PlayIcon className="w-5 h-5" />
          Play
        </Button>
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
          <span className="flex justify-end"><ClockIcon className="w-4 h-4 text-secondary" /></span>
        </div>

        {tracks.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} queue={tracks} showAlbum />
        ))}
      </div>
    </div>
  )
}
