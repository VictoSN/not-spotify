import { useEffect, useState } from 'react'
import type { Album } from '@/types/album'
import { albumService } from '@/services/albumService'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  COLLECTION_GRID_CLASS,
  COLLECTION_PAGE_CLASS,
  CollectionPageHeader,
  CollectionPageSkeleton,
} from '@/components/common/CollectionPage'

export function NewReleasesPage() {
  useDocumentTitle('New Releases')
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    albumService.getNewReleases(50).then(setAlbums).finally(() => setLoading(false))
  }, [])

  if (loading) return <CollectionPageSkeleton label="Loading new releases" />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <CollectionPageHeader
        title="New releases"
        description="Fresh albums and singles, all in one place."
      />
      {albums.length === 0 ? (
        <p className="text-secondary">No new releases.</p>
      ) : (
        <div className={COLLECTION_GRID_CLASS}>
          {albums.map((a) => (
            <AlbumCard key={a.id} album={a} fluid />
          ))}
        </div>
      )}
    </div>
  )
}
