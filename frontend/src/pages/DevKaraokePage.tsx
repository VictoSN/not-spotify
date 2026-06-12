import { useEffect, useRef, useState } from 'react'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { LyricsView } from '@/components/player/LyricsView'

// Real LRCLIB payload for Coldplay – Yellow (the format the backend stores in
// Tracks.SyncedLyrics). Trimmed to the first verses; enough to exercise the UI.
const SAMPLE_LRC = `[00:35.66] Look at the stars
[00:38.46] Look how they shine for you
[00:40.36]
[00:44.17] And everything you do
[00:45.27]
[00:49.66] Yeah, they were all yellow
[00:54.36] I came along
[00:57.07] I wrote a song for you
[01:00.97] And all the things you do
[01:04.87] And it was called Yellow
[01:12.47] So then I took my turn
[01:16.08] Oh, what a thing to have done
[01:19.78] And it was all yellow
[01:28.99] Your skin, oh yeah, your skin and bones
[01:36.18] Turn into something beautiful
[01:43.18] And you know, you know I love you so
[01:50.79] You know I love you so`

const FAKE_TRACK: Track = {
  id: 'dev-karaoke-track',
  title: 'Yellow',
  durationMs: 269_000,
  audioUrl: '',
  previewUrl: null,
  trackNumber: 5,
  discNumber: 1,
  explicit: false,
  playCount: 0,
  ratingCount: 0,
  averageRating: 0,
  artist: { id: 'dev-artist', name: 'Coldplay', imageUrl: null },
  album: { id: 'dev-album', title: 'Parachutes', coverUrl: '', releaseDate: '2000-06-26', type: 'album' },
  genres: [],
  createdAt: new Date().toISOString(),
}

/**
 * DEV-only harness for the karaoke lyrics view (route /dev/karaoke, never in
 * production builds). Drives the real player store with a simulated clock so
 * sync highlight / auto-scroll / seek-on-click are testable without a backend.
 */
export function DevKaraokePage() {
  const [running, setRunning] = useState(false)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    usePlayerStore.setState({ currentTrack: FAKE_TRACK })
    timer.current = window.setInterval(() => {
      const s = usePlayerStore.getState()
      s.tick(s.currentTime + 0.25, FAKE_TRACK.durationMs / 1000)
    }, 250)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [running])

  const jump = (seconds: number) => usePlayerStore.getState().seek(seconds)

  return (
    <div className="min-h-screen bg-page p-8 text-primary">
      <h1 className="text-2xl font-bold mb-1">Karaoke dev harness</h1>
      <p className="text-sm text-secondary mb-4">
        Simulated clock: <span data-testid="clock" className="tabular-nums">{currentTime.toFixed(2)}s</span>
      </p>
      <div className="flex gap-2 mb-6">
        <button data-testid="start" onClick={() => setRunning(true)} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-black">
          Start
        </button>
        <button data-testid="jump-35" onClick={() => jump(35.7)} className="rounded-full bg-elevated px-4 py-1.5 text-sm">
          Jump 0:35
        </button>
        <button data-testid="jump-75" onClick={() => jump(75)} className="rounded-full bg-elevated px-4 py-1.5 text-sm">
          Jump 1:15
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8 max-w-4xl">
        <section data-testid="karaoke-page">
          <h2 className="text-base font-bold mb-2">Page variant (synced)</h2>
          <LyricsView lyrics={null} syncedLyrics={SAMPLE_LRC} trackId={FAKE_TRACK.id} variant="page" />
        </section>
        <div className="flex flex-col gap-8">
          <section data-testid="karaoke-card" className="rounded-lg bg-elevated p-4">
            <h2 className="text-base font-bold mb-2">Card variant (synced)</h2>
            <LyricsView lyrics={null} syncedLyrics={SAMPLE_LRC} trackId={FAKE_TRACK.id} variant="card" />
          </section>
          <section data-testid="static-fallback" className="rounded-lg bg-elevated p-4">
            <h2 className="text-base font-bold mb-2">Fallback (plain lyrics, no timestamps)</h2>
            <LyricsView lyrics={'Look at the stars\nLook how they shine for you'} syncedLyrics={null} trackId="some-other-track" variant="card" />
          </section>
        </div>
      </div>
    </div>
  )
}
