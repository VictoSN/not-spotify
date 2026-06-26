import { forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownCircleIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ForwardIcon,
  MicrophoneIcon,
  PlayIcon,
  QueueListIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import { ArrowPathIcon } from '@heroicons/react/24/solid'
import type { Episode } from '@/types/podcast'
import { episodeToTrack } from '@/types/podcast'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useOfflineTrack } from '@/hooks/useOfflineTrack'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'
import type { PointerMenuHandle } from '@/utils/contextMenu'
import { MediaMenuShell, MediaMenuItem, MediaMenuDivider } from './MediaMenuShell'

interface EpisodeMenuProps {
  episode: Episode
  /** Parent show — supplies cover/author when adapting the episode to a Track. */
  podcast?: { title: string; author: string; imageUrl: string | null }
  /** The full episode queue this row belongs to, so "Play" keeps the show in order. */
  queue?: Track[]
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
}

export type EpisodeMenuHandle = PointerMenuHandle

/**
 * Podcast-episode menu. Episodes already adapt to the {@link Track} shape via
 * {@link episodeToTrack}, so this is just a row list on the shared
 * {@link MediaMenuShell} — playback, queueing and offline download flow through the
 * exact same player/offline plumbing (and identical UI) as song rows.
 */
export const EpisodeMenu = forwardRef<EpisodeMenuHandle, EpisodeMenuProps>(function EpisodeMenu({
  episode,
  podcast,
  queue,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
}, ref) {
  const navigate = useNavigate()
  const play = usePlayerStore((s) => s.play)
  const playNext = usePlayerStore((s) => s.playNext)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const playerQueue = usePlayerStore((s) => s.queue)
  const track = episodeToTrack(episode, podcast)
  const offline = useOfflineTrack(track)
  const isInQueue = playerQueue.some((t) => t.id === track.id)

  const handleShare = async () => {
    const result = await shareLink(`/podcasts/${episode.podcastId}`, {
      title: episode.title,
      text: `${episode.title} · ${podcast?.title ?? episode.podcastTitle}`,
    })
    if (result === 'copied') notify.success('Link copied to clipboard')
    else if (result === 'failed') notify.error("Couldn't copy link")
  }

  return (
    <MediaMenuShell
      ref={ref}
      ariaLabel={`More options for ${episode.title}`}
      alwaysVisible={alwaysVisible}
      triggerClassName={triggerClassName}
      triggerIconClassName={triggerIconClassName ?? 'h-5 w-5 stroke-[2.2] text-secondary hover:text-primary'}
    >
      {(close) => (
        <>
          <MediaMenuItem
            icon={<PlayIcon className="w-4 h-4" />}
            label="Play"
            onClick={() => { play(track, queue && queue.length > 0 ? queue : [track]); close() }}
          />

          {!isInQueue && (
            <>
              <MediaMenuItem
                icon={<ForwardIcon className="w-4 h-4" />}
                label="Play next"
                onClick={() => { playNext(track); notify.success('Will play next'); close() }}
              />
              <MediaMenuItem
                icon={<QueueListIcon className="w-4 h-4" />}
                label="Add to queue"
                onClick={() => { addToQueue(track); notify.success('Added to queue'); close() }}
              />
            </>
          )}

          {offline.supported && (
            <MediaMenuItem
              disabled={offline.busy}
              icon={offline.busy
                ? <ArrowPathIcon className="w-4 h-4 animate-spin text-accent" />
                : offline.saved
                  ? <CheckCircleIcon className="w-4 h-4 text-accent" />
                  : <ArrowDownCircleIcon className="w-4 h-4" />}
              label={offline.busy
                ? (offline.saved ? 'Removing…' : 'Downloading…')
                : offline.saved
                  ? 'Remove download'
                  : 'Download'}
              onClick={() => { void offline.toggle(); close() }}
            />
          )}

          <MediaMenuDivider />

          <MediaMenuItem
            icon={<MicrophoneIcon className="w-4 h-4" />}
            label="Go to podcast"
            trailing={<ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />}
            onClick={() => { navigate(`/podcasts/${episode.podcastId}`); close() }}
          />

          <MediaMenuItem
            icon={<ShareIcon className="w-4 h-4" />}
            label="Share"
            onClick={() => { void handleShare(); close() }}
          />
        </>
      )}
    </MediaMenuShell>
  )
})
