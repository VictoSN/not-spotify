import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { cn } from '@/utils/cn'
import { TrackRowMenu, type TrackRowMenuHandle } from '@/components/cards/TrackRowMenu'
import { openMenuAtPointer } from '@/utils/contextMenu'

interface MusicVideoLinkedTrackCardProps {
  trackId?: string | null
  compact?: boolean
}

export function MusicVideoLinkedTrackCard({ trackId, compact = false }: MusicVideoLinkedTrackCardProps) {
  const [track, setTrack] = useState<Track | null>(null)
  const menuRef = useRef<TrackRowMenuHandle>(null)

  useEffect(() => {
    let cancelled = false
    setTrack(null)
    if (!trackId) return () => {
      cancelled = true
    }
    trackService
      .getById(trackId)
      .then((item) => {
        if (!cancelled) setTrack(item)
      })
      .catch(() => {
        if (!cancelled) setTrack(null)
      })
    return () => {
      cancelled = true
    }
  }, [trackId])

  if (!trackId) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg bg-elevated',
          compact ? 'p-3' : 'p-4',
        )}
      >
        <span className={cn('flex shrink-0 items-center justify-center rounded-md bg-black/40 text-secondary', compact ? 'h-12 w-12' : 'h-14 w-14')}>
          <MusicalNoteIcon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">Song in this MV</p>
          <p className={cn('truncate font-bold text-secondary', compact ? 'text-sm' : 'text-base')}>
            No linked audio track
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="group/linked-track relative" onContextMenu={track ? (event) => openMenuAtPointer(event, menuRef) : undefined}>
      <Link
        to={`/track/${trackId}`}
        className={cn(
          'flex items-center gap-3 rounded-lg bg-elevated transition-colors hover:bg-elevated/70',
          compact ? 'p-3' : 'p-4',
        )}
      >
        {track?.album.coverUrl ? (
          <img
            src={track.album.coverUrl}
            alt={track.album.title}
            className={cn('shrink-0 rounded-md object-cover shadow-lg', compact ? 'h-12 w-12' : 'h-14 w-14')}
          />
        ) : (
          <span className={cn('flex shrink-0 items-center justify-center rounded-md bg-black/40 text-accent', compact ? 'h-12 w-12' : 'h-14 w-14')}>
            <MusicalNoteIcon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">Song in this MV</p>
          <p className={cn('truncate font-bold text-primary', compact ? 'text-sm' : 'text-base')}>
            {track?.title ?? 'Listen to the track'}
          </p>
          {track && (
            <p className="truncate text-xs font-semibold text-secondary">{track.artist.name}</p>
          )}
        </div>
      </Link>
      {track && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/linked-track:opacity-100">
          <TrackRowMenu ref={menuRef} track={track} triggerClassName="rounded-full bg-black/40 p-1.5" />
        </div>
      )}
    </div>
  )
}
