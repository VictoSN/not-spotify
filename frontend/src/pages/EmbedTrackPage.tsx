import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { formatSeconds } from '@/utils/formatTime'

/**
 * Standalone, theme-independent track player meant to be embedded in an
 * `<iframe>` on any external page. Rendered at the top-level `/embed/track/:id`
 * route — outside AppShell, so no sidebar, player bar, or auth is involved.
 *
 * Self-contained on purpose: it uses its own `<audio>` element (not the global
 * two-deck audioEngine) and explicit colors rather than the app's theme CSS
 * variables, so it looks right regardless of the host page or the user's
 * light/dark preference. The "play" link drops listeners onto the full track
 * page in the top frame.
 */
export function EmbedTrackPage() {
  const { id } = useParams<{ id: string }>()
  const [track, setTrack] = useState<Track | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!id) return
    setLoadError(false)
    trackService
      .getById(id)
      .then(setTrack)
      .catch(() => setLoadError(true))
  }, [id])

  // Make the embed deep-linkable: set the document title to the track.
  useEffect(() => {
    if (track) document.title = `${track.title} · ${track.artist.name}`
  }, [track])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(e.target.value)
    setCurrent(audio.currentTime)
  }

  const trackUrl = track ? `${window.location.origin}/track/${track.id}` : '#'
  const total = duration || (track ? track.durationMs / 1000 : 0)

  if (loadError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-900 text-sm text-neutral-400">
        This track is unavailable.
      </div>
    )
  }

  if (!track) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-900 text-sm text-neutral-500">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full items-center gap-3 bg-neutral-900 p-3 text-white sm:gap-4 sm:p-4">
      <a
        href={trackUrl}
        target="_top"
        rel="noopener"
        className="flex-shrink-0"
        title={`${track.title} — open on not-spotify`}
      >
        <img
          src={track.album.coverUrl}
          alt={track.album.title}
          className="h-[104px] w-[104px] rounded-md object-cover sm:h-[120px] sm:w-[120px]"
        />
      </a>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div className="min-w-0">
          <a
            href={trackUrl}
            target="_top"
            rel="noopener"
            className="block truncate text-base font-bold leading-tight hover:underline"
          >
            {track.title}
          </a>
          <p className="truncate text-sm text-neutral-400">{track.artist.name}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500 transition-transform active:scale-95 hover:bg-green-400"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <PauseIcon className="h-5 w-5 text-black" />
            ) : (
              <PlayIcon className="ml-0.5 h-5 w-5 text-black" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={total || 0}
            step={0.1}
            value={current}
            onChange={handleSeek}
            aria-label="Seek"
            className="h-1 flex-1 cursor-pointer accent-green-500"
          />

          <span className="w-20 flex-shrink-0 text-right font-mono text-xs tabular-nums text-neutral-400">
            {formatSeconds(current)} / {formatSeconds(total)}
          </span>
        </div>

        <a
          href={`${window.location.origin}`}
          target="_top"
          rel="noopener"
          className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-300"
        >
          ▶ not-spotify
        </a>
      </div>

      <audio
        ref={audioRef}
        src={track.audioUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
    </div>
  )
}
