import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PlusIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { cn } from '@/utils/cn'

interface PlaylistAddableRowProps {
  track: Track
  onAdd: () => void | Promise<void>
  adding?: boolean
  disabled?: boolean
}

/** Search/recommendation row whose add action lives directly over the artwork. */
export function PlaylistAddableRow({
  track,
  onAdd,
  adding = false,
  disabled = false,
}: PlaylistAddableRowProps) {
  const clickLocked = useRef(false)

  useEffect(() => {
    if (!adding) clickLocked.current = false
  }, [adding])

  const unavailable = disabled || adding
  const handleAdd = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (unavailable || clickLocked.current) return
    clickLocked.current = true
    void Promise.resolve(onAdd()).catch(() => {
      clickLocked.current = false
    })
  }

  const label = adding
    ? `Adding ${track.title} to this playlist`
    : `Add ${track.title} to this playlist`
  const creatorPath = track.podcastId ? `/podcasts/${track.podcastId}` : `/artist/${track.artist.id}`
  const collectionPath = track.podcastId ? `/podcasts/${track.podcastId}` : `/album/${track.album.id}`

  return (
    <div
      className="group/add-row grid items-center gap-4 rounded-md px-3 py-2 transition-colors hover:bg-elevated/50 focus-within:bg-elevated/50"
      style={{ gridTemplateColumns: '40px minmax(0, 5fr) minmax(0, 3fr)' }}
      data-testid={`playlist-add-row-${track.id}`}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-elevated">
        <Link
          to={`/track/${track.id}`}
          aria-label={`Open ${track.title}`}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          className="block h-full w-full"
        >
          <img
            src={track.album.coverUrl}
            alt={track.album.title}
            draggable={false}
            className="h-full w-full object-cover"
          />
        </Link>
        <button
          type="button"
          onClick={handleAdd}
          disabled={unavailable}
          title={adding ? 'Adding to this playlist' : 'Add to this playlist'}
          aria-label={label}
          aria-live="polite"
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center rounded bg-black/60 text-white transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
            'opacity-100 md:opacity-0 md:group-hover/add-row:opacity-100 md:group-focus-within/add-row:opacity-100',
            !unavailable && 'hover:bg-black/70 active:scale-95',
            adding && 'cursor-wait opacity-100 md:opacity-100',
          )}
        >
          <PlusIcon className={cn('h-5 w-5 stroke-[2.5]', adding && 'animate-pulse')} />
        </button>
      </div>

      <div className="min-w-0">
        <Link
          to={`/track/${track.id}`}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          className="block truncate text-sm font-semibold text-primary hover:underline"
        >
          {track.title}
        </Link>
        <Link
          to={creatorPath}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          className="block truncate text-xs text-secondary hover:text-primary hover:underline"
        >
          {track.artist.name}
        </Link>
      </div>
      <Link
        to={collectionPath}
        draggable={false}
        onClick={(event) => event.stopPropagation()}
        className="hidden truncate text-xs text-secondary hover:text-primary hover:underline md:block"
      >
        {track.album.title}
      </Link>
    </div>
  )
}
