import { useEffect, useState } from 'react'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { Spinner } from '@/components/ui/Spinner'

export function RecommendedPlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(async () => {
      try {
        const next = await playlistService.getFeatured(50)
        if (!cancelled) setPlaylists(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">Editorial playlists</h1>
        <p className="mt-1 text-sm text-secondary">
          Admin-curated public playlists, with popular community playlists as fallback.
        </p>
      </div>
      {loading ? (
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
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
