import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import type { MusicVideo } from '@/types/musicVideo'
import { videoService } from '@/services/videoService'
import { usePlayerStore } from '@/stores/playerStore'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { VideoMenu, type VideoMenuHandle } from '@/components/cards/VideoMenu'
import { openMenuAtPointer } from '@/utils/contextMenu'

export function MusicVideoPage() {
  const { id } = useParams<{ id: string }>()
  const [video, setVideo] = useState<MusicVideo | null>(null)
  const [loading, setLoading] = useState(true)
  const pauseAudio = usePlayerStore((s) => s.pause)
  const menuRef = useRef<VideoMenuHandle>(null)

  useDocumentTitle(video ? video.title : 'Music video')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    videoService.getById(id)
      .then((v) => { if (!cancelled) setVideo(v) })
      .catch(() => { if (!cancelled) setVideo(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  if (!video) return <div className="p-8 text-secondary">Video not found.</div>

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-6">
      <Link to="/videos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary">
        <ArrowLeftIcon className="h-4 w-4" /> Music videos
      </Link>

      <div
        className="overflow-hidden rounded-lg bg-black"
        onContextMenu={(e) => openMenuAtPointer(e, menuRef)}
      >
        <video
          src={video.videoUrl}
          poster={video.thumbnailUrl ?? undefined}
          controls
          autoPlay
          playsInline
          // Stop the audio player so the two don't overlap.
          onPlay={() => pauseAudio()}
          className="aspect-video w-full"
        />
      </div>

      <div className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-black text-primary">{video.title}</h1>
          <VideoMenu ref={menuRef} video={video} alwaysVisible triggerIconClassName="h-6 w-6 stroke-[2.2] text-secondary hover:text-primary" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-secondary">
          <Link to={`/artist/${video.artist.id}`} className="font-semibold text-primary hover:underline">
            {video.artist.name}
          </Link>
          <span>·</span>
          <span>{video.viewCount.toLocaleString()} views</span>
          {video.trackId && (
            <>
              <span>·</span>
              <Link to={`/track/${video.trackId}`} className="text-accent hover:underline">Listen to the track</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
