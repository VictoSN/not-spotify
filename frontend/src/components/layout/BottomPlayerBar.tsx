import { QueueListIcon } from '@heroicons/react/24/outline'
import { NowPlayingInfo } from '@/components/player/NowPlayingInfo'
import { PlayerControls } from '@/components/player/PlayerControls'
import { ProgressBar } from '@/components/player/ProgressBar'
import { VolumeControl } from '@/components/player/VolumeControl'
import { enterPip } from '@/components/player/PictureInPicturePlayer'
import { usePlayerStore } from '@/stores/playerStore'

// Inline SVG: rectangle with small inset rectangle — standard PiP icon
function PipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BottomPlayerBar() {
  const { toggleNowPlaying, isNowPlayingOpen, currentTrack } = usePlayerStore()

  return (
    <div className="shrink-0 h-20 sm:h-24 bg-base grid grid-cols-3 items-center gap-2 px-4">
      {/* Left: Now Playing Info */}
      <div className="min-w-0 justify-self-start">
        <NowPlayingInfo />
      </div>

      {/* Center: Controls + Progress — equal side columns keep this perfectly centered */}
      <div className="flex flex-col items-center gap-2 w-full max-w-[620px] justify-self-center">
        <PlayerControls />
        <ProgressBar />
      </div>

      {/* Right: Volume + PiP + Now Playing panel toggle */}
      <div className="flex items-center gap-3 justify-self-end">
        <VolumeControl />
        {currentTrack && (
          <button
            onClick={enterPip}
            className="hidden sm:block transition-all hover:scale-110 active:scale-90 text-secondary hover:text-primary"
            aria-label="Picture in picture"
            title="Picture in picture"
          >
            <PipIcon className="w-5 h-5" />
          </button>
        )}
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
