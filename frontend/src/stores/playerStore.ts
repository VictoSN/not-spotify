import { create } from 'zustand'
import type { Track } from '@/types/track'

export type RepeatMode = 'off' | 'one' | 'all'

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
  isQueueOpen: boolean

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
  removeFromQueue: (index: number) => void
  toggleQueue: () => void
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
  isQueueOpen: false,

  play: (track, queue) => {
    const newQueue = queue ?? [track]
    const index = newQueue.findIndex((t) => t.id === track.id)
    const { currentTrack, history } = get()
    const newHistory = currentTrack ? [...history, currentTrack].slice(-50) : history
    set({
      currentTrack: track,
      queue: newQueue,
      queueIndex: index,
      history: newHistory,
      isPlaying: true,
      currentTime: 0,
    })
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
      else { set({ isPlaying: false }); return }
    }
    const next = queue[nextIndex]
    const newHistory = currentTrack ? [...history, currentTrack].slice(-50) : history
    set({ currentTrack: next, queueIndex: nextIndex, currentTime: 0, isPlaying: true, history: newHistory })
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
      return
    }
    if (queueIndex > 0) {
      const prev = queue[queueIndex - 1]
      set({ currentTrack: prev, queueIndex: queueIndex - 1, currentTime: 0, isPlaying: true })
    }
  },

  seek: (seconds) => set({ currentTime: seconds }),

  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), isMuted: false }),

  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),

  toggleShuffle: () =>
    set((s) => {
      if (!s.shuffleEnabled) {
        const shuffled = shuffle(s.queue)
        return { shuffleEnabled: true, queue: shuffled, queueIndex: shuffled.findIndex((t) => t.id === s.currentTrack?.id) }
      }
      return { shuffleEnabled: false }
    }),

  cycleRepeat: () =>
    set((s) => {
      const order: RepeatMode[] = ['off', 'all', 'one']
      const next = order[(order.indexOf(s.repeatMode) + 1) % order.length]
      return { repeatMode: next }
    }),

  setQueue: (tracks, startIndex = 0) => {
    const track = tracks[startIndex]
    if (!track) return
    set({ queue: tracks, queueIndex: startIndex, currentTrack: track, isPlaying: true, currentTime: 0 })
  },

  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),

  removeFromQueue: (index) =>
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index)
      const newIndex = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex
      return { queue: newQueue, queueIndex: newIndex }
    }),

  toggleQueue: () => set((s) => ({ isQueueOpen: !s.isQueueOpen })),

  tick: (currentTime, duration) => set({ currentTime, duration }),
}))
