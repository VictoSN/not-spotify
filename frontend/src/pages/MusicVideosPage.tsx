import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon, FilmIcon } from '@heroicons/react/24/solid'
import type { MusicVideo } from '@/types/musicVideo'
import { videoService } from '@/services/videoService'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatMs } from '@/utils/formatTime'
import { VideoMenu, type VideoMenuHandle } from '@/components/cards/VideoMenu'
import { openMenuAtPointer } from '@/utils/contextMenu'
import {
  COLLECTION_PAGE_CLASS,
  VIDEO_COLLECTION_GRID_CLASS,
  CollectionPageHeader,
  CollectionPageSkeleton,
} from '@/components/common/CollectionPage'

export function MusicVideosPage() {
  const [videos, setVideos] = useState<MusicVideo[]>([])
  const [loading, setLoading] = useState(true)

  useDocumentTitle('Music videos')

  useEffect(() => {
    videoService.list()
      .then(setVideos)
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <CollectionPageSkeleton label="Loading music videos" variant="video" count={9} />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <CollectionPageHeader
        title="Music videos"
        description="Watch the latest visuals from artists you love."
      />
      {videos.length === 0 ? (
        <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">
          No music videos yet.
        </div>
      ) : (
        <div className={VIDEO_COLLECTION_GRID_CLASS}>
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} queue={videos} />
          ))}
        </div>
      )}
    </div>
  )
}

function VideoCard({ video: v, queue }: { video: MusicVideo; queue: MusicVideo[] }) {
  const menuRef = useRef<VideoMenuHandle>(null)
  return (
    <div className="group relative" onContextMenu={(e) => openMenuAtPointer(e, menuRef)}>
      <Link to={`/videos/${v.id}`} state={{ videoQueue: queue }} className="block rounded-lg p-2 transition-colors hover:bg-surface">
        <div className="relative mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-md bg-elevated">
          {v.thumbnailUrl
            ? <img src={v.thumbnailUrl} alt={v.title} className="h-full w-full object-cover" />
            : <FilmIcon className="h-10 w-10 text-secondary/60" />}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-page">
              <PlayIcon className="h-6 w-6 translate-x-[1px]" />
            </span>
          </div>
          {v.durationMs > 0 && (
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {formatMs(v.durationMs)}
            </span>
          )}
        </div>
        <div className="truncate px-1 font-semibold text-primary">{v.title}</div>
        <div className="truncate px-1 text-sm text-secondary">{v.artist.name}</div>
      </Link>

      {/* ⋯ button — sits over the artwork, mirrors the card menus elsewhere. */}
      <div className="absolute right-3 top-3">
        <VideoMenu
          ref={menuRef}
          video={v}
          triggerClassName="rounded-full bg-black/60 p-1.5 backdrop-blur-sm"
        />
      </div>
    </div>
  )
}
