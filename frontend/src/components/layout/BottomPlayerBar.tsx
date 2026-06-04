import { QueueListIcon } from '@heroicons/react/24/outline'
import { NowPlayingInfo } from '@/components/player/NowPlayingInfo'
import { PlayerControls } from '@/components/player/PlayerControls'
import { ProgressBar } from '@/components/player/ProgressBar'
import { ShuffleRepeatControls } from '@/components/player/ShuffleRepeatControls'
import { VolumeControl } from '@/components/player/VolumeControl'
import { usePlayerStore } from '@/stores/playerStore'

export function BottomPlayerBar() {
  const { toggleNowPlaying, isNowPlayingOpen } = usePlayerStore()

  return (
    <div className="shrink-0 h-20 sm:h-24 bg-base flex items-center justify-between gap-2 px-4">
      {/* Left: Now Playing Info */}
      <NowPlayingInfo />

      {/* Center: Controls + Progress */}
      <div className="flex flex-col items-center gap-2 flex-1 max-w-2xl px-4">
        <div className="flex items-center gap-4">
          <ShuffleRepeatControls />
          <PlayerControls />
        </div>
        <ProgressBar />
      </div>

      {/* Right: Volume + Now Playing panel toggle */}
      <div className="flex items-center gap-3 w-56 justify-end">
        <VolumeControl />
        <button
          onClick={toggleNowPlaying}
          className={`hidden lg:block transition-colors ${isNowPlayingOpen ? 'text-accent' : 'text-secondary hover:text-primary'}`}
          aria-label="Toggle now playing panel"
          aria-pressed={isNowPlayingOpen}
        >
          <QueueListIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
