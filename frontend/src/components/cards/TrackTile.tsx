import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useHueStore } from '@/stores/hueStore'
import { getDominantColor } from '@/hooks/useDominantColor'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useDragStore } from '@/stores/dragStore'
import { TRACK_DND_MIME, setTrackDragImage } from '@/utils/trackDnd'
import { openMenuAtPointer } from '@/utils/contextMenu'
import { TrackRowMenu } from './TrackRowMenu'

interface TrackTileProps {
  track: Track
  queue?: Track[]
  flush?: boolean
}

/** Spotify-style square tile: cover with a rising hover play button + title/artist.
 *  Right-click (or the hover "…") opens the track menu; the tile is draggable into
 *  the sidebar library/playlists. */
export function TrackTile({ track, queue, flush = false }: TrackTileProps) {
  const { currentTrack, isPlaying, pause, resume } = usePlayerStore()
  const playWithGate = usePlaybackGate()
  const navigate = useNavigate()
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  const setDraggedTrack = useDragStore((s) => s.setDraggedTrack)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const isCurrent = currentTrack?.id === track.id

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isCurrent) {
      if (isPlaying) pause()
      else resume()
    } else {
      playWithGate(track, queue ?? [track])
    }
  }

  return (
    <div
      className="group relative flex-shrink-0 w-44 sm:w-48 transition-opacity"
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
      onMouseEnter={() => getDominantColor(track.album.coverUrl).then((c) => c && setHoverColor(c))}
      onMouseLeave={() => setHoverColor(null)}
    >
      <Link
        to={`/album/${track.album.id}`}
        draggable={false}
        className={`block rounded-lg transition-colors ${flush ? 'p-0 hover:bg-transparent' : 'p-3 hover:bg-surface'}`}
      >
        <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
          <img src={track.album.coverUrl} alt={track.title} draggable={false} className="w-full h-full object-cover" />
          <button
            onClick={handlePlay}
            className="absolute bottom-2 right-2 w-10 h-10 bg-accent rounded-full flex items-center justify-center opacity-100 translate-y-0 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-200 shadow-lg hover:scale-105"
            aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          >
            {isCurrent && isPlaying ? (
              <PauseIcon className="w-5 h-5 text-white" />
            ) : (
              <PlayIcon className="w-5 h-5 text-white ml-0.5" />
            )}
          </button>
        </div>
        <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-accent' : 'text-primary'}`}>{track.title}</p>
        <p className="text-xs text-secondary mt-0.5 truncate">
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
        className="absolute right-3 top-3 z-10"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <TrackRowMenu
          track={track}
          triggerRef={menuTriggerRef}
          triggerClassName="rounded-full bg-black/60 p-1 backdrop-blur-sm shadow-md"
          triggerIconClassName="h-5 w-5 text-white"
        />
      </div>
    </div>
  )
}
