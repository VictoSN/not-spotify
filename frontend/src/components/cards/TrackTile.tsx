import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useDragStore } from '@/stores/dragStore'
import { TRACK_DND_MIME, setTrackDragImage } from '@/utils/trackDnd'
import { openMenuAtPointer } from '@/utils/contextMenu'
import { TrackRowMenu, type TrackRowMenuHandle } from './TrackRowMenu'
import { CardPlayButton } from './CardPlayButton'
import { cn } from '@/utils/cn'

interface TrackTileProps {
  track: Track
  queue?: Track[]
  flush?: boolean
  /** Fill a responsive grid cell instead of using the standard carousel width. */
  fluid?: boolean
  /** Render the title bold. Defaults to normal weight (Spotify-style); pass true where bold is wanted. */
  boldTitle?: boolean
}

/** Spotify-style square tile: cover with a rising hover play button + title/artist.
 *  Right-click (or the hover "…") opens the track menu; the tile is draggable into
 *  the sidebar library/playlists. */
export function TrackTile({ track, queue, flush = false, fluid = false, boldTitle = false }: TrackTileProps) {
  const { currentTrack, isPlaying, pause, resume, currentContextType } = usePlayerStore()
  const playWithGate = usePlaybackGate()
  const navigate = useNavigate()
  const setDraggedTrack = useDragStore((s) => s.setDraggedTrack)
  const menuTriggerRef = useRef<TrackRowMenuHandle>(null)
  const isCurrent = currentTrack?.id === track.id
  const isTrackSurfaceActive = isCurrent && currentContextType == null

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.button !== 0) return
    if (isTrackSurfaceActive) {
      if (isPlaying) pause()
      else resume()
    } else {
      playWithGate(track, queue ?? [track])
    }
  }

  return (
    <div
      className={cn(
        'group relative min-w-0 transition-opacity',
        fluid ? 'w-full' : 'w-44 flex-shrink-0 sm:w-48',
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData(TRACK_DND_MIME, track.id)
        e.dataTransfer.setData('text/plain', `${track.title} · ${track.artist.name}`)
        setTrackDragImage(e, track)
        setDraggedTrack(track)
        e.currentTarget.style.opacity = '0.4'
      }}
      onDragEnd={(e) => {
        setDraggedTrack(null)
        e.currentTarget.style.opacity = ''
      }}
      onContextMenu={(e) => openMenuAtPointer(e, menuTriggerRef)}
    >
      <Link
        to={`/track/${track.id}`}
        draggable={false}
        className={`relative isolate block overflow-hidden rounded-lg ${flush ? 'p-3' : 'p-3'}`}
      >
        <span
          aria-hidden="true"
          data-testid="track-tile-hover-background"
          className="pointer-events-none absolute inset-0 z-0 scale-[0.97] rounded-lg bg-surface opacity-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none group-hover:scale-100 group-hover:opacity-100"
        />
        <div className="relative z-10 aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
          <img src={track.album.coverUrl} alt={track.title} draggable={false} className="w-full h-full object-cover" />
          <CardPlayButton
            onClick={handlePlay}
            isPlaying={isTrackSurfaceActive && isPlaying}
            isActive={isTrackSurfaceActive}
            ariaLabel={isTrackSurfaceActive && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          />
        </div>
        <p className={`relative z-10 text-sm ${boldTitle ? 'font-semibold' : 'font-normal'} truncate ${isTrackSurfaceActive ? 'text-accent' : 'text-primary'}`}>{track.title}</p>
        <p className="relative z-10 text-xs text-secondary mt-0.5 truncate">
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              navigate(`/artist/${track.artist.id}`)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                navigate(`/artist/${track.artist.id}`)
              }
            }}
            className="cursor-pointer hover:text-primary hover:underline"
          >
            {track.artist.name}
          </span>
        </p>
      </Link>

      {/* Right-click target + hover "…" affordance. Rendered as a sibling of the Link
          (not nested inside the anchor) so it stays valid HTML and never navigates. */}
      <div
        className="hidden"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <TrackRowMenu
          track={track}
          ref={menuTriggerRef}
          triggerClassName="rounded-full bg-black/60 p-1 backdrop-blur-sm shadow-md"
          triggerIconClassName="h-5 w-5 text-white"
        />
      </div>
    </div>
  )
}
