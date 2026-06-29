import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MicrophoneIcon } from '@heroicons/react/24/solid'
import type { PodcastSummary } from '@/types/podcast'
import { podcastService } from '@/services/podcastService'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PodcastMenu, type PodcastMenuHandle } from '@/components/cards/PodcastMenu'
import { openMenuAtPointer } from '@/utils/contextMenu'
import {
  COLLECTION_GRID_CLASS,
  COLLECTION_PAGE_CLASS,
  CollectionPageHeader,
  CollectionPageSkeleton,
} from '@/components/common/CollectionPage'

export function PodcastsPage() {
  const [podcasts, setPodcasts] = useState<PodcastSummary[]>([])
  const [loading, setLoading] = useState(true)

  useDocumentTitle('Podcasts')

  useEffect(() => {
    podcastService
      .getAll()
      .then(setPodcasts)
      .catch(() => setPodcasts([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <CollectionPageSkeleton label="Loading podcasts" />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <CollectionPageHeader
        title="Podcasts"
        description="Shows and episodes worth listening to."
      />
      {podcasts.length === 0 ? (
        <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">
          No podcasts yet.
        </div>
      ) : (
        <div className={COLLECTION_GRID_CLASS}>
          {podcasts.map((p) => (
            <PodcastGridCard key={p.id} podcast={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function PodcastGridCard({ podcast: p }: { podcast: PodcastSummary }) {
  const menuRef = useRef<PodcastMenuHandle>(null)
  return (
    <div className="group relative" onContextMenu={(e) => openMenuAtPointer(e, menuRef)}>
      <Link
        to={`/podcasts/${p.id}`}
        className="block rounded-lg p-3 transition-colors hover:bg-surface"
      >
        <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-elevated">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
          ) : (
            <MicrophoneIcon className="h-12 w-12 text-secondary/60" />
          )}
        </div>
        <div className="truncate font-bold text-primary">{p.title}</div>
        <div className="truncate text-sm text-secondary">{p.author}</div>
        <div className="mt-1 text-xs text-secondary">
          {p.episodeCount} {p.episodeCount === 1 ? 'episode' : 'episodes'}
        </div>
      </Link>
      <div className="absolute right-5 top-5">
        <PodcastMenu
          ref={menuRef}
          podcast={p}
          triggerClassName="rounded-full bg-black/60 p-1.5 backdrop-blur-sm"
        />
      </div>
    </div>
  )
}
