import { QueueListIcon } from '@heroicons/react/24/outline'
import { NowPlayingInfo } from '@/components/player/NowPlayingInfo'
import { PlayerControls } from '@/components/player/PlayerControls'
import { ProgressBar } from '@/components/player/ProgressBar'
import { ShuffleRepeatControls } from '@/components/player/ShuffleRepeatControls'
import { VolumeControl } from '@/components/player/VolumeControl'
import { QueueDrawer } from '@/components/player/QueueDrawer'
import { usePlayerStore } from '@/stores/playerStore'

export function BottomPlayerBar() {
  const { toggleQueue, isQueueOpen } = usePlayerStore()

  return (
    <>
      <QueueDrawer />
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-sidebar border-t border-elevated/30 flex items-center justify-between px-4 z-30">
        {/* Left: Now Playing Info */}
        <NowPlayingInfo />

        {/* Center: Controls + Progress */}
        <div className="flex flex-col items-center gap-2 flex-1 max-w-xl px-4">
          <div className="flex items-center gap-4">
            <ShuffleRepeatControls />
            <PlayerControls />
          </div>
          <ProgressBar />
        </div>

        {/* Right: Volume + Queue */}
        <div className="flex items-center gap-3 w-56 justify-end">
          <VolumeControl />
          <button
            onClick={toggleQueue}
            className={`transition-colors ${isQueueOpen ? 'text-accent' : 'text-secondary hover:text-primary'}`}
            aria-label="Toggle queue"
          >
            <QueueListIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  )
}
