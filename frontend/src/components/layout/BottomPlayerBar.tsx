import { useState } from 'react'
import { EllipsisHorizontalIcon, QueueListIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { MicVocal } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NowPlayingInfo } from '@/components/player/NowPlayingInfo'
import { PlayerControls } from '@/components/player/PlayerControls'
import { ProgressBar } from '@/components/player/ProgressBar'
import { VolumeControl } from '@/components/player/VolumeControl'
import { EqualizerButton, PlaybackSpeedButton, SleepTimerButton } from '@/components/player/PlayerExtras'
import { enterPip } from '@/components/player/PictureInPicturePlayer'
import { usePlayerStore } from '@/stores/playerStore'
import { useJamStore } from '@/stores/jamStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useTranslation } from '@/i18n/useTranslation'

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
  const { t } = useTranslation()
  const {
    playbackMode,
    toggleNowPlaying,
    currentTrack,
    currentVideo,
    isPlaying,
    isVideoPlaying,
    pause,
    resume,
    pauseVideo,
    resumeVideo,
    isKaraokeOpen,
    toggleKaraoke,
  } = usePlayerStore()
  const jamRole = useJamStore((s) => s.role)
  const startHosting = useJamStore((s) => s.startHosting)
  const stopJam = useJamStore((s) => s.stopJam)
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()
  const queueOpen = location.pathname === '/queue'
  // Toggle the queue: open it, or step back out of it when it's already showing
  // so the same button can exit. Falls back to home if there's no history to pop.
  const toggleQueue = () => {
    if (queueOpen) {
      if (window.history.length > 1) navigate(-1)
      else navigate('/')
    } else {
      navigate('/queue')
    }
  }
  const [moreOpen, setMoreOpen] = useState(false)
  const isVideoMode = playbackMode === 'video'
  const hasMedia = isVideoMode ? !!currentVideo : !!currentTrack
  const activePlaying = isVideoMode ? isVideoPlaying : isPlaying
  const activeTitle = isVideoMode ? currentVideo?.title : currentTrack?.title
  const activeCreator = isVideoMode ? currentVideo?.artist.name : currentTrack?.artist.name
  const activeImage = isVideoMode ? currentVideo?.thumbnailUrl : currentTrack?.album.coverUrl
  const activeImageAlt = isVideoMode ? currentVideo?.title : currentTrack?.album.title

  // â”€â”€ Mobile mini-player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isMobile) {
    if (!hasMedia) return null
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
          aria-label={t('player.openNowPlaying')}
        >
          {activeImage ? (
            <img
              src={activeImage}
              alt={activeImageAlt ?? ''}
              className="w-10 h-10 rounded-md object-cover flex-shrink-0 shadow-lg"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-elevated text-[11px] font-black text-secondary shadow-lg">
              MV
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate leading-tight">{activeTitle}</p>
            <p className="text-xs text-secondary truncate leading-tight">{activeCreator}</p>
          </div>
          {/* Play/pause only â€” stop propagation so the row tap doesn't also toggle play */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (isVideoMode) {
                if (isVideoPlaying) pauseVideo()
                else resumeVideo()
              } else if (isPlaying) pause()
              else resume()
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-page hover:scale-105 active:scale-95 transition-all shrink-0"
            aria-label={activePlaying ? t('player.pause') : t('player.play')}
          >
            {activePlaying
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

      {/* Right: primary actions stay visible; secondary tools live in More. */}
      <div className="flex items-center gap-3 justify-self-end">
        {currentTrack && !isVideoMode && (
          <button
            onClick={toggleKaraoke}
            className={`transition-all hover:scale-110 active:scale-90 ${isKaraokeOpen ? 'text-accent' : 'text-secondary hover:text-primary'}`}
            aria-label={t('player.lyrics')}
            aria-pressed={isKaraokeOpen}
            title={t('player.lyrics')}
          >
            <MicVocal className="h-5 w-5" strokeWidth={1.8} />
          </button>
        )}
        {currentTrack && !isVideoMode && (
          <button
            type="button"
            onClick={toggleQueue}
            className={`hidden lg:block transition-all hover:scale-110 active:scale-90 ${queueOpen ? 'text-accent' : 'text-secondary hover:text-primary'}`}
            aria-label={t('player.queue')}
            aria-pressed={queueOpen}
            title={t('player.queue')}
          >
            <QueueListIcon className="h-5 w-5" />
          </button>
        )}
        <VolumeControl />
        {currentTrack && !isVideoMode && (
          <button
            onClick={enterPip}
            className="hidden text-secondary transition-all hover:scale-110 hover:text-primary active:scale-90 sm:block"
            aria-label={t('player.pip')}
            title={t('player.pip')}
          >
            <PipIcon className="h-5 w-5" />
          </button>
        )}
        {hasMedia && !isVideoMode && (
          <div className="relative">
            <button
              onClick={() => setMoreOpen((open) => !open)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all hover:scale-105 active:scale-95 ${
                moreOpen
                  ? 'border-primary bg-primary text-page'
                  : 'border-secondary/30 text-secondary hover:border-primary hover:text-primary'
              }`}
              aria-label="More player controls"
              aria-expanded={moreOpen}
              title="More"
            >
              <EllipsisHorizontalIcon className="h-5 w-5" />
            </button>
            {moreOpen && (
              <>
                <button
                  className="fixed inset-0 z-[990] cursor-default"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close more player controls"
                />
                <div className="absolute bottom-full right-0 z-[1000] mb-3 w-72 rounded-lg border border-secondary/10 bg-elevated p-2 shadow-2xl">
                  {!isVideoMode && <div className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 hover:bg-surface">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">Playback speed</p>
                      <p className="text-xs text-secondary">Change how fast the track plays</p>
                    </div>
                    <PlaybackSpeedButton />
                  </div>}
                  <div className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 hover:bg-surface">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">{t('player.sleep')}</p>
                      <p className="text-xs text-secondary">Stop playback automatically</p>
                    </div>
                    <SleepTimerButton />
                  </div>
                  {!isVideoMode && <div className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 hover:bg-surface">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">{t('player.equalizer')}</p>
                      <p className="text-xs text-secondary">Adjust the sound profile</p>
                    </div>
                    <EqualizerButton />
                  </div>}
                  {!isVideoMode && <div className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 hover:bg-surface">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">
                        {jamRole === 'host' ? t('player.jam.end') : 'Jam'}
                      </p>
                      <p className="text-xs text-secondary">
                        {jamRole === 'host' ? 'Stop the current listening session' : 'Listen together with friends'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (jamRole === 'host') stopJam()
                        else startHosting()
                        setMoreOpen(false)
                      }}
                      className={`transition-all hover:scale-110 active:scale-90 ${
                        jamRole === 'host' ? 'text-accent' : 'text-secondary hover:text-primary'
                      }`}
                      aria-label={jamRole === 'host' ? t('player.jam.end') : t('player.jam.start')}
                      title={jamRole === 'host' ? t('player.jam.end') : t('player.jam.start')}
                    >
                      <UserGroupIcon className="h-5 w-5" />
                    </button>
                  </div>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Thin accent-coloured progress strip for the mobile mini-player. */
function ProgressBarStrip() {
  const { playbackMode, currentTime, duration, videoCurrentTime, videoDuration } = usePlayerStore()
  const activeTime = playbackMode === 'video' ? videoCurrentTime : currentTime
  const activeDuration = playbackMode === 'video' ? videoDuration : duration
  const pct = activeDuration > 0 ? (activeTime / activeDuration) * 100 : 0
  return (
    <div
      className="h-full bg-primary transition-[width] duration-500"
      style={{ width: `${pct}%` }}
    />
  )
}
