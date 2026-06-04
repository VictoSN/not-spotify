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
    <div className="shrink-0 h-20 sm:h-24 bg-base grid grid-cols-3 items-center gap-2 px-4">
      {/* Left: Now Playing Info */}
      <div className="min-w-0 justify-self-start">
        <NowPlayingInfo />
      </div>

      {/* Center: Controls + Progress — equal side columns keep this perfectly centered */}
      <div className="flex flex-col items-center gap-2 w-full max-w-[620px] justify-self-center">
        <div className="flex items-center gap-5">
          <ShuffleRepeatControls />
          <PlayerControls />
        </div>
        <ProgressBar />
      </div>

      {/* Right: Volume + Now Playing panel toggle */}
      <div className="flex items-center gap-3 justify-self-end">
        <VolumeControl />
        <button
          onClick={toggleNowPlaying}
          className={`hidden lg:block transition-all hover:scale-110 active:scale-90 ${isNowPlayingOpen ? 'text-accent' : 'text-secondary hover:text-primary'}`}
          aria-label="Toggle now playing panel"
          aria-pressed={isNowPlayingOpen}
        >
          <QueueListIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
