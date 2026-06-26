import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MicrophoneIcon } from '@heroicons/react/24/solid'
import type { PodcastSummary } from '@/types/podcast'
import { podcastService } from '@/services/podcastService'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PodcastMenu, type PodcastMenuHandle } from '@/components/cards/PodcastMenu'
import { openMenuAtPointer } from '@/utils/contextMenu'

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

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <h1 className="mb-4 text-2xl font-black text-primary">Podcasts</h1>
      {podcasts.length === 0 ? (
        <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">
          No podcasts yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
        className="block rounded-lg bg-surface p-4 transition-colors hover:bg-elevated"
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
