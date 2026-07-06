import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EllipsisHorizontalIcon,
  QueueListIcon,
  UserGroupIcon,
  AdjustmentsHorizontalIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'
import { PlayIcon, PauseIcon, MoonIcon as MoonSolid } from '@heroicons/react/24/solid'
import { MicVocal } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NowPlayingInfo } from '@/components/player/NowPlayingInfo'
import { PlayerControls } from '@/components/player/PlayerControls'
import { ProgressBar } from '@/components/player/ProgressBar'
import { VolumeControl } from '@/components/player/VolumeControl'
import { Slider } from '@/components/ui/Slider'
import {
  EQUALIZER_BANDS,
  EQUALIZER_PRESETS,
  type EqualizerPresetId,
  getEqualizerSettings,
  getPresetGains,
  normalizeEqualizerSettings,
  saveEqualizerSettings,
} from '@/services/equalizerPrefs'
import { enterPip } from '@/components/player/PictureInPicturePlayer'
import { usePlayerStore } from '@/stores/playerStore'
import { useJamStore } from '@/stores/jamStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { useDominantColor } from '@/hooks/useDominantColor'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useTranslation } from '@/i18n/useTranslation'
import { cn } from '@/utils/cn'

const RATES = [1, 1.25, 1.5, 2, 0.75]
const TIMER_OPTIONS = [15, 30, 45, 60]

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
  const [eqOpen, setEqOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [eqSettings, setEqSettings] = useState(getEqualizerSettings)
  const eqRowRef = useRef<HTMLButtonElement>(null)
  const sleepRowRef = useRef<HTMLButtonElement>(null)

  // Sync EQ settings from other tabs / localStorage changes
  useEffect(() => {
    const onChange = (event: Event) => {
      const next = event instanceof CustomEvent
        ? normalizeEqualizerSettings(event.detail)
        : getEqualizerSettings()
      setEqSettings(next)
    }
    window.addEventListener('EQUALIZER_EVENT', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('EQUALIZER_EVENT', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const eqActive = eqSettings.gains.some((gain) => gain !== 0)

  const applyPreset = (preset: EqualizerPresetId) => {
    const next = { preset, gains: getPresetGains(preset) }
    setEqSettings(next)
    saveEqualizerSettings(next)
  }

  const setGain = (index: number, gain: number) => {
    const gains = eqSettings.gains.map((current, i) => (i === index ? gain : current))
    const next = { preset: 'custom' as const, gains }
    setEqSettings(next)
    saveEqualizerSettings(next)
  }

  // Sleep timer
  const [sleepNow, setSleepNow] = useState(() => Date.now())
  const sleepTimerEndsAt = usePlayerStore((s) => s.sleepTimerEndsAt)
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer)
  useEffect(() => {
    if (sleepTimerEndsAt == null) return
    const id = window.setInterval(() => setSleepNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [sleepTimerEndsAt])
  const sleepActive = sleepTimerEndsAt != null
  const sleepMinutesLeft = sleepActive ? Math.max(1, Math.ceil((sleepTimerEndsAt - sleepNow) / 60_000)) : null

  const pickSleep = (minutes: number | null) => {
    setSleepTimer(minutes)
    setSleepOpen(false)
  }

  // Playback speed
  const playbackRate = usePlayerStore((s) => s.playbackRate)
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate)
  const nextRate = useMemo(() => RATES[(RATES.indexOf(playbackRate) + 1) % RATES.length] ?? 1, [playbackRate])

  const isVideoMode = playbackMode === 'video'
  const hasMedia = isVideoMode ? !!currentVideo : !!currentTrack
  const activePlaying = isVideoMode ? isVideoPlaying : isPlaying
  const activeTitle = isVideoMode ? currentVideo?.title : currentTrack?.title
  const activeCreator = isVideoMode ? currentVideo?.artist.name : currentTrack?.artist.name
  const activeImage = isVideoMode ? currentVideo?.thumbnailUrl : currentTrack?.album.coverUrl
  const activeImageAlt = isVideoMode ? currentVideo?.title : currentTrack?.album.title

  // Mobile mini-player picks up the artwork's dominant hue (Spotify-style). Called
  // unconditionally (hook rules) though only the mobile branch below consumes it.
  const artworkColor = useDominantColor(activeImage, { resetOnChange: true })

  // Like state for the mobile mini-player's inline heart button.
  const likedTrackIds = useLibraryStore((s) => s.likedTrackIds)
  const likeTrack = useLibraryStore((s) => s.likeTrack)
  const unlikeTrack = useLibraryStore((s) => s.unlikeTrack)
  const isCurrentLiked = currentTrack ? likedTrackIds.has(currentTrack.id) : false

  // â”€â”€ Mobile mini-player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isMobile) {
    if (!hasMedia) return null
    return (
      // Floating rounded card: sits inset from the screen edges with a gap above
      // the bottom nav (Spotify-style) rather than a full-bleed edge-to-edge bar.
      <div className="shrink-0 px-2 pb-2">
        <div
          className="overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 ring-white/10 transition-[background-color] duration-500 ease-out motion-reduce:transition-none"
          style={artworkColor ? { backgroundColor: `color-mix(in srgb, ${artworkColor} 55%, var(--c-base))` } : undefined}
        >
          {/* Thin progress bar strip at the top */}
          <div className="h-0.5 bg-white/20">
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
          {/* Like — sits left of play/pause; only for tracks (not music videos).
              stopPropagation so tapping the heart doesn't also open Now Playing. */}
          {currentTrack && !isVideoMode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (isCurrentLiked) unlikeTrack(currentTrack.id)
                else likeTrack(currentTrack)
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center transition-transform active:scale-90"
              aria-label={isCurrentLiked ? t('player.unlike') : t('player.like')}
              aria-pressed={isCurrentLiked}
            >
              <AnimatedLikeIcon liked={isCurrentLiked} className="h-6 w-6" heartClassName="h-6 w-6 text-secondary" />
            </button>
          )}
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
                  onClick={() => { setMoreOpen(false); setEqOpen(false); setSleepOpen(false) }}
                  aria-label="Close more player controls"
                />
                <div className="absolute bottom-full right-0 z-[1000] mb-3 w-72 rounded-lg border border-secondary/10 bg-elevated p-2 shadow-2xl">
                  {/* ── Playback speed ── */}
                  {!isVideoMode && (
                    <button
                      onClick={() => { setPlaybackRate(nextRate); setMoreOpen(false) }}
                      className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">Playback speed</p>
                        <p className="text-xs text-secondary">Change how fast the track plays</p>
                      </div>
                      <span className={`w-9 shrink-0 text-center text-xs font-bold tabular-nums ${playbackRate !== 1 ? 'text-accent' : 'text-secondary'}`}>
                        {playbackRate}×
                      </span>
                    </button>
                  )}

                  {/* ── Sleep timer ── */}
                  <div className="relative">
                    <button
                      ref={sleepRowRef}
                      onClick={() => setSleepOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">{t('player.sleep')}</p>
                        <p className="text-xs text-secondary">
                          {sleepActive ? t('player.sleep.left', { n: sleepMinutesLeft ?? 0 }) : 'Stop playback automatically'}
                        </p>
                      </div>
                      <span className={`shrink-0 ${sleepActive ? 'text-accent' : 'text-secondary'}`}>
                        {sleepActive ? <MoonSolid className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                      </span>
                    </button>
                    {sleepOpen && (
                      <div className="absolute bottom-full right-0 z-[1010] mb-2 w-44 rounded-md border border-secondary/10 bg-elevated py-1 shadow-2xl">
                        <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-secondary">{t('player.sleep')}</p>
                        {TIMER_OPTIONS.map((m) => (
                          <button key={m} onClick={() => pickSleep(m)} className="block w-full px-3 py-2 text-left text-sm font-semibold text-primary transition-colors hover:bg-surface">
                            {t('player.sleep.minutes', { n: m })}
                          </button>
                        ))}
                        {sleepActive && (
                          <>
                            <div className="my-1 border-t border-secondary/10" />
                            <button onClick={() => pickSleep(null)} className="block w-full px-3 py-2 text-left text-sm font-semibold text-accent transition-colors hover:bg-surface">
                              {t('player.sleep.turnOff', { n: sleepMinutesLeft ?? 0 })}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Equalizer ── */}
                  {!isVideoMode && (
                    <div className="relative">
                      <button
                        ref={eqRowRef}
                        onClick={() => setEqOpen((v) => !v)}
                        className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-primary">{t('player.equalizer')}</p>
                          <p className="text-xs text-secondary">Adjust the sound profile</p>
                        </div>
                        <span className={cn('shrink-0', eqActive ? 'text-accent' : 'text-secondary')}>
                          <AdjustmentsHorizontalIcon className="h-5 w-5" />
                        </span>
                      </button>
                      {eqOpen && (
                        <>
                          <button className="fixed inset-0 z-[1005]" onClick={() => setEqOpen(false)} aria-label="Close equalizer" />
                          <div className="absolute bottom-full right-0 z-[1010] mb-2 w-72 rounded-md border border-secondary/10 bg-elevated p-4 shadow-2xl">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">{t('player.equalizer')}</p>
                              <select
                                aria-label={t('player.eq.preset')}
                                value={eqSettings.preset}
                                onChange={(e) => applyPreset(e.target.value as EqualizerPresetId)}
                                className="rounded-md border border-secondary/20 bg-surface px-2 py-1 text-xs font-semibold text-primary outline-none transition-colors hover:border-secondary/40 focus:border-accent"
                              >
                                {EQUALIZER_PRESETS.map((preset) => (
                                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                                ))}
                                <option value="custom">{t('player.eq.custom')}</option>
                              </select>
                            </div>
                            <div className="space-y-3">
                              {EQUALIZER_BANDS.map((band, i) => (
                                <div key={band.frequency} className="grid grid-cols-[3.5rem_1fr_2.25rem] items-center gap-3">
                                  <span className="text-xs font-semibold text-secondary">{band.label}</span>
                                  <Slider
                                    value={eqSettings.gains[i] ?? 0}
                                    min={-12}
                                    max={12}
                                    step={1}
                                    onValueChange={(value) => setGain(i, value)}
                                    aria-label={t('player.eq.bandGain', { band: band.label })}
                                    trackClassName="bg-surface"
                                    thumbClassName="opacity-100 md:opacity-100"
                                  />
                                  <span className="text-right text-xs tabular-nums text-secondary">
                                    {(eqSettings.gains[i] ?? 0) > 0 ? '+' : ''}{eqSettings.gains[i] ?? 0}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Jam ── */}
                  {!isVideoMode && (
                    <button
                      onClick={() => {
                        if (jamRole === 'host') stopJam()
                        else startHosting()
                        setMoreOpen(false)
                      }}
                      className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">
                          {jamRole === 'host' ? t('player.jam.end') : 'Jam'}
                        </p>
                        <p className="text-xs text-secondary">
                          {jamRole === 'host' ? 'Stop the current listening session' : 'Listen together with friends'}
                        </p>
                      </div>
                      <span className={jamRole === 'host' ? 'text-accent' : 'text-secondary'}>
                        <UserGroupIcon className="h-5 w-5" />
                      </span>
                    </button>
                  )}
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
