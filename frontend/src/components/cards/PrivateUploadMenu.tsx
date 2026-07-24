import { forwardRef } from 'react'
import {
  ForwardIcon,
  PhotoIcon,
  PlayIcon,
  QueueListIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import type { UserUpload } from '@/types/upload'
import { uploadToTrack } from '@/types/upload'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { notify } from '@/utils/toast'
import type { PointerMenuHandle } from '@/utils/contextMenu'
import { MediaMenuDivider, MediaMenuItem, MediaMenuShell } from './MediaMenuShell'

interface PrivateUploadMenuProps {
  upload: UserUpload
  queue: Track[]
  onChangeCover: (upload: UserUpload) => void
  onDelete: (upload: UserUpload) => void
}

/**
 * Personal locker tracks deliberately use the same menu shell and transport as
 * catalogue tracks, but expose only actions that make sense for a private file.
 */
export const PrivateUploadMenu = forwardRef<PointerMenuHandle, PrivateUploadMenuProps>(function PrivateUploadMenu({
  upload,
  queue,
  onChangeCover,
  onDelete,
}, ref) {
  const play = usePlayerStore((s) => s.play)
  const playNext = usePlayerStore((s) => s.playNext)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const playerQueue = usePlayerStore((s) => s.queue)
  const track = uploadToTrack(upload)
  const isInQueue = playerQueue.some((item) => item.id === track.id)

  return (
    <MediaMenuShell ref={ref} ariaLabel={`More options for ${upload.title}`}>
      {(close) => (
        <>
          <MediaMenuItem
            icon={<PlayIcon />}
            label="Play"
            onClick={() => { play(track, queue.length > 0 ? queue : [track]); close() }}
          />
          {!isInQueue && (
            <>
              <MediaMenuItem
                icon={<ForwardIcon />}
                label="Play next"
                onClick={() => { playNext(track); notify.success('Will play next'); close() }}
              />
              <MediaMenuItem
                icon={<QueueListIcon />}
                label="Add to queue"
                onClick={() => { addToQueue(track); notify.success('Added to queue'); close() }}
              />
            </>
          )}
          <MediaMenuDivider />
          <MediaMenuItem
            icon={<PhotoIcon />}
            label={upload.coverUrl ? 'Change cover' : 'Add cover'}
            onClick={() => { onChangeCover(upload); close() }}
          />
          <MediaMenuItem
            icon={<TrashIcon className="text-red-400" />}
            label="Delete"
            onClick={() => { onDelete(upload); close() }}
          />
        </>
      )}
    </MediaMenuShell>
  )
})
