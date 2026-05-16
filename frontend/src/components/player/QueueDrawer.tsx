import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePlayerStore } from '@/stores/playerStore'
import { TrackCard } from '@/components/cards/TrackCard'

export function QueueDrawer() {
  const { isQueueOpen, queue, currentTrack, toggleQueue } = usePlayerStore()

  if (!isQueueOpen) return null

  return (
    <div className="fixed right-0 top-0 bottom-24 w-72 bg-sidebar border-l border-elevated/30 z-40 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-elevated/30">
        <h3 className="font-semibold text-primary">Queue</h3>
        <button onClick={toggleQueue} className="text-secondary hover:text-primary" aria-label="Close queue">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {currentTrack && (
          <div className="mb-4">
            <p className="text-xs text-secondary uppercase tracking-wider font-semibold px-2 mb-2">Now playing</p>
            <TrackCard track={currentTrack} queue={queue} />
          </div>
        )}

        {queue.length > 0 && (
          <div>
            <p className="text-xs text-secondary uppercase tracking-wider font-semibold px-2 mb-2">Next up</p>
            {queue.map((track) => (
              <TrackCard key={track.id} track={track} queue={queue} />
            ))}
          </div>
        )}

        {!currentTrack && queue.length === 0 && (
          <p className="text-secondary text-sm text-center py-8">Queue is empty</p>
        )}
      </div>
    </div>
  )
}
