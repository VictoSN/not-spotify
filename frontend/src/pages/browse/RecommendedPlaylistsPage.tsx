import { useEffect, useState } from 'react'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { Spinner } from '@/components/ui/Spinner'

export function RecommendedPlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    playlistService.getRecommended(50).then(setPlaylists).finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-6 py-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Recommended playlists</h1>
      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : playlists.length === 0 ? (
        <p className="text-secondary">No public playlists yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {playlists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </div>
      )}
    </div>
  )
}
