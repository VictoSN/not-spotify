import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MusicalNoteIcon } from '@heroicons/react/24/solid'
import type { Album } from '@/types/album'
import { albumService } from '@/services/albumService'
import { cn } from '@/utils/cn'

const albumCache = new Map<string, Promise<Album>>()
function getCachedAlbum(id: string): Promise<Album> {
  let p = albumCache.get(id)
  if (!p) {
    p = albumService.getById(id).catch((err) => {
      albumCache.delete(id)
      throw err
    })
    albumCache.set(id, p)
  }
  return p
}

interface Props {
  albumId: string
  mine: boolean
  time: string
  ticks?: ReactNode
}

/** A rich "shared an album" card rendered in place of a plain chat bubble. */
export function SharedAlbumBubble({ albumId, mine, time, ticks }: Props) {
  const [result, setResult] = useState<{ id: string; album: Album | null; failed: boolean }>({
    id: '',
    album: null,
    failed: false,
  })

  useEffect(() => {
    let cancelled = false
    getCachedAlbum(albumId)
      .then((a) => { if (!cancelled) setResult({ id: albumId, album: a, failed: false }) })
      .catch(() => { if (!cancelled) setResult({ id: albumId, album: null, failed: true }) })
    return () => { cancelled = true }
  }, [albumId])

  const current = result.id === albumId ? result : { album: null, failed: false }
  const album = current.album
  const failed = current.failed

  const shell = cn(
    'w-64 max-w-full overflow-hidden rounded-2xl',
    mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-elevated text-primary',
  )

  if (failed) {
    return (
      <div className={cn(shell, 'px-3.5 py-2 text-sm')}>
        <span className="opacity-80">Shared an album — no longer available.</span>
      </div>
    )
  }

  const kindLabel = album?.type === 'single' ? 'Shared a single'
    : album?.type === 'ep' ? 'Shared an EP'
    : 'Shared an album'

  return (
    <div className={shell}>
      <div className="flex items-center gap-2.5 p-2">
        <Link
          to={album ? `/album/${album.id}` : '#'}
          aria-label={album ? `Open ${album.title}` : 'Loading shared album'}
          className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/20"
        >
          {album ? (
            <img src={album.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <MusicalNoteIcon className="h-5 w-5 opacity-60" />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <p className={cn('text-[10px] font-bold uppercase tracking-wider', mine ? 'text-white/70' : 'text-secondary')}>
            {kindLabel}
          </p>
          {album ? (
            <Link to={`/album/${album.id}`} className="block truncate text-sm font-semibold leading-tight hover:underline">
              {album.title}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold leading-tight">Loading…</p>
          )}
          <p className={cn('truncate text-xs leading-tight', mine ? 'text-white/70' : 'text-secondary')}>
            {album?.artist.name ?? ' '}
          </p>
        </div>
      </div>

      <div className={cn('flex items-center justify-end gap-1 px-2.5 pb-1.5 text-[10px]', mine ? 'text-white/70' : 'text-secondary')}>
        {time}
        {ticks}
      </div>
    </div>
  )
}
