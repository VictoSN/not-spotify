import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { PlayIcon } from '@heroicons/react/24/solid'
import { CollapseIcon } from '@/components/common/CollapseIcon'
import { VideoMenu, type VideoMenuHandle } from '@/components/cards/VideoMenu'
import { VideoPlaybackSurface } from './VideoPlaybackSurface'
import type { MusicVideo } from '@/types/musicVideo'
import { videoService } from '@/services/videoService'
import { usePlayerStore } from '@/stores/playerStore'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'
import { MusicVideoLinkedTrackCard } from './MusicVideoLinkedTrackCard'
import { cn } from '@/utils/cn'
import { openMenuAtPointer } from '@/utils/contextMenu'

const NP_KEY = 'ns-nowplaying-width'
const NP_DEFAULT = 320
const NP_MIN = 280
const NP_MAX = 460

function getInitialNpWidth(): number {
  if (typeof window === 'undefined') return NP_DEFAULT
  const stored = Number(window.localStorage.getItem(NP_KEY))
  if (!stored || Number.isNaN(stored)) return NP_DEFAULT
  return Math.min(Math.max(stored, NP_MIN), NP_MAX)
}

function NowPlayingDragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group absolute -left-2 top-0 z-20 flex h-full w-2 cursor-grab justify-center active:cursor-grabbing"
      aria-hidden="true"
    >
      <div className="h-full w-px bg-transparent transition-colors group-hover:bg-secondary/70" />
    </div>
  )
}

export function MusicVideoNowPlayingPanel() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentVideo = usePlayerStore((s) => s.currentVideo)
  const playVideo = usePlayerStore((s) => s.playVideo)
  const isNowPlayingCollapsed = usePlayerStore((s) => s.isNowPlayingCollapsed)
  const setNowPlayingCollapsed = usePlayerStore((s) => s.setNowPlayingCollapsed)
  const [videos, setVideos] = useState<MusicVideo[]>([])
  const [width, setWidth] = useState(getInitialNpWidth)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  const currentVideoMenuRef = useRef<VideoMenuHandle>(null)

  useEffect(() => {
    window.localStorage.setItem(NP_KEY, String(width))
  }, [width])

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: width }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startX - e.clientX
      setWidth(Math.min(Math.max(dragRef.current.startW + delta, NP_MIN), NP_MAX))
    }
    const onUp = () => setDragging(false)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  useEffect(() => {
    let cancelled = false
    videoService
      .list()
      .then((items) => {
        if (!cancelled) setVideos(items)
      })
      .catch(() => {
        if (!cancelled) setVideos([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const recommendations = useMemo(() => {
    if (!currentVideo) return []
    return videos
      .filter((item) => item.id !== currentVideo.id)
      .sort((a, b) => Number(b.artist.id === currentVideo.artist.id) - Number(a.artist.id === currentVideo.artist.id))
      .slice(0, 10)
  }, [currentVideo, videos])

  if (isNowPlayingCollapsed) {
    if (!currentVideo) return null
    return (
      <aside className="group/now-playing-rail animate-right-sidebar-enter relative hidden w-4 shrink-0 overflow-visible rounded-xl bg-surface/0 transition-[width,background-color] duration-300 ease-out hover:w-16 hover:bg-surface/80 lg:flex">
        <button
          onClick={() => setNowPlayingCollapsed(false)}
          className="spotify-tooltip-anchor absolute inset-y-0 left-0 flex w-full flex-col items-center justify-center gap-4 text-secondary opacity-0 transition-all duration-200 hover:text-primary group-hover/now-playing-rail:opacity-100"
          aria-label="Expand now playing"
        >
          {currentVideo?.thumbnailUrl && (
            <img
              src={currentVideo.thumbnailUrl}
              alt={currentVideo.title}
              className="h-10 w-10 rounded object-cover opacity-80 shadow-lg"
            />
          )}
          <ChevronLeftIcon className="h-5 w-5" />
          <span className="spotify-tooltip spotify-tooltip-middle spotify-tooltip-side-right">
            Expand now playing
          </span>
        </button>
      </aside>
    )
  }

  const panelStyle = { flexBasis: width, flexGrow: 0, width }
  const panelClass = cn(
    'sidebar-scrollbar-hover-region animate-right-sidebar-enter relative hidden h-full max-h-full min-h-0 shrink-0 flex-col overflow-visible rounded-xl bg-surface lg:flex',
    !dragging && 'transition-[width,flex-basis,opacity,transform] duration-300 ease-out',
  )

  if (!currentVideo) {
    return (
      <aside style={panelStyle} className={panelClass}>
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl bg-surface/90 p-4 backdrop-blur">
          <h2 className="text-base font-bold text-primary">Music video</h2>
          <button
            onClick={() => setNowPlayingCollapsed(true)}
            className="spotify-tooltip-anchor relative flex h-8 w-8 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
            aria-label="Collapse"
          >
            <CollapseIcon className="h-6 w-6" />
            <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-right">Collapse</span>
          </button>
        </div>
        <p className="px-4 text-sm text-secondary">Play a music video to see it here.</p>
        <NowPlayingDragHandle onMouseDown={onDragStart} />
      </aside>
    )
  }

  const openVideo = (video: MusicVideo) => {
    const queue = videos.length > 0 ? videos : [video]
    playVideo(video, queue)
    navigate(`/videos/${video.id}`, { state: { videoQueue: queue } })
  }
  const isCurrentWatchPage = location.pathname === `/videos/${currentVideo.id}`

  return (
    <aside style={panelStyle} className={panelClass}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-xl bg-surface/90 p-4 backdrop-blur">
        <h2 className="truncate text-base font-bold text-primary">Music video</h2>
        <button
          onClick={() => setNowPlayingCollapsed(true)}
          className="spotify-tooltip-anchor relative flex h-8 w-8 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
          aria-label="Collapse"
        >
          <CollapseIcon className="h-6 w-6" />
          <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-right">Collapse</span>
        </button>
      </div>

      <div className="spotify-scrollbar sidebar-hover-scrollbar ns-bleed-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        <div className="group/current-video relative" onContextMenu={(event) => openMenuAtPointer(event, currentVideoMenuRef)}>
          {isCurrentWatchPage ? (
            <Link to={`/videos/${currentVideo.id}`} className="group block overflow-hidden rounded-lg bg-black">
              {currentVideo.thumbnailUrl ? (
                <img
                  src={currentVideo.thumbnailUrl}
                  alt={currentVideo.title}
                  className="aspect-video w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-elevated text-lg font-black text-secondary">MV</div>
              )}
            </Link>
          ) : (
            <div className="relative overflow-hidden rounded-lg bg-black">
              <VideoPlaybackSurface video={currentVideo} />
              <Link
                to={`/videos/${currentVideo.id}`}
                aria-label={`Open ${currentVideo.title}`}
                className="absolute inset-0 z-10"
              />
            </div>
          )}
          <div className="absolute right-2 top-2 z-20 opacity-0 transition-opacity group-hover/current-video:opacity-100">
            <VideoMenu ref={currentVideoMenuRef} video={currentVideo} triggerClassName="rounded-full bg-black/60 p-1.5 backdrop-blur-sm" />
          </div>
        </div>

        <div className="mt-3">
          <Link to={`/videos/${currentVideo.id}`} className="line-clamp-2 text-xl font-black leading-6 text-primary hover:underline">
            {currentVideo.title}
          </Link>
          <Link to={`/artist/${currentVideo.artist.id}`} className="mt-1 block truncate text-sm font-semibold text-secondary hover:text-primary hover:underline">
            {currentVideo.artist.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary">
            <span>{formatNumber(currentVideo.viewCount)} views</span>
            {currentVideo.durationMs > 0 && (
              <>
                <span>-</span>
                <span>{formatMs(currentVideo.durationMs)}</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-4">
          <MusicVideoLinkedTrackCard trackId={currentVideo.trackId} compact />
        </div>

        {recommendations.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-3 text-base font-black text-primary">Recommended videos</h3>
            <div className="space-y-3">
              {recommendations.map((video) => (
                <VideoRecommendationButton
                  key={video.id}
                  video={video}
                  onOpen={openVideo}
                />
              ))}
            </div>
          </section>
        )}
      </div>
      <NowPlayingDragHandle onMouseDown={onDragStart} />
    </aside>
  )
}

function VideoRecommendationButton({ video, onOpen }: { video: MusicVideo; onOpen: (video: MusicVideo) => void }) {
  const menuRef = useRef<VideoMenuHandle>(null)

  return (
    <div className="group/rec relative" onContextMenu={(event) => openMenuAtPointer(event, menuRef)}>
      <button
        type="button"
        onClick={() => onOpen(video)}
        className="group grid w-full grid-cols-[minmax(112px,42%)_minmax(0,1fr)] gap-3 rounded-md p-1 text-left transition-colors hover:bg-elevated"
      >
        <span className="relative aspect-video overflow-hidden rounded bg-elevated">
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-black text-secondary">MV</span>
          )}
          {video.durationMs > 0 && (
            <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {formatMs(video.durationMs)}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-page">
              <PlayIcon className="h-4 w-4 translate-x-[1px]" />
            </span>
          </span>
        </span>
        <span className="min-w-0 py-0.5">
          <span className="line-clamp-2 text-sm font-bold leading-5 text-primary">{video.title}</span>
          <span className="mt-1 block truncate text-xs font-semibold text-secondary">{video.artist.name}</span>
          <span className="mt-1 block text-xs text-secondary">{formatNumber(video.viewCount)} views</span>
        </span>
      </button>
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover/rec:opacity-100">
        <VideoMenu ref={menuRef} video={video} triggerClassName="rounded-full bg-black/60 p-1.5 backdrop-blur-sm" />
      </div>
    </div>
  )
}
