import { forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowTopRightOnSquareIcon,
  MicrophoneIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, PlusCircleIcon } from '@heroicons/react/24/solid'
import type { PodcastSummary } from '@/types/podcast'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'
import type { PointerMenuHandle } from '@/utils/contextMenu'
import { MediaMenuShell, MediaMenuDivider, MediaMenuItem } from './MediaMenuShell'

interface PodcastMenuProps {
  podcast: PodcastSummary
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
}

export type PodcastMenuHandle = PointerMenuHandle

export const PodcastMenu = forwardRef<PodcastMenuHandle, PodcastMenuProps>(function PodcastMenu({
  podcast,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
}, ref) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const savedPodcastIds = useLibraryStore((s) => s.savedPodcastIds)
  const savePodcast = useLibraryStore((s) => s.savePodcast)
  const unsavePodcast = useLibraryStore((s) => s.unsavePodcast)
  const isSaved = savedPodcastIds.has(podcast.id)

  const handleToggleSave = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Save podcasts with a free account', imageUrl: podcast.imageUrl })
      return
    }
    if (isSaved) {
      unsavePodcast(podcast.id)
      notify.success('Removed from Your Library')
    } else {
      savePodcast(podcast)
      notify.success('Saved to Your Library')
    }
  }

  const handleShare = async () => {
    const result = await shareLink(`/podcasts/${podcast.id}`, {
      title: podcast.title,
      text: `${podcast.title} - ${podcast.author}`,
    })
    if (result === 'copied') notify.success('Link copied to clipboard')
    else if (result === 'failed') notify.error("Couldn't copy link")
  }

  return (
    <MediaMenuShell
      ref={ref}
      ariaLabel={`More options for ${podcast.title}`}
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
            icon={<ShareIcon className="w-4 h-4" />}
            label="Share"
            onClick={() => { void handleShare(); close() }}
          />

          <MediaMenuDivider />

          <MediaMenuItem
            icon={<MicrophoneIcon className="w-4 h-4" />}
            label="Open podcast"
            trailing={<ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />}
            onClick={() => { navigate(`/podcasts/${podcast.id}`); close() }}
          />
        </>
      )}
    </MediaMenuShell>
  )
})
