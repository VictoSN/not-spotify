import { QueueListIcon, MicrophoneIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { Link, useLocation } from 'react-router-dom'
import { NowPlayingInfo } from '@/components/player/NowPlayingInfo'
import { PlayerControls } from '@/components/player/PlayerControls'
import { ProgressBar } from '@/components/player/ProgressBar'
import { VolumeControl } from '@/components/player/VolumeControl'
import { EqualizerButton, PlaybackSpeedButton, SleepTimerButton } from '@/components/player/PlayerExtras'
import { enterPip } from '@/components/player/PictureInPicturePlayer'
import { usePlayerStore } from '@/stores/playerStore'
import { useJamStore } from '@/stores/jamStore'
import { useIsMobile } from '@/hooks/useMediaQuery'

// Inline SVG: rectangle with small inset rectangle â€” standard PiP icon
function PipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BottomPlayerBar() {
  const { toggleNowPlaying, currentTrack, isPlaying, pause, resume, isKaraokeOpen, toggleKaraoke } = usePlayerStore()
  const jamRole = useJamStore((s) => s.role)
  const startHosting = useJamStore((s) => s.startHosting)
  const stopJam = useJamStore((s) => s.stopJam)
  const isMobile = useIsMobile()
  const location = useLocation()
  const queueOpen = location.pathname === '/queue'

  // â”€â”€ Mobile mini-player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isMobile) {
    if (!currentTrack) return null
    return (
      <div className="shrink-0 bg-base border-t border-elevated/20">
        {/* Thin progress bar strip at the top */}
        <div className="h-0.5 bg-elevated/40">
          <ProgressBarStrip />
        </div>
        {/* Mini-player row */}
        <div
          className="flex items-center gap-3 px-3 h-16 cursor-pointer"
          onClick={toggleNowPlaying}
          role="button"
          aria-label="Open now playing"
        >
          <img
            src={currentTrack.album.coverUrl}
            alt={currentTrack.album.title}
            className="w-10 h-10 rounded-md object-cover flex-shrink-0 shadow-lg"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate leading-tight">{currentTrack.title}</p>
            <p className="text-xs text-secondary truncate leading-tight">{currentTrack.artist.name}</p>
          </div>
          {/* Play/pause only â€” stop propagation so the row tap doesn't also toggle play */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (isPlaying) pause()
              else resume()
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-page hover:scale-105 active:scale-95 transition-all shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying
              ? <PauseIcon className="w-5 h-5" />
              : <PlayIcon className="w-5 h-5 translate-x-0.5" />
            }
          </button>
        </div>
      </div>
    )
  }

  // â”€â”€ Desktop full player bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="shrink-0 h-20 sm:h-24 bg-base grid grid-cols-3 items-center gap-2 px-4">
      {/* Left: Now Playing Info */}
      <div className="min-w-0 justify-self-start">
        <NowPlayingInfo />
      </div>

      {/* Center: Controls + Progress */}
      <div className="flex flex-col items-center gap-2 w-full max-w-[620px] justify-self-center">
        <PlayerControls />
        <ProgressBar />
      </div>

      {/* Right: Speed + Sleep + Karaoke + Volume + PiP + Now Playing panel toggle */}
      <div className="flex items-center gap-3 justify-self-end">
        <PlaybackSpeedButton />
        <SleepTimerButton />
        <EqualizerButton />
        {currentTrack && (
          <button
            onClick={toggleKaraoke}
            className={`transition-all hover:scale-110 active:scale-90 ${isKaraokeOpen ? 'text-accent' : 'text-secondary hover:text-primary'}`}
            aria-label="Lyrics"
            aria-pressed={isKaraokeOpen}
            title="Lyrics"
          >
            <MicrophoneIcon className="w-5 h-5" />
          </button>
        )}
        {/* Listen-along / Jam — host toggle */}
        <button
          onClick={() => (jamRole === 'host' ? stopJam() : startHosting())}
          className={`hidden sm:block transition-all hover:scale-110 active:scale-90 ${jamRole === 'host' ? 'text-accent' : 'text-secondary hover:text-primary'}`}
          aria-label={jamRole === 'host' ? 'End jam' : 'Start a jam (listen along)'}
          aria-pressed={jamRole === 'host'}
          title={jamRole === 'host' ? 'End jam' : 'Start a jam (listen along)'}
        >
          <UserGroupIcon className="w-5 h-5" />
        </button>
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
        <Link
          to="/queue"
          className={`hidden lg:block transition-all hover:scale-110 active:scale-90 ${queueOpen ? 'text-accent' : 'text-secondary hover:text-primary'}`}
          aria-label="Open queue"
          aria-current={queueOpen ? 'page' : undefined}
          title="Queue"
        >
          <QueueListIcon className="w-5 h-5" />
        </Link>
      </div>
    </div>
  )
}

/** Thin accent-coloured progress strip for the mobile mini-player. */
function ProgressBarStrip() {
  const { currentTime, duration } = usePlayerStore()
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0
  return (
    <div
      className="h-full bg-primary transition-[width] duration-500"
      style={{ width: `${pct}%` }}
    />
  )
}
