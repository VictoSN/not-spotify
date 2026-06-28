import { forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowTopRightOnSquareIcon,
  MusicalNoteIcon,
  PlayIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline'
import { PauseIcon } from '@heroicons/react/24/solid'
import type { DailyMix } from '@/services/trackService'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { usePlayerStore } from '@/stores/playerStore'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'
import type { PointerMenuHandle } from '@/utils/contextMenu'
import { ShareIcon } from '@/components/common/ShareIcon'
import { MediaMenuDivider, MediaMenuItem, MediaMenuShell } from './MediaMenuShell'
import { PinIcon, usePinned } from './PinMenuItem'

interface MixMenuProps {
  mix: DailyMix
  isPlaying: boolean
  onPlay: () => void
  triggerClassName?: string
  triggerIconClassName?: string
}

export type MixMenuHandle = PointerMenuHandle

export const MixMenu = forwardRef<MixMenuHandle, MixMenuProps>(function MixMenu({
  mix,
  isPlaying,
  onPlay,
  triggerClassName,
  triggerIconClassName,
}, ref) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((state) => state.open)
  const addToQueue = usePlayerStore((state) => state.addToQueue)
  const [pinned, togglePin] = usePinned(`mix-${mix.id}`)

  const handleAddToQueue = () => {
    if (!isAuthenticated) {
      openAuthPrompt({
        title: 'Add to queue with a free account',
        imageUrl: mix.tracks[0]?.album.coverUrl ?? null,
      })
      return
    }
    if (mix.tracks.length === 0) {
      notify.info('No tracks available in this mix yet')
      return
    }
    mix.tracks.forEach(addToQueue)
    notify.success(`Added ${mix.tracks.length} song${mix.tracks.length === 1 ? '' : 's'} to queue`)
  }

  const handleShare = async () => {
    const result = await shareLink(`/mix/${mix.id}`, {
      title: mix.title,
      text: mix.subtitle,
    })
    if (result === 'copied') notify.success('Link copied to clipboard')
    else if (result === 'failed') notify.error("Couldn't copy link")
  }

  return (
    <MediaMenuShell
      ref={ref}
      ariaLabel={`More options for ${mix.title}`}
      triggerClassName={triggerClassName}
      triggerIconClassName={triggerIconClassName}
    >
      {(close) => (
        <>
          <MediaMenuItem
            icon={isPlaying ? <PauseIcon /> : <PlayIcon />}
            label={isPlaying ? 'Pause mix' : 'Play mix'}
            onClick={() => { onPlay(); close() }}
          />
          <MediaMenuItem
            icon={<QueueListIcon />}
            label="Add to queue"
            onClick={() => { handleAddToQueue(); close() }}
          />
          <MediaMenuItem
            icon={<PinIcon className={pinned ? 'text-accent' : ''} />}
            label={pinned ? 'Unpin' : 'Pin to top'}
            onClick={() => { togglePin(); close() }}
          />
          <MediaMenuItem
            icon={<ShareIcon />}
            label="Share"
            onClick={() => { void handleShare(); close() }}
          />

          <MediaMenuDivider />

          <MediaMenuItem
            icon={<MusicalNoteIcon />}
            label="Open Daily Mix"
            trailing={<ArrowTopRightOnSquareIcon className="text-secondary" />}
            onClick={() => { navigate(`/mix/${mix.id}`); close() }}
          />
        </>
      )}
    </MediaMenuShell>
  )
})
