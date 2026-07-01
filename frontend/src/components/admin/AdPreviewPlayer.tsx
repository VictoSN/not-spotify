import { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid'
import type { AdAdmin } from '@/types/ad'

interface AdPreviewPlayerProps {
  ad: AdAdmin
  autoPlay?: boolean
  onEnded?: () => void
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Standalone audio player for admin ad previews. Uses its own `<audio>` element
 * so it never contends with the main app's player. Unmount stops playback.
 */
export function AdPreviewPlayer({ ad, autoPlay = true, onEnded }: AdPreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(ad.durationMs > 0 ? ad.durationMs / 1000 : 0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Re-load audio when the ad changes (Play on a different row).
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    setCurrentTime(0)
    setLoadError(null)
    el.load()
    if (autoPlay) {
      el.play().catch((err: unknown) => {
        // Ignore AbortError — happens when React re-runs this effect (strict
        // mode) and the previous play() is superseded by a new load().
        if (err instanceof DOMException && err.name === 'AbortError') return
        setLoadError(err instanceof Error ? err.message : 'Playback blocked')
        setIsPlaying(false)
      })
    }
  }, [ad.id, ad.audioUrl, autoPlay])

  // Sync volume/mute to the audio element.
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
    el.muted = isMuted
  }, [volume, isMuted])

  const togglePlay = async () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      try { await el.play() } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Playback blocked')
      }
    } else {
      el.pause()
    }
  }

  const seek = (value: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = value
    setCurrentTime(value)
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-elevated/50 bg-elevated/30 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-black transition-transform hover:scale-105"
          aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
        >
          {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary">{ad.title}</p>
          <p className="truncate text-xs text-secondary">
            {ad.advertiser || 'Unknown advertiser'}
            {' · '}
            {ad.durationMs ? `${Math.round(ad.durationMs / 1000)}s` : 'unknown length'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-secondary hover:bg-elevated hover:text-primary"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <SpeakerXMarkIcon className="h-4 w-4" /> : <SpeakerWaveIcon className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false) }}
            aria-label="Volume"
            className="h-1 w-24 cursor-pointer accent-accent"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-10 text-right text-[11px] font-mono text-secondary">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          className="h-1 flex-1 cursor-pointer accent-accent"
          disabled={!duration}
        />
        <span className="w-10 text-[11px] font-mono text-secondary">{formatTime(duration)}</span>
      </div>

      {loadError && (
        <p className="text-xs text-red-400">Playback failed: {loadError}</p>
      )}

      <audio
        ref={audioRef}
        src={ad.audioUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); onEnded?.() }}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => {
          const dur = (e.target as HTMLAudioElement).duration
          if (Number.isFinite(dur)) setDuration(dur)
        }}
        onError={() => setLoadError('Failed to load audio')}
      />
    </div>
  )
}
