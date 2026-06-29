import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon, MusicalNoteIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { cn } from '@/utils/cn'

// Tracks shared in chat are fetched by id on render; cache so a thread with the
// same track shared twice (or re-rendered) doesn't refetch.
const trackCache = new Map<string, Promise<Track>>()
function getCachedTrack(id: string): Promise<Track> {
  let p = trackCache.get(id)
  if (!p) {
    p = trackService.getById(id).catch((err) => {
      trackCache.delete(id) // allow a retry on the next render
      throw err
    })
    trackCache.set(id, p)
  }
  return p
}

interface Props {
  trackId: string
  mine: boolean
  time: string
  ticks?: ReactNode
}

/** A rich "shared a song" card rendered in place of a plain chat bubble. */
export function SharedTrackBubble({ trackId, mine, time, ticks }: Props) {
  // Keyed by trackId and only written from async callbacks (never synchronously
  // in the effect) — while the id hasn't resolved, the derived state below shows
  // the loading placeholder.
  const [result, setResult] = useState<{ id: string; track: Track | null; failed: boolean }>({
    id: '',
    track: null,
    failed: false,
  })
  const playWithGate = usePlaybackGate()

  useEffect(() => {
    let cancelled = false
    getCachedTrack(trackId)
      .then((t) => { if (!cancelled) setResult({ id: trackId, track: t, failed: false }) })
      .catch(() => { if (!cancelled) setResult({ id: trackId, track: null, failed: true }) })
    return () => { cancelled = true }
  }, [trackId])

  const current = result.id === trackId ? result : { track: null, failed: false }
  const track = current.track
  const failed = current.failed

  const shell = cn(
    'w-64 max-w-full overflow-hidden rounded-2xl',
    mine ? 'chat-bubble-outgoing rounded-br-md' : 'chat-bubble-incoming rounded-bl-md',
  )

  if (failed) {
    return (
      <div className={cn(shell, 'px-3.5 py-2 text-sm')}>
        <span className="opacity-80">Shared a song — no longer available.</span>
      </div>
    )
  }

  return (
    <div className={shell}>
      <div className="flex items-center gap-2.5 p-2">
        <button
          type="button"
          onClick={() => track && playWithGate(track, [track])}
          disabled={!track}
          aria-label={track ? `Play ${track.title}` : 'Loading shared track'}
          className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/20"
        >
          {track ? (
            <img src={track.album.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <MusicalNoteIcon className="h-5 w-5 opacity-60" />
            </span>
          )}
          {track && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
              <PlayIcon className="h-6 w-6 text-white" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('text-[10px] font-bold uppercase tracking-wider', mine ? 'chat-meta-outgoing' : 'chat-meta-incoming')}>
            Shared a song
          </p>
          {track ? (
            <Link to={`/track/${track.id}`} className="block truncate text-sm font-semibold leading-tight hover:underline">
              {track.title}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold leading-tight">Loading…</p>
          )}
          <p className={cn('truncate text-xs leading-tight', mine ? 'chat-meta-outgoing' : 'chat-meta-incoming')}>
            {track?.artist.name ?? ' '}
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
