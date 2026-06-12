import { create } from 'zustand'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { useAuthStore } from './authStore'

// Fire-and-forget play tracking. We dedupe within a short window so seeking/re-clicking
// the current track doesn't spam /me/plays. Module-scoped because it's an HTTP throttle,
// not part of the player's user-visible state.
const RECENT_PLAY_DEDUPE_MS = 5000
const lastRecordedAt = new Map<string, number>()

function recordPlay(trackId: string) {
  if (!useAuthStore.getState().isAuthenticated) return
  const now = Date.now()
  if (now - (lastRecordedAt.get(trackId) ?? 0) < RECENT_PLAY_DEDUPE_MS) return
  lastRecordedAt.set(trackId, now)
  trackService.recordPlay(trackId).catch(() => { })
}

function isFreeUser(): boolean {
  return useAuthStore.getState().user?.capabilities?.unlimitedPlayback === false
}

export type RepeatMode = 'off' | 'one' | 'all'

/** Settings page persists this under ns-pref-autoplay (default true). */
function autoplayEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem('ns-pref-autoplay')
    return raw == null ? true : JSON.parse(raw) === true
  } catch {
    return true
  }
}

interface PlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  queue: Track[]
  queueIndex: number
  history: Track[]
  volume: number
  isMuted: boolean
  shuffleEnabled: boolean
  repeatMode: RepeatMode
  playbackRate: number
  /** Epoch ms when playback should pause, or null when no sleep timer is set. */
  sleepTimerEndsAt: number | null
  isNowPlayingOpen: boolean
  isNowPlayingCollapsed: boolean
  isKaraokeOpen: boolean

  play: (track: Track, queue?: Track[]) => void
  pause: () => void
  resume: () => void
  togglePlayPause: () => void
  skipNext: () => void
  skipPrevious: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setQueue: (tracks: Track[], startIndex?: number) => void
  addToQueue: (track: Track) => void
  playNext: (track: Track) => void
  removeFromQueue: (index: number) => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
  setPlaybackRate: (rate: number) => void
  setSleepTimer: (minutes: number | null) => void
  toggleNowPlaying: () => void
  setNowPlayingCollapsed: (collapsed: boolean) => void
  toggleKaraoke: () => void
  tick: (currentTime: number, duration: number) => void
}

const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  queueIndex: -1,
  history: [],
  volume: 0.8,
  isMuted: false,
  shuffleEnabled: false,
  repeatMode: 'off',
  playbackRate: 1,
  sleepTimerEndsAt: null,
  isNowPlayingOpen: true,
  isNowPlayingCollapsed: false,
  isKaraokeOpen: false,

  play: (track, queue) => {
    let newQueue = queue ?? [track]
    let targetTrack = track
    const free = isFreeUser()

    if (free && newQueue.length > 1) {
      // Free users always get a shuffled queue; the specific track they tapped
      // is ignored in favour of a random starting position.
      newQueue = shuffle(newQueue)
      targetTrack = newQueue[0]
    }

    const index = newQueue.findIndex((t) => t.id === targetTrack.id)
    const { currentTrack, history } = get()
    const newHistory = currentTrack ? [...history, currentTrack].slice(-50) : history
    set({
      currentTrack: targetTrack,
      queue: newQueue,
      queueIndex: index,
      history: newHistory,
      isPlaying: true,
      currentTime: 0,
      shuffleEnabled: free ? true : get().shuffleEnabled,
    })
    recordPlay(targetTrack.id)
  },

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  togglePlayPause: () => {
    const { isPlaying, currentTrack } = get()
    if (!currentTrack) return
    set({ isPlaying: !isPlaying })
  },

  skipNext: () => {
    const { queue, queueIndex, repeatMode, shuffleEnabled, currentTrack, history } = get()
    if (repeatMode === 'one') {
      set({ currentTime: 0, isPlaying: true })
      return
    }
    if (!queue.length) return
    let nextIndex: number
    if (shuffleEnabled) {
      nextIndex = Math.floor(Math.random() * queue.length)
    } else {
      nextIndex = queueIndex + 1
    }
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') nextIndex = 0
      else if (autoplayEnabled() && currentTrack && !isFreeUser()) {
        // Autoplay: queue ran out — keep going with more from the same artist.
        // Dynamic import avoids a store→service→store cycle at module load.
        void import('@/services/artistService').then(async ({ artistService }) => {
          try {
            const more = await artistService.getTopTracks(currentTrack.artist.id, 10)
            const base = get().queue
            const seen = new Set(base.map((t) => t.id))
            const fresh = more.filter((t) => !seen.has(t.id))
            if (fresh.length === 0) { set({ isPlaying: false }); return }
            const next = fresh[0]
            set({ queue: [...base, ...fresh], queueIndex: base.length, currentTrack: next, currentTime: 0, isPlaying: true })
            recordPlay(next.id)
          } catch {
            set({ isPlaying: false })
          }
        })
        return
      }
      else { set({ isPlaying: false }); return }
    }
    const next = queue[nextIndex]
    const newHistory = currentTrack ? [...history, currentTrack].slice(-50) : history
    set({ currentTrack: next, queueIndex: nextIndex, currentTime: 0, isPlaying: true, history: newHistory })
    recordPlay(next.id)
  },

  skipPrevious: () => {
    const { currentTime, queueIndex, queue, history } = get()
    if (currentTime > 3) {
      set({ currentTime: 0 })
      return
    }
    if (history.length > 0) {
      const prev = history[history.length - 1]
      const prevIndex = queue.findIndex((t) => t.id === prev.id)
      set({ currentTrack: prev, queueIndex: prevIndex >= 0 ? prevIndex : queueIndex - 1, currentTime: 0, isPlaying: true, history: history.slice(0, -1) })
      recordPlay(prev.id)
      return
    }
    if (queueIndex > 0) {
      const prev = queue[queueIndex - 1]
      set({ currentTrack: prev, queueIndex: queueIndex - 1, currentTime: 0, isPlaying: true })
      recordPlay(prev.id)
    }
  },

  seek: (seconds) => set({ currentTime: seconds }),

  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), isMuted: false }),

  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),

  toggleShuffle: () =>
    set((s) => {
      // Free users are locked to shuffle — turning it off is a no-op.
      if (isFreeUser()) return { shuffleEnabled: true }
      if (!s.shuffleEnabled) {
        const shuffled = shuffle(s.queue)
        return { shuffleEnabled: true, queue: shuffled, queueIndex: shuffled.findIndex((t) => t.id === s.currentTrack?.id) }
      }
      return { shuffleEnabled: false }
    }),

  cycleRepeat: () =>
    set((s) => {
      // Free users cannot use repeat.
      if (isFreeUser()) return {}
      const order: RepeatMode[] = ['off', 'all', 'one']
      const next = order[(order.indexOf(s.repeatMode) + 1) % order.length]
      return { repeatMode: next }
    }),

  setQueue: (tracks, startIndex = 0) => {
    const track = tracks[startIndex]
    if (!track) return
    set({ queue: tracks, queueIndex: startIndex, currentTrack: track, isPlaying: true, currentTime: 0 })
    recordPlay(track.id)
  },

  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),

  playNext: (track) =>
    set((s) => {
      // Nothing playing — just start it.
      if (!s.currentTrack) {
        recordPlay(track.id)
        return { currentTrack: track, queue: [track], queueIndex: 0, isPlaying: true, currentTime: 0 }
      }
      const newQueue = [...s.queue]
      newQueue.splice(s.queueIndex + 1, 0, track)
      return { queue: newQueue }
    }),

  removeFromQueue: (index) =>
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index)
      const newIndex = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex
      return { queue: newQueue, queueIndex: newIndex }
    }),

  reorderQueue: (from, to) =>
    set((s) => {
      const newQueue = [...s.queue]
      const [moved] = newQueue.splice(from, 1)
      newQueue.splice(to, 0, moved)
      let newQueueIndex = s.queueIndex
      if (s.queueIndex === from) {
        newQueueIndex = to
      } else if (from < s.queueIndex && to >= s.queueIndex) {
        newQueueIndex = s.queueIndex - 1
      } else if (from > s.queueIndex && to <= s.queueIndex) {
        newQueueIndex = s.queueIndex + 1
      }
      return { queue: newQueue, queueIndex: newQueueIndex }
    }),

  setPlaybackRate: (rate) => set({ playbackRate: Math.max(0.25, Math.min(3, rate)) }),

  setSleepTimer: (minutes) =>
    set({ sleepTimerEndsAt: minutes == null ? null : Date.now() + minutes * 60_000 }),

  toggleNowPlaying: () => set((s) => ({ isNowPlayingOpen: !s.isNowPlayingOpen, isNowPlayingCollapsed: false })),
  setNowPlayingCollapsed: (collapsed) => set({ isNowPlayingCollapsed: collapsed }),
  toggleKaraoke: () => set((s) => ({ isKaraokeOpen: !s.isKaraokeOpen })),

  tick: (currentTime, duration) => {
    const { sleepTimerEndsAt } = get()
    // Sleep timer fires on the playback clock so it only triggers while playing.
    if (sleepTimerEndsAt != null && Date.now() >= sleepTimerEndsAt) {
      set({ currentTime, duration, isPlaying: false, sleepTimerEndsAt: null })
      return
    }
    set({ currentTime, duration })
  },
}))

// Subscribe to auth state changes to pause and reset playback on logout
useAuthStore.subscribe((state) => {
  if (!state.isAuthenticated) {
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      history: [],
      isKaraokeOpen: false,
    })
  }
})
