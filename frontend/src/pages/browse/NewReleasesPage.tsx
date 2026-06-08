import { useEffect, useState } from 'react'
import type { Album } from '@/types/album'
import { albumService } from '@/services/albumService'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { Spinner } from '@/components/ui/Spinner'

export function NewReleasesPage() {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    albumService.getNewReleases(50).then(setAlbums).finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-6 py-6">
      <h1 className="text-3xl font-bold text-primary mb-6">New releases</h1>
      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : albums.length === 0 ? (
        <p className="text-secondary">No new releases.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {albums.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </div>
      )}
    </div>
  )
}
