import { forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowTopRightOnSquareIcon,
  FilmIcon,
  MusicalNoteIcon,
  PlayIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, PlusCircleIcon } from '@heroicons/react/24/solid'
import type { MusicVideo } from '@/types/musicVideo'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'
import { ShareIcon } from '@/components/common/ShareIcon'
import type { PointerMenuHandle } from '@/utils/contextMenu'
import { MediaMenuShell, MediaMenuDivider, MediaMenuItem } from './MediaMenuShell'

interface VideoMenuProps {
  video: MusicVideo
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
}

export type VideoMenuHandle = PointerMenuHandle

export const VideoMenu = forwardRef<VideoMenuHandle, VideoMenuProps>(function VideoMenu({
  video,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
}, ref) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const savedVideoIds = useLibraryStore((s) => s.savedVideoIds)
  const saveVideo = useLibraryStore((s) => s.saveVideo)
  const unsaveVideo = useLibraryStore((s) => s.unsaveVideo)
  const isSaved = savedVideoIds.has(video.id)

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

  const handleShare = async () => {
    const result = await shareLink(`/videos/${video.id}`, {
      title: video.title,
      text: `${video.title} - ${video.artist.name}`,
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
            <MediaMenuItem
              icon={<MusicalNoteIcon className="w-4 h-4" />}
              label="Listen to the track"
              onClick={() => { navigate(`/track/${video.trackId}`); close() }}
            />
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
