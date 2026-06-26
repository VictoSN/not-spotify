import { forwardRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  FilmIcon,
  ForwardIcon,
  MusicalNoteIcon,
  PlayIcon,
  QueueListIcon,
  ShareIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, PlusCircleIcon } from '@heroicons/react/24/solid'
import type { MusicVideo } from '@/types/musicVideo'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { trackService } from '@/services/trackService'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'
import type { PointerMenuHandle } from '@/utils/contextMenu'
import { MediaMenuShell, MediaMenuItem, MediaMenuDivider } from './MediaMenuShell'

interface VideoMenuProps {
  video: MusicVideo
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
}

export type VideoMenuHandle = PointerMenuHandle

/**
 * Music-video menu — a thin set of rows on top of the shared {@link MediaMenuShell}
 * so it looks and behaves exactly like the song/album/artist menus. Play-next /
 * add-to-queue / download reuse the standard track plumbing when the video has an
 * associated audio track.
 */
export const VideoMenu = forwardRef<VideoMenuHandle, VideoMenuProps>(function VideoMenu({
  video,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
}, ref) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const isPremium = useAuthStore((s) => s.user?.plan === 'premium')
  const savedVideoIds = useLibraryStore((s) => s.savedVideoIds)
  const saveVideo = useLibraryStore((s) => s.saveVideo)
  const unsaveVideo = useLibraryStore((s) => s.unsaveVideo)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const playNext = usePlayerStore((s) => s.playNext)
  const isSaved = savedVideoIds.has(video.id)
  const [downloading, setDownloading] = useState(false)

  const handleToggleSave = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Save videos with a free account', imageUrl: video.thumbnailUrl })
      return
    }
    if (isSaved) {
      unsaveVideo(video.id)
      notify.success('Removed from Your Library')
    } else {
      saveVideo(video)
      notify.success('Saved to Your Library')
    }
  }

  // Play-next / queue / download act on the audio track behind the video (if any).
  const enqueueTrack = async (mode: 'next' | 'queue') => {
    if (!video.trackId) return
    try {
      const track = await trackService.getById(video.trackId)
      if (mode === 'next') {
        playNext(track)
        notify.success('Will play next')
      } else {
        addToQueue(track)
        notify.success('Added to queue')
      }
    } catch {
      notify.error("Couldn't update the queue")
    }
  }

  const handleDownload = async () => {
    if (!video.trackId || downloading) return
    setDownloading(true)
    try {
      await trackService.download(video.trackId, video.title)
      notify.success('Download started')
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Could not download this track.')
    } finally {
      setDownloading(false)
    }
  }

  const handleShare = async () => {
    const result = await shareLink(`/videos/${video.id}`, {
      title: video.title,
      text: `${video.title} · ${video.artist.name}`,
    })
    if (result === 'copied') notify.success('Link copied to clipboard')
    else if (result === 'failed') notify.error("Couldn't copy link")
  }

  return (
    <MediaMenuShell
      ref={ref}
      ariaLabel={`More options for ${video.title}`}
      alwaysVisible={alwaysVisible}
      triggerClassName={triggerClassName}
      triggerIconClassName={triggerIconClassName}
    >
      {(close) => (
        <>
          <MediaMenuItem
            icon={isSaved ? <CheckCircleIcon className="w-4 h-4 text-accent" /> : <PlusCircleIcon className="w-4 h-4" />}
            label={isSaved ? 'Remove from Your Library' : 'Save to Your Library'}
            onClick={() => { handleToggleSave(); close() }}
          />

          <MediaMenuItem
            icon={<PlayIcon className="w-4 h-4" />}
            label="Play video"
            onClick={() => { navigate(`/videos/${video.id}`); close() }}
          />

          {video.trackId && (
            <>
              <MediaMenuItem
                icon={<ForwardIcon className="w-4 h-4" />}
                label="Play next"
                onClick={() => { void enqueueTrack('next'); close() }}
              />
              <MediaMenuItem
                icon={<QueueListIcon className="w-4 h-4" />}
                label="Add to queue"
                onClick={() => { void enqueueTrack('queue'); close() }}
              />
              <MediaMenuItem
                icon={<MusicalNoteIcon className="w-4 h-4" />}
                label="Listen to the track"
                onClick={() => { navigate(`/track/${video.trackId}`); close() }}
              />
              {isPremium && (
                <MediaMenuItem
                  icon={<ArrowDownTrayIcon className="w-4 h-4" />}
                  label={downloading ? 'Downloading…' : 'Download'}
                  disabled={downloading}
                  onClick={() => { void handleDownload(); close() }}
                />
              )}
            </>
          )}

          <MediaMenuItem
            icon={<UserIcon className="w-4 h-4" />}
            label="Go to artist"
            onClick={() => { navigate(`/artist/${video.artist.id}`); close() }}
          />

          <MediaMenuItem
            icon={<ShareIcon className="w-4 h-4" />}
            label="Share"
            onClick={() => { void handleShare(); close() }}
          />

          <MediaMenuDivider />

          <MediaMenuItem
            icon={<FilmIcon className="w-4 h-4" />}
            label="Open video"
            trailing={<ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />}
            onClick={() => { navigate(`/videos/${video.id}`); close() }}
          />
        </>
      )}
    </MediaMenuShell>
  )
})
