import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
} from '@heroicons/react/24/solid'
import { ArrowsRightLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { usePlayerStore } from '@/stores/playerStore'
import { cn } from '@/utils/cn'

export function PlayerControls() {
  const {
    isPlaying,
    currentTrack,
    shuffleEnabled,
    repeatMode,
    togglePlayPause,
    skipNext,
    skipPrevious,
    toggleShuffle,
    cycleRepeat,
  } = usePlayerStore()

  return (
    <div className="grid grid-cols-[20px_20px_36px_20px_20px] items-center justify-items-center gap-5">
      <button
        onClick={toggleShuffle}
        className={cn(
          'relative transition-all hover:scale-110 active:scale-90',
          shuffleEnabled ? 'text-accent' : 'text-secondary hover:text-primary',
        )}
        aria-label="Toggle shuffle"
        aria-pressed={shuffleEnabled}
      >
        <ArrowsRightLeftIcon className="w-4 h-4" />
        {shuffleEnabled && (
          <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
        )}
      </button>

      <button
        onClick={skipPrevious}
        disabled={!currentTrack}
        className="text-secondary hover:text-primary transition-all hover:scale-110 active:scale-90 disabled:opacity-30 disabled:hover:scale-100"
        aria-label="Previous"
      >
        <BackwardIcon className="w-5 h-5" />
      </button>

      <button
        onClick={togglePlayPause}
        disabled={!currentTrack}
        className="w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-30 disabled:hover:scale-100"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <PauseIcon className="w-5 h-5 text-page" />
        ) : (
          <PlayIcon className="w-5 h-5 text-page ml-0.5" />
        )}
      </button>

      <button
        onClick={skipNext}
        disabled={!currentTrack}
        className="text-secondary hover:text-primary transition-all hover:scale-110 active:scale-90 disabled:opacity-30 disabled:hover:scale-100"
        aria-label="Next"
      >
        <ForwardIcon className="w-5 h-5" />
      </button>

      <button
        onClick={cycleRepeat}
        className={cn(
          'relative transition-all hover:scale-110 active:scale-90',
          repeatMode !== 'off'
            ? 'text-accent'
            : 'text-secondary hover:text-primary',
        )}
        aria-label={`Repeat: ${repeatMode}`}
      >
        <ArrowPathIcon className="w-4 h-4" />
        {repeatMode === 'one' && (
          <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold leading-none text-accent">
            1
          </span>
        )}
        {repeatMode !== 'off' && (
          <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
        )}
      </button>
    </div>
  )
}
