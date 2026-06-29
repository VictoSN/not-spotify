import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { QueueListIcon } from '@heroicons/react/24/solid'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { PlaylistCover } from '@/components/cards/PlaylistCover'
import { cn } from '@/utils/cn'

const playlistCache = new Map<string, Promise<Playlist>>()
function getCachedPlaylist(id: string): Promise<Playlist> {
  let p = playlistCache.get(id)
  if (!p) {
    p = playlistService.getById(id).catch((err) => {
      playlistCache.delete(id)
      throw err
    })
    playlistCache.set(id, p)
  }
  return p
}

interface Props {
  playlistId: string
  mine: boolean
  time: string
  ticks?: ReactNode
}

/** A rich "shared a playlist" card rendered in place of a plain chat bubble. */
export function SharedPlaylistBubble({ playlistId, mine, time, ticks }: Props) {
  const [result, setResult] = useState<{ id: string; playlist: Playlist | null; failed: boolean }>({
    id: '',
    playlist: null,
    failed: false,
  })

  useEffect(() => {
    let cancelled = false
    getCachedPlaylist(playlistId)
      .then((p) => { if (!cancelled) setResult({ id: playlistId, playlist: p, failed: false }) })
      .catch(() => { if (!cancelled) setResult({ id: playlistId, playlist: null, failed: true }) })
    return () => { cancelled = true }
  }, [playlistId])

  const current = result.id === playlistId ? result : { playlist: null, failed: false }
  const playlist = current.playlist
  const failed = current.failed

  const shell = cn(
    'w-64 max-w-full overflow-hidden rounded-2xl',
    mine ? 'chat-bubble-outgoing rounded-br-md' : 'chat-bubble-incoming rounded-bl-md',
  )

  if (failed) {
    return (
      <div className={cn(shell, 'px-3.5 py-2 text-sm')}>
        <span className="opacity-80">Shared a playlist — no longer available.</span>
      </div>
    )
  }

  return (
    <div className={shell}>
      <div className="flex items-center gap-2.5 p-2">
        <Link
          to={playlist ? `/playlist/${playlist.id}` : '#'}
          aria-label={playlist ? `Open ${playlist.name}` : 'Loading shared playlist'}
          className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/20"
        >
          {playlist ? (
            <PlaylistCover coverUrl={playlist.coverUrl} tracks={playlist.tracks} name={playlist.name} />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <QueueListIcon className="h-5 w-5 opacity-60" />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <p className={cn('text-[10px] font-bold uppercase tracking-wider', mine ? 'chat-meta-outgoing' : 'chat-meta-incoming')}>
            Shared a playlist
          </p>
          {playlist ? (
            <Link to={`/playlist/${playlist.id}`} className="block truncate text-sm font-semibold leading-tight hover:underline">
              {playlist.name}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold leading-tight">Loading…</p>
          )}
          <p className={cn('truncate text-xs leading-tight', mine ? 'chat-meta-outgoing' : 'chat-meta-incoming')}>
            {playlist ? `${playlist.owner.name} · ${playlist.tracks.length} songs` : ' '}
          </p>
        </div>
      </div>

      <div className={cn('flex items-center justify-end gap-1 px-2.5 pb-1.5 text-[10px]', mine ? 'chat-meta-outgoing' : 'chat-meta-incoming')}>
        {time}
        {ticks}
      </div>
    </div>
  )
}
