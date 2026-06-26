import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import type { MusicVideo } from '@/types/musicVideo'
import { videoService } from '@/services/videoService'
import { usePlayerStore } from '@/stores/playerStore'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { VideoMenu, type VideoMenuHandle } from '@/components/cards/VideoMenu'
import { VideoPlaybackSurface } from '@/components/player/VideoPlaybackSurface'
import { MusicVideoLinkedTrackCard } from '@/components/player/MusicVideoLinkedTrackCard'
import { CommentSection } from '@/components/comments/CommentSection'
import { openMenuAtPointer } from '@/utils/contextMenu'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'

export function MusicVideoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [video, setVideo] = useState<MusicVideo | null>(null)
  const [videos, setVideos] = useState<MusicVideo[]>([])
  const [loading, setLoading] = useState(true)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const currentVideo = usePlayerStore((s) => s.currentVideo)
  const videoCurrentTime = usePlayerStore((s) => s.videoCurrentTime)
  const seek = usePlayerStore((s) => s.seek)
  const playVideo = usePlayerStore((s) => s.playVideo)
  const menuRef = useRef<VideoMenuHandle>(null)
  const suppressPlayerNavigationRef = useRef(false)
  const routeStartedRef = useRef<string | null>(null)

  const navigationQueue = (location.state as { videoQueue?: MusicVideo[] } | null)?.videoQueue
  const activeVideo = playbackMode === 'video' && currentVideo?.id === id ? currentVideo : video
  const queue = useMemo(
    () => navigationQueue && navigationQueue.length > 0 ? navigationQueue : videos.length > 0 ? videos : activeVideo ? [activeVideo] : [],
    [activeVideo, navigationQueue, videos],
  )
  const videoTimeline = useMemo(() => activeVideo ? buildVideoTimeline(activeVideo.id) : [], [activeVideo?.id])

  useDocumentTitle(activeVideo ? activeVideo.title : 'Music video')

  useEffect(() => {
    if (!id) return
    suppressPlayerNavigationRef.current = true
    routeStartedRef.current = null
    let cancelled = false
    setLoading(true)
    Promise.all([
      videoService.getById(id),
      videoService.list().catch(() => []),
    ])
      .then(([v, list]) => {
        if (!cancelled) {
          setVideo(v)
          setVideos(list)
        }
      })
      .catch(() => {
        if (!cancelled) setVideo(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !video || video.id !== id || routeStartedRef.current === video.id) return
    routeStartedRef.current = video.id
    if (playbackMode === 'video' && currentVideo?.id === video.id) return
    playVideo(video, queue.length > 0 ? queue : [video])
  }, [currentVideo?.id, id, playVideo, playbackMode, queue, video])

  useEffect(() => {
    if (currentVideo?.id === id) suppressPlayerNavigationRef.current = false
    if (playbackMode !== 'video' || !currentVideo || currentVideo.id === id) return
    if (suppressPlayerNavigationRef.current && video?.id === id) return
    navigate(`/videos/${currentVideo.id}`, { replace: true, state: { videoQueue: videos } })
  }, [currentVideo, id, navigate, playbackMode, video?.id, videos])

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  if (!activeVideo) return <div className="p-8 text-secondary">Video not found.</div>

  const handleSeek = (seconds: number) => {
    if (currentVideo?.id !== activeVideo.id || playbackMode !== 'video') playVideo(activeVideo, queue)
    seek(seconds)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
      <Link to="/videos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary">
        <ArrowLeftIcon className="h-4 w-4" /> Music videos
      </Link>

      <div
        className="overflow-hidden rounded-lg bg-black shadow-2xl"
        onContextMenu={(e) => openMenuAtPointer(e, menuRef)}
      >
        <VideoPlaybackSurface video={activeVideo} />
      </div>

      <div className="mt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-black leading-tight text-primary md:text-3xl">{activeVideo.title}</h1>
          <VideoMenu ref={menuRef} video={activeVideo} alwaysVisible triggerIconClassName="h-6 w-6 stroke-[2.2] text-secondary hover:text-primary" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-secondary">
          <Link to={`/artist/${activeVideo.artist.id}`} className="font-semibold text-primary hover:underline">
            {activeVideo.artist.name}
          </Link>
          <span>-</span>
          <span>{formatNumber(activeVideo.viewCount)} views</span>
          {activeVideo.durationMs > 0 && (
            <>
              <span>-</span>
              <span>{formatMs(activeVideo.durationMs)}</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <MusicVideoLinkedTrackCard trackId={activeVideo.trackId} />

        <section className="rounded-lg bg-surface p-4">
          <h2 className="text-lg font-black text-primary">About this video</h2>
          {activeVideo.description ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-secondary">{activeVideo.description}</p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-secondary">No description has been added for this music video yet.</p>
          )}
        </section>

        <section className="rounded-lg bg-surface p-4">
          <CommentSection
            trackId={activeVideo.id}
            trackTitle={activeVideo.title}
            durationMs={activeVideo.durationMs}
            waveform={videoTimeline}
            onSeek={handleSeek}
            commentsApi={videoService}
            canPinAtCurrentTime={playbackMode === 'video' && currentVideo?.id === activeVideo.id}
            currentTimeSeconds={videoCurrentTime}
            waveformLabel="Click the video timeline to pin a comment to that moment."
          />
        </section>
      </div>
    </div>
  )
}

function buildVideoTimeline(seed: string): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return Array.from({ length: 96 }, (_, index) => {
    hash = (hash * 1664525 + 1013904223 + index) >>> 0
    const wave = 0.5 + Math.sin(index * 0.31) * 0.22 + Math.sin(index * 0.09) * 0.16
    const noise = (hash % 1000) / 1000 * 0.35
    return Math.max(0.12, Math.min(1, wave + noise - 0.18))
  })
}
