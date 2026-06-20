import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MicrophoneIcon, ArrowUpTrayIcon, PlayIcon, MusicalNoteIcon } from '@heroicons/react/24/solid'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { trackService } from '@/services/trackService'
import { buildIndex, recognize, recordMic, isIndexed, type IndexResult } from '@/services/recognitionService'
import { usePlayerStore } from '@/stores/playerStore'
import type { Track } from '@/types/track'

type Phase = 'idle' | 'indexing' | 'listening' | 'matching' | 'done'

const LISTEN_SECONDS = 7

export function RecognizePage() {
  useDocumentTitle('Identify a song')
  const play = usePlayerStore((s) => s.play)

  const [tracks, setTracks] = useState<Track[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [countdown, setCountdown] = useState(0)
  const [indexInfo, setIndexInfo] = useState<IndexResult | null>(null)
  const [match, setMatch] = useState<{ track: Track | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const countdownTimer = useRef<number | null>(null)

  // The index covers the top tracks — fetched once and reused.
  useEffect(() => {
    trackService.getTrending(50).then(setTracks).catch(() => setTracks([]))
    return () => {
      if (countdownTimer.current) window.clearInterval(countdownTimer.current)
    }
  }, [])

  const busy = phase === 'indexing' || phase === 'listening' || phase === 'matching'

  const ensureIndex = async (): Promise<boolean> => {
    if (isIndexed()) return true
    if (tracks.length === 0) {
      setError('No tracks available to match against right now.')
      return false
    }
    setPhase('indexing')
    setProgress({ done: 0, total: tracks.length })
    const info = await buildIndex(
      tracks.map((t) => ({ id: t.id, audioUrl: t.audioUrl })),
      (done, total) => setProgress({ done, total }),
    )
    setIndexInfo(info)
    if (info.indexed === 0) {
      setError("Couldn't analyse any songs — the audio isn't accessible from the browser here.")
      return false
    }
    return true
  }

  const finish = (id: string | null) => {
    setMatch({ track: id ? tracks.find((t) => t.id === id) ?? null : null })
    setPhase('done')
  }

  const listen = async () => {
    setError(null)
    setMatch(null)
    if (!(await ensureIndex())) {
      setPhase('idle')
      return
    }
    try {
      setPhase('listening')
      setCountdown(LISTEN_SECONDS)
      countdownTimer.current = window.setInterval(
        () => setCountdown((c) => (c > 0 ? c - 1 : 0)),
        1000,
      )
      const clip = await recordMic(LISTEN_SECONDS)
      if (countdownTimer.current) window.clearInterval(countdownTimer.current)
      setPhase('matching')
      const rec = await recognize(clip)
      finish(rec?.confident ? rec.id : null)
    } catch {
      if (countdownTimer.current) window.clearInterval(countdownTimer.current)
      setError('Microphone access was blocked, or recording failed. Try the upload option instead.')
      setPhase('idle')
    }
  }

  const upload = async (file: File) => {
    setError(null)
    setMatch(null)
    if (!(await ensureIndex())) {
      setPhase('idle')
      return
    }
    try {
      setPhase('matching')
      const rec = await recognize(file)
      finish(rec?.confident ? rec.id : null)
    } catch {
      setError("Couldn't read that audio file. Try a different clip (mp3, m4a, wav…).")
      setPhase('idle')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-black text-primary">Identify a song</h1>
      <p className="mt-2 text-sm text-secondary">
        Play music near your mic, or upload a short clip, and we'll match it against the catalogue —
        fingerprinted entirely in your browser, no upload to any server.
      </p>

      {/* Listen button */}
      <div className="mt-10 flex flex-col items-center">
        <button
          type="button"
          onClick={listen}
          disabled={busy}
          className={`flex h-32 w-32 items-center justify-center rounded-full bg-accent text-page transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 ${
            phase === 'listening' ? 'animate-pulse' : ''
          }`}
          aria-label="Listen with microphone"
        >
          <MicrophoneIcon className="h-14 w-14" />
        </button>

        <p className="mt-5 h-6 text-sm font-semibold text-secondary">
          {phase === 'indexing' && `Preparing… analysing songs ${progress.done}/${progress.total}`}
          {phase === 'listening' && `Listening… ${countdown}s`}
          {phase === 'matching' && 'Matching…'}
          {phase === 'idle' && 'Tap to listen'}
          {phase === 'done' && 'Tap to listen again'}
        </p>

        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-secondary/50 px-5 py-2 text-sm font-bold text-primary transition-colors hover:border-primary">
          <ArrowUpTrayIcon className="h-4 w-4" />
          Upload a clip instead
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {error && <p className="mt-6 text-center text-sm font-semibold text-red-400">{error}</p>}

      {/* Result */}
      {phase === 'done' && match && (
        <div className="mt-8">
          {match.track ? (
            <div className="flex items-center gap-4 rounded-xl bg-surface p-4 ring-1 ring-accent/40">
              <img src={match.track.album.coverUrl} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent">Match found</p>
                <Link to={`/track/${match.track.id}`} className="block truncate text-lg font-black text-primary hover:underline">
                  {match.track.title}
                </Link>
                <p className="truncate text-sm font-semibold text-secondary">{match.track.artist.name}</p>
              </div>
              <button
                type="button"
                onClick={() => match.track && play(match.track, tracks)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-page transition-transform hover:scale-105 active:scale-95"
                aria-label="Play match"
              >
                <PlayIcon className="h-6 w-6" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl bg-surface p-6 text-center">
              <MusicalNoteIcon className="h-8 w-8 text-secondary" />
              <p className="mt-2 font-bold text-primary">No confident match</p>
              <p className="mt-1 text-sm text-secondary">
                Try again with the music louder and closer to the mic, or upload a cleaner clip.
                Recognition currently covers the top {indexInfo?.indexed ?? 0} tracks.
              </p>
            </div>
          )}
        </div>
      )}

      {indexInfo && indexInfo.failed > 0 && phase !== 'indexing' && (
        <p className="mt-6 text-center text-xs text-muted">
          {indexInfo.indexed} of {indexInfo.total} songs indexed
          {indexInfo.failed > 0 && ` (${indexInfo.failed} couldn't be analysed in this browser)`}.
        </p>
      )}
    </div>
  )
}
