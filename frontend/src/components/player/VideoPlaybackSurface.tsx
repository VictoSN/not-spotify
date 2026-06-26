import { useEffect, useRef, useState } from 'react'
import type { MusicVideo } from '@/types/musicVideo'
import { usePlayerStore } from '@/stores/playerStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'

interface VideoPlaybackSurfaceProps {
  video: MusicVideo
  className?: string
}

export function VideoPlaybackSurface({ video, className }: VideoPlaybackSurfaceProps) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [hasPaintedFrame, setHasPaintedFrame] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const isVideoPlaying = usePlayerStore((s) => s.isVideoPlaying)
  const videoCurrentTime = usePlayerStore((s) => s.videoCurrentTime)
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const pauseVideo = usePlayerStore((s) => s.pauseVideo)
  const videoTick = usePlayerStore((s) => s.videoTick)
  const skipNext = usePlayerStore((s) => s.skipNext)

  useEffect(() => {
    setHasPaintedFrame(false)
    setLoadFailed(false)
    setAutoplayBlocked(false)
  }, [video.id, video.videoUrl])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.volume = volume
    el.muted = isMuted
  }, [isMuted, volume])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (Math.abs(el.currentTime - videoCurrentTime) > 1) {
      el.currentTime = Math.max(0, videoCurrentTime)
    }
  }, [videoCurrentTime])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (isVideoPlaying) {
      setAutoplayBlocked(false)
      el.play().catch(() => {
        setAutoplayBlocked(true)
        pauseVideo()
      })
    } else {
      el.pause()
    }
  }, [isVideoPlaying, pauseVideo, video.id])

  const showPoster = !!video.thumbnailUrl && (!hasPaintedFrame || autoplayBlocked || (!isVideoPlaying && videoCurrentTime < 0.25))

  return (
    <div className={cn('relative aspect-video w-full overflow-hidden bg-black', className)}>
      <video
        ref={ref}
        key={video.id}
        src={video.videoUrl}
        poster={video.thumbnailUrl ?? undefined}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration || video.durationMs / 1000 || 0
          videoTick(event.currentTarget.currentTime, duration)
        }}
        onLoadedData={(event) => {
          setHasPaintedFrame(true)
          const duration = event.currentTarget.duration || video.durationMs / 1000 || 0
          videoTick(event.currentTarget.currentTime, duration)
        }}
        onPlaying={() => {
          setHasPaintedFrame(true)
          setAutoplayBlocked(false)
        }}
        onTimeUpdate={(event) => {
          setHasPaintedFrame(true)
          videoTick(event.currentTarget.currentTime, event.currentTarget.duration || 0)
        }}
        onError={() => {
          setLoadFailed(true)
          pauseVideo()
        }}
        onEnded={() => skipNext()}
        className="h-full w-full object-contain"
      />

      {showPoster && (
        <img
          src={video.thumbnailUrl ?? undefined}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      )}

      {!loadFailed && !hasPaintedFrame && !video.thumbnailUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {loadFailed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black px-6 text-center">
          <p className="text-sm font-semibold text-primary">Video failed to load.</p>
        </div>
      )}
    </div>
  )
}
