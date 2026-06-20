import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon, FilmIcon } from '@heroicons/react/24/solid'
import type { MusicVideo } from '@/types/musicVideo'
import { videoService } from '@/services/videoService'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatMs } from '@/utils/formatTime'

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

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <h1 className="mb-4 text-2xl font-black text-primary">Music videos</h1>
      {videos.length === 0 ? (
        <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">
          No music videos yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <Link key={v.id} to={`/videos/${v.id}`} className="group rounded-lg bg-surface p-2 transition-colors hover:bg-elevated">
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
          ))}
        </div>
      )}
    </div>
  )
}
