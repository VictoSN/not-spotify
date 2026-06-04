import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
} from '@heroicons/react/24/solid'
import { usePlayerStore } from '@/stores/playerStore'

export function PlayerControls() {
  const { isPlaying, currentTrack, togglePlayPause, skipNext, skipPrevious } = usePlayerStore()

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={skipPrevious}
        disabled={!currentTrack}
        className="text-secondary hover:text-primary transition-colors disabled:opacity-30"
        aria-label="Previous"
      >
        <BackwardIcon className="w-5 h-5" />
      </button>

      <button
        onClick={togglePlayPause}
        disabled={!currentTrack}
        className="w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-30"
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
        className="text-secondary hover:text-primary transition-colors disabled:opacity-30"
        aria-label="Next"
      >
        <ForwardIcon className="w-5 h-5" />
      </button>
    </div>
  )
}
