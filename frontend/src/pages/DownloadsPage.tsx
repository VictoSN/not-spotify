import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownCircleIcon, TrashIcon } from '@heroicons/react/24/outline'
import { PlayIcon, PauseIcon, ClockIcon } from '@heroicons/react/24/solid'
import {
  OFFLINE_CHANGE_EVENT,
  listOffline,
  offlineEntryToTrack,
  offlineTotalBytes,
  clearOffline,
  type OfflineEntry,
} from '@/services/offlineAudio'
import { usePlayerStore } from '@/stores/playerStore'
import { TrackRow } from '@/components/cards/TrackRow'
import { DetailHero } from '@/components/common/DetailHero'
import { Button } from '@/components/ui/Button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useDominantColor } from '@/hooks/useDominantColor'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { formatMs } from '@/utils/formatTime'

const DOWNLOADS_CONTEXT = { type: 'downloads' as const, id: 'offline' }

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

export function DownloadsPage() {
  useDocumentTitle('Downloads')
  const [entries, setEntries] = useState<OfflineEntry[]>(() => listOffline())
  const [total, setTotal] = useState(() => offlineTotalBytes())
  const isMobile = useIsMobile()

  const refresh = useCallback(() => {
    setEntries(listOffline())
    setTotal(offlineTotalBytes())
  }, [])

  useEffect(() => {
    window.addEventListener(OFFLINE_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(OFFLINE_CHANGE_EVENT, refresh)
  }, [refresh])

  const tracks = useMemo(() => entries.map(offlineEntryToTrack), [entries])
  const totalDuration = tracks.reduce((sum, track) => sum + track.durationMs, 0)
  const coverUrl = tracks[0]?.album.coverUrl ?? ''
  const heroColor = useDominantColor(coverUrl, { resetOnChange: true })
  const playContext = usePlayerStore((s) => s.playContext)
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const { isActiveContext, isPlayingContext } = usePlaybackContext(DOWNLOADS_CONTEXT)

  const handlePlayAll = () => {
    if (tracks.length === 0) return
    if (isActiveContext) togglePlayPause()
    else playContext(DOWNLOADS_CONTEXT, tracks)
  }

  if (tracks.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-elevated text-secondary">
          <ArrowDownCircleIcon className="h-12 w-12" />
        </div>
        <h1 className="text-3xl font-black text-primary">Downloads</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-secondary">
          Nothing is saved for offline yet. Download a song, album, or playlist to keep it playable on this device.
        </p>
      </div>
    )
  }

  return (
    <div>
      <DetailHero
        heroColor={heroColor}
        coverUrl={coverUrl}
        coverAlt="Downloads"
        eyebrow="Playlist"
        title="Downloads"
        meta={
          <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
            <span>Available offline</span>
            <span>-</span>
            <span>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'}</span>
            {totalDuration > 0 && (
              <>
                <span>-</span>
                <span>{formatMs(totalDuration)}</span>
              </>
            )}
            <span>-</span>
            <span>{formatBytes(total)} on this device</span>
          </div>
        }
        actions={
          <>
            <Button onClick={handlePlayAll} size="lg" className="gap-2">
              {isPlayingContext ? (
                <><PauseIcon className="h-5 w-5" /> Pause</>
              ) : (
                <><PlayIcon className="h-5 w-5" /> Play</>
              )}
            </Button>
            <button
              type="button"
              onClick={() => void clearOffline()}
              title="Clear downloads"
              aria-label="Clear downloads"
              className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
            >
              <TrashIcon className="h-6 w-6 stroke-[2.4]" />
              <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">Clear downloads</span>
            </button>
          </>
        }
      />

      <div className="px-4">
        <div
          className="mb-2 grid items-center gap-4 border-b border-elevated/30 px-4 py-2"
          style={{ gridTemplateColumns: isMobile ? '16px 1fr var(--track-actions-width)' : '16px 6fr 3fr var(--track-actions-width)' }}
        >
          <span className="text-xs text-secondary">#</span>
          <span className="text-xs uppercase tracking-wider text-secondary">Title</span>
          <span className="hidden text-xs uppercase tracking-wider text-secondary md:block">Album</span>
          <div className="ml-auto grid w-[114px] grid-cols-[32px_50px_32px] items-center justify-end gap-1.5 sm:w-[194px] sm:grid-cols-[80px_32px_50px_32px] sm:gap-2">
            <span className="hidden sm:block" />
            <span />
            <span className="flex justify-end pr-1">
              <ClockIcon className="h-4 w-4 text-secondary" />
            </span>
            <span />
          </div>
        </div>

        {tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            index={index}
            queue={tracks}
            showAlbum
            context={DOWNLOADS_CONTEXT}
          />
        ))}
      </div>
    </div>
  )
}
