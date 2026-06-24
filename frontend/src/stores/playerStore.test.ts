import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Track } from '@/types/track'

// The store records plays and fetches ads as side effects; mock those services so
// tests stay offline and synchronous-ish. trackService.getRadio is dynamically
// imported to fill the queue with recommendations (standalone + end-of-queue).
vi.mock('@/services/trackService', () => ({
  trackService: {
    recordPlay: vi.fn(() => Promise.resolve()),
    getRadio: vi.fn(() => Promise.resolve([])),
  },
}))
const getNext = vi.fn(() => Promise.resolve<unknown>(null))
vi.mock('@/services/adService', () => ({
  adService: {
    getSettings: vi.fn(() => Promise.resolve({ adsPerNTracks: 3, isEnabled: true })),
    getNext: (...args: unknown[]) => getNext(...(args as [])),
  },
}))

import { usePlayerStore } from './playerStore'
import { useAuthStore } from './authStore'
import { trackService } from '@/services/trackService'

const track = (id: string): Track =>
  ({
    id,
    title: `Track ${id}`,
    durationMs: 180_000,
    audioUrl: `audio/${id}.mp3`,
    artist: { id: `artist-${id}`, name: 'Artist', imageUrl: null },
    album: { id: `album-${id}`, title: 'Album', coverUrl: '', releaseDate: '2020-01-01', type: 'album' },
    genres: [],
    playCount: 0,
    ratingCount: 0,
    averageRating: 0,
    previewUrl: null,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
    createdAt: '2020-01-01',
  }) as unknown as Track

const setPremium = () =>
  useAuthStore.setState({ isAuthenticated: true, user: { capabilities: { unlimitedPlayback: true } } as never })
const setFree = () =>
  useAuthStore.setState({ isAuthenticated: true, user: { capabilities: { unlimitedPlayback: false } } as never })

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  getNext.mockClear()
  getNext.mockResolvedValue(null)
  localStorage.clear()
  // Setting auth to logged-out fires the store's subscriber, which resets the
  // module-scoped ad counters (tracksSinceAd / pendingAfterAd) between tests.
  useAuthStore.setState({ isAuthenticated: false, user: null })
  usePlayerStore.setState({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    queue: [],
    queueIndex: -1,
    currentContextType: null,
    currentContextId: null,
    history: [],
    volume: 0.8,
    isMuted: false,
    shuffleEnabled: false,
    repeatMode: 'off',
    playbackRate: 1,
    sleepTimerEndsAt: null,
    currentAd: null,
  })
})

describe('playerStore — transport & queue', () => {
  it('play() starts a premium pick without shuffling the queue', () => {
    setPremium()
    const q = [track('a'), track('b'), track('c')]
    usePlayerStore.getState().play(q[1], q)
    const s = usePlayerStore.getState()
    expect(s.currentTrack?.id).toBe('b')
    expect(s.queueIndex).toBe(1)
    expect(s.isPlaying).toBe(true)
    expect(s.shuffleEnabled).toBe(false)
    expect(s.queue.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('play() starts the exact track the user tapped, even for free users', () => {
    setFree()
    const q = [track('a'), track('b'), track('c')]
    usePlayerStore.getState().play(q[1], q)
    const s = usePlayerStore.getState()
    // Shuffle no longer overrides an explicit pick — the tapped track plays.
    expect(s.currentTrack?.id).toBe('b')
    expect(s.queueIndex).toBe(1)
    expect(s.queue.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('play() of a standalone song fills Up Next with song recommendations', async () => {
    setPremium()
    vi.mocked(trackService.getRadio).mockResolvedValue([track('rec1'), track('rec2')])
    usePlayerStore.getState().play(track('solo')) // no queue → standalone
    await flush()
    const s = usePlayerStore.getState()
    expect(s.currentTrack?.id).toBe('solo')
    expect(s.queueIndex).toBe(0)
    expect(s.queue.map((t) => t.id)).toEqual(['solo', 'rec1', 'rec2'])
  })

  it('play() of a playlist/album leaves its queue untouched (no rec fill)', async () => {
    setPremium()
    vi.mocked(trackService.getRadio).mockResolvedValue([track('rec1'), track('rec2')])
    const q = [track('a'), track('b'), track('c')]
    usePlayerStore.getState().play(q[0], q)
    await flush()
    expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('a playlist played before the rec fetch resolves cancels the standalone fill', async () => {
    setPremium()
    let resolveRecs: (tracks: Track[]) => void = () => {}
    vi.mocked(trackService.getRadio).mockReturnValue(
      new Promise<Track[]>((r) => { resolveRecs = r }),
    )
    usePlayerStore.getState().play(track('solo')) // standalone — kicks off the fetch
    usePlayerStore.getState().play(track('a'), [track('a'), track('b')]) // playlist arrives first
    resolveRecs([track('rec1')]) // stale fetch resolves late
    await flush()
    // The stale recommendations must not append onto the playlist queue.
    expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('addToQueue appends; playNext inserts right after the current track', () => {
    setPremium()
    usePlayerStore.getState().play(track('a'), [track('a'), track('b')])
    usePlayerStore.getState().addToQueue(track('z'))
    expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(['a', 'b', 'z'])
    usePlayerStore.getState().playNext(track('n'))
    expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(['a', 'n', 'b', 'z'])
  })

  it('removeFromQueue shifts queueIndex when removing before the current track', () => {
    usePlayerStore.setState({ queue: [track('a'), track('b'), track('c')], queueIndex: 2 })
    usePlayerStore.getState().removeFromQueue(0)
    const s = usePlayerStore.getState()
    expect(s.queue.map((t) => t.id)).toEqual(['b', 'c'])
    expect(s.queueIndex).toBe(1)
  })

  it('reorderQueue follows the moved current track and adjusts a crossed index', () => {
    usePlayerStore.setState({ queue: [track('a'), track('b'), track('c')], queueIndex: 0 })
    // Move the current track (index 0) to the end → index follows it.
    usePlayerStore.getState().reorderQueue(0, 2)
    expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(['b', 'c', 'a'])
    expect(usePlayerStore.getState().queueIndex).toBe(2)

    // Move a track from after the current to before it → index shifts up by one.
    usePlayerStore.setState({ queue: [track('a'), track('b'), track('c')], queueIndex: 1 })
    usePlayerStore.getState().reorderQueue(2, 0)
    expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(['c', 'a', 'b'])
    expect(usePlayerStore.getState().queueIndex).toBe(2)
  })

  it('skipNext advances sequentially for premium; repeat-one restarts the same track', () => {
    setPremium()
    usePlayerStore.getState().play(track('a'), [track('a'), track('b'), track('c')])
    usePlayerStore.getState().skipNext()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('b')
    expect(usePlayerStore.getState().queueIndex).toBe(1)

    usePlayerStore.setState({ repeatMode: 'one', currentTime: 42 })
    usePlayerStore.getState().skipNext()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('b') // unchanged
    expect(usePlayerStore.getState().currentTime).toBe(0)
  })

  it('skipNext wraps to the start when repeat-all and the queue is exhausted', () => {
    setPremium()
    usePlayerStore.getState().play(track('a'), [track('a'), track('b')])
    usePlayerStore.setState({ repeatMode: 'all', queueIndex: 1, currentTrack: track('b') })
    usePlayerStore.getState().skipNext()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('a')
    expect(usePlayerStore.getState().queueIndex).toBe(0)
  })

  it('skipNext stops at the end with repeat off and autoplay disabled', () => {
    setPremium()
    localStorage.setItem('ns-pref-autoplay', 'false')
    usePlayerStore.setState({ queue: [track('a'), track('b')], queueIndex: 1, currentTrack: track('b'), isPlaying: true })
    usePlayerStore.getState().skipNext()
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })

  it('skipNext autoplays more from the artist when a premium queue runs out', async () => {
    setPremium()
    vi.mocked(trackService.getRadio).mockResolvedValue([track('x'), track('y')])
    // autoplay defaults on (no ns-pref-autoplay set); end of a sequential queue.
    usePlayerStore.setState({ queue: [track('a'), track('b')], queueIndex: 1, currentTrack: track('b'), isPlaying: true })
    usePlayerStore.getState().skipNext()
    await flush()
    const s = usePlayerStore.getState()
    expect(s.currentTrack?.id).toBe('x')
    expect(s.queue.map((t) => t.id)).toEqual(['a', 'b', 'x', 'y'])
  })

  it('autoplays recommendations for FREE users too when a queue runs out', async () => {
    setFree()
    vi.mocked(trackService.getRadio).mockResolvedValue([track('x'), track('y')])
    // A playlist/album queue that has reached its last track.
    usePlayerStore.setState({ queue: [track('a'), track('b')], queueIndex: 1, currentTrack: track('b'), isPlaying: true })
    usePlayerStore.getState().skipNext()
    await flush()
    const s = usePlayerStore.getState()
    expect(s.currentTrack?.id).toBe('x')
    expect(s.queue.map((t) => t.id)).toEqual(['a', 'b', 'x', 'y'])
  })

  it('togglePlayPause flips play state when a track is loaded', () => {
    setPremium()
    usePlayerStore.setState({ currentTrack: track('a'), isPlaying: false, currentAd: null })
    usePlayerStore.getState().togglePlayPause()
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    usePlayerStore.getState().togglePlayPause()
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })

  it('setQueue replaces the queue and starts from the given index', () => {
    setPremium()
    usePlayerStore.getState().setQueue([track('a'), track('b'), track('c')], 2)
    const s = usePlayerStore.getState()
    expect(s.currentTrack?.id).toBe('c')
    expect(s.queueIndex).toBe(2)
    expect(s.isPlaying).toBe(true)
  })

  it('playNext starts playback immediately when nothing is playing', () => {
    setPremium()
    usePlayerStore.setState({ currentTrack: null, queue: [], queueIndex: -1, isPlaying: false })
    usePlayerStore.getState().playNext(track('n'))
    const s = usePlayerStore.getState()
    expect(s.currentTrack?.id).toBe('n')
    expect(s.queue.map((t) => t.id)).toEqual(['n'])
    expect(s.isPlaying).toBe(true)
  })

  it('skipPrevious steps back by queue index when there is no history', () => {
    setPremium()
    usePlayerStore.setState({ currentTrack: track('b'), currentTime: 1, history: [], queue: [track('a'), track('b')], queueIndex: 1 })
    usePlayerStore.getState().skipPrevious()
    const s = usePlayerStore.getState()
    expect(s.currentTrack?.id).toBe('a')
    expect(s.queueIndex).toBe(0)
  })

  it('skipPrevious restarts the track when past 3s, else steps back through history', () => {
    setPremium()
    usePlayerStore.setState({ currentTrack: track('b'), currentTime: 10, queue: [track('a'), track('b')], queueIndex: 1 })
    usePlayerStore.getState().skipPrevious()
    expect(usePlayerStore.getState().currentTime).toBe(0)
    expect(usePlayerStore.getState().currentTrack?.id).toBe('b')

    usePlayerStore.setState({ currentTrack: track('b'), currentTime: 1, history: [track('a')] })
    usePlayerStore.getState().skipPrevious()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('a')
    expect(usePlayerStore.getState().history).toEqual([])
  })
})

describe('playerStore — free vs premium gating', () => {
  it('toggleShuffle flips the flag for free users too (no longer locked on)', () => {
    setFree()
    usePlayerStore.setState({ shuffleEnabled: false })
    usePlayerStore.getState().toggleShuffle()
    expect(usePlayerStore.getState().shuffleEnabled).toBe(true)
    usePlayerStore.getState().toggleShuffle()
    expect(usePlayerStore.getState().shuffleEnabled).toBe(false)
  })

  it('toggleShuffle flips the flag without reordering or moving off the current track', () => {
    setPremium()
    usePlayerStore.setState({ queue: [track('a'), track('b'), track('c')], currentTrack: track('a'), queueIndex: 0 })
    usePlayerStore.getState().toggleShuffle()
    const s = usePlayerStore.getState()
    expect(s.shuffleEnabled).toBe(true)
    // Shuffle only governs what plays next — the queue and current track are untouched.
    expect(s.queue.map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(s.queue[s.queueIndex].id).toBe('a')
    usePlayerStore.getState().toggleShuffle()
    expect(usePlayerStore.getState().shuffleEnabled).toBe(false)
  })

  it('cycleRepeat cycles off→all→one→off for free and premium alike', () => {
    setFree()
    usePlayerStore.getState().cycleRepeat()
    expect(usePlayerStore.getState().repeatMode).toBe('all')
    usePlayerStore.getState().cycleRepeat()
    expect(usePlayerStore.getState().repeatMode).toBe('one')
    usePlayerStore.getState().cycleRepeat()
    expect(usePlayerStore.getState().repeatMode).toBe('off')
  })
})

describe('playerStore — sleep timer, rate, volume', () => {
  it('setSleepTimer sets a future deadline and clears it with null', () => {
    const before = Date.now()
    usePlayerStore.getState().setSleepTimer(30)
    const ends = usePlayerStore.getState().sleepTimerEndsAt!
    expect(ends).toBeGreaterThanOrEqual(before + 30 * 60_000 - 50)
    usePlayerStore.getState().setSleepTimer(null)
    expect(usePlayerStore.getState().sleepTimerEndsAt).toBeNull()
  })

  it('tick pauses and clears the timer once the deadline passes', () => {
    usePlayerStore.setState({ isPlaying: true, sleepTimerEndsAt: Date.now() - 1 })
    usePlayerStore.getState().tick(12, 200)
    const s = usePlayerStore.getState()
    expect(s.isPlaying).toBe(false)
    expect(s.sleepTimerEndsAt).toBeNull()
    expect(s.currentTime).toBe(12)
  })

  it('setPlaybackRate clamps to [0.25, 3]', () => {
    usePlayerStore.getState().setPlaybackRate(10)
    expect(usePlayerStore.getState().playbackRate).toBe(3)
    usePlayerStore.getState().setPlaybackRate(0.01)
    expect(usePlayerStore.getState().playbackRate).toBe(0.25)
  })

  it('setVolume clamps to [0, 1] and unmutes', () => {
    usePlayerStore.setState({ isMuted: true })
    usePlayerStore.getState().setVolume(2)
    expect(usePlayerStore.getState().volume).toBe(1)
    expect(usePlayerStore.getState().isMuted).toBe(false)
    usePlayerStore.getState().setVolume(-1)
    expect(usePlayerStore.getState().volume).toBe(0)
  })
})

describe('playerStore — audio ads', () => {
  it('locks transport while an ad plays (non-skippable)', () => {
    setFree()
    usePlayerStore.setState({
      currentTrack: track('a'),
      isPlaying: false,
      currentAd: { id: 'ad1' } as never,
      queue: [track('a'), track('b')],
      queueIndex: 0,
    })
    usePlayerStore.getState().skipNext()
    usePlayerStore.getState().skipPrevious()
    usePlayerStore.getState().togglePlayPause()
    usePlayerStore.getState().resume()
    const s = usePlayerStore.getState()
    expect(s.currentTrack?.id).toBe('a') // nothing advanced
    expect(s.isPlaying).toBe(false) // resume/toggle blocked by the ad
  })

  it('premium never triggers an ad no matter how many tracks advance', async () => {
    setPremium()
    usePlayerStore.getState().play(track('a'), Array.from({ length: 8 }, (_, i) => track(`t${i}`)))
    for (let i = 0; i < 6; i++) usePlayerStore.getState().skipNext()
    await flush()
    expect(getNext).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().currentAd).toBeNull()
  })

  it('free users get an ad after N tracks, and endAd releases the held track', async () => {
    setFree()
    getNext.mockResolvedValue({ id: 'ad1', title: 'Ad' } as never)
    const q = Array.from({ length: 10 }, (_, i) => track(`t${i}`))
    usePlayerStore.getState().play(q[0], q)
    // Default cadence is 3 → the 4th advance is ad-time.
    for (let i = 0; i < 4; i++) usePlayerStore.getState().skipNext()
    await flush()

    expect(getNext).toHaveBeenCalled()
    expect(usePlayerStore.getState().currentAd).toEqual({ id: 'ad1', title: 'Ad' })
    expect(usePlayerStore.getState().isPlaying).toBe(false)

    usePlayerStore.getState().endAd()
    const s = usePlayerStore.getState()
    expect(s.currentAd).toBeNull()
    expect(s.isPlaying).toBe(true) // playback resumes on the held track
  })

  it('endAd with no held track just clears the ad without advancing', () => {
    setFree()
    usePlayerStore.setState({ currentTrack: track('a'), currentAd: { id: 'x' } as never, isPlaying: false })
    usePlayerStore.getState().endAd()
    const s = usePlayerStore.getState()
    expect(s.currentAd).toBeNull()
    expect(s.currentTrack?.id).toBe('a') // nothing was queued behind the ad, so nothing advances
  })
})

describe('playerStore — playback context', () => {
  it('playContext() records the album/playlist context that seeded the queue', () => {
    setPremium()
    const q = [track('a'), track('b'), track('c')]
    usePlayerStore.getState().playContext({ type: 'playlist', id: 'pl1' }, q, 1)
    const s = usePlayerStore.getState()
    expect(s.currentTrack?.id).toBe('b')
    expect(s.queueIndex).toBe(1)
    expect(s.isPlaying).toBe(true)
    expect(s.currentContextType).toBe('playlist')
    expect(s.currentContextId).toBe('pl1')
    expect(s.queue.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('play() (a standalone pick) clears any previous context', () => {
    setPremium()
    usePlayerStore.getState().playContext({ type: 'album', id: 'al1' }, [track('a'), track('b')])
    expect(usePlayerStore.getState().currentContextType).toBe('album')
    usePlayerStore.getState().play(track('z'))
    const s = usePlayerStore.getState()
    expect(s.currentContextType).toBeNull()
    expect(s.currentContextId).toBeNull()
  })

  it('playContext() ignores an out-of-range start index', () => {
    setPremium()
    usePlayerStore.getState().playContext({ type: 'album', id: 'al1' }, [], 0)
    expect(usePlayerStore.getState().currentContextType).toBeNull()
  })
})
