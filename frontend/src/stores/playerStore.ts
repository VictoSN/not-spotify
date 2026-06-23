import { create } from 'zustand'
import type { Track } from '@/types/track'
import type { Ad } from '@/types/ad'
import { trackService } from '@/services/trackService'
import { adService } from '@/services/adService'
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

// --- Free-tier ad insertion ----------------------------------------------
// Premium never hears ads (that's the perk). For free users we play one house
// ad every N tracks, where N comes from the backend AdSettings. The ad plays
// through a dedicated element (see PromoPlayer) so the two-deck engine is left
// untouched; while it plays we hold the next track in `pendingAfterAd`.
let adConfig = { adsPerNTracks: 3, isEnabled: true }
let adConfigLoaded = false
let tracksSinceAd = 0
let pendingAfterAd: { track: Track; index: number } | null = null

function loadAdConfig() {
  if (adConfigLoaded) return
  adConfigLoaded = true
  adService.getSettings().then((s) => { adConfig = s }).catch(() => { })
}

/** Commit an advance to `next`, pushing the outgoing track onto history. */
function commitAdvance(next: Track, nextIndex: number) {
  const s = usePlayerStore.getState()
  const newHistory = s.currentTrack ? [...s.history, s.currentTrack].slice(-50) : s.history
  usePlayerStore.setState({
    currentTrack: next,
    queueIndex: nextIndex,
    currentTime: 0,
    isPlaying: true,
    history: newHistory,
  })
  recordPlay(next.id)
}

/**
 * Advance to `next`, but for free users insert an ad first every Nth track.
 * When it's ad-time we pause, fetch an ad, and (if one is returned) enter ad
 * mode — PromoPlayer then plays it and calls endAd() to release the held track.
 */
function advanceWithAdGate(next: Track, nextIndex: number) {
  if (!isFreeUser()) { commitAdvance(next, nextIndex); return }
  loadAdConfig()
  tracksSinceAd += 1
  const n = adConfig.adsPerNTracks
  const adDue = adConfig.isEnabled && n > 0 && tracksSinceAd > n && usePlayerStore.getState().currentAd == null
  if (!adDue) { commitAdvance(next, nextIndex); return }

  tracksSinceAd = 0
  pendingAfterAd = { track: next, index: nextIndex }
  usePlayerStore.setState({ isPlaying: false })
  const country = useAuthStore.getState().user?.country ?? undefined
  adService.getNext(country)
    .then((ad) => {
      if (ad && pendingAfterAd) {
        usePlayerStore.setState({ currentAd: ad })
      } else {
        pendingAfterAd = null
        commitAdvance(next, nextIndex)
      }
    })
    .catch(() => {
      pendingAfterAd = null
      commitAdvance(next, nextIndex)
    })
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
  isNowPlayingExpanded: boolean
  isKaraokeOpen: boolean
  /** A free-tier audio ad currently playing (blocks transport until it ends). */
  currentAd: Ad | null

  play: (track: Track, queue?: Track[]) => void
  endAd: () => void
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
  setNowPlayingExpanded: (expanded: boolean) => void
  toggleKaraoke: () => void
  setKaraokeOpen: (open: boolean) => void
  tick: (currentTime: number, duration: number) => void
}

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
  isNowPlayingExpanded: false,
  isKaraokeOpen: false,
  currentAd: null,

  endAd: () => {
    const p = pendingAfterAd
    pendingAfterAd = null
    set({ currentAd: null })
    if (p) commitAdvance(p.track, p.index)
  },

  play: (track, queue) => {
    // A deliberate track pick cancels any in-progress ad gate.
    pendingAfterAd = null
    if (get().currentAd) set({ currentAd: null })
    // Always start the track the user actually picked. Shuffle only governs what
    // plays *next* (see skipNext) — it never overrides an explicit selection.
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
    recordPlay(track.id)
  },

  pause: () => set({ isPlaying: false }),
  resume: () => { if (!get().currentAd) set({ isPlaying: true }) },

  togglePlayPause: () => {
    const { isPlaying, currentTrack, currentAd } = get()
    if (currentAd || !currentTrack) return // transport is locked while an ad plays
    set({ isPlaying: !isPlaying })
  },

  skipNext: () => {
    if (get().currentAd) return // ads are non-skippable
    const { queue, queueIndex, repeatMode, shuffleEnabled, currentTrack } = get()
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
    advanceWithAdGate(next, nextIndex)
  },

  skipPrevious: () => {
    if (get().currentAd) return // ads are non-skippable
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

  // Shuffle is purely a "what plays next" flag — toggling it never reorders or
  // restarts the current queue. skipNext picks a random track while it's on.
  toggleShuffle: () => set((s) => ({ shuffleEnabled: !s.shuffleEnabled })),

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

  toggleNowPlaying: () => set((s) => ({
    isNowPlayingOpen: !s.isNowPlayingOpen,
    isNowPlayingCollapsed: false,
    isNowPlayingExpanded: false,
  })),
  setNowPlayingCollapsed: (collapsed) => set({
    isNowPlayingCollapsed: collapsed,
    isNowPlayingExpanded: collapsed ? false : get().isNowPlayingExpanded,
  }),
  setNowPlayingExpanded: (expanded) => set({ isNowPlayingExpanded: expanded, isNowPlayingCollapsed: false }),
  toggleKaraoke: () => set((s) => {
    const isKaraokeOpen = !s.isKaraokeOpen
    // Lyrics render in the main card; if Now Playing is expanded it covers that
    // card, so minimize it on open and let the lyrics swap into the middle.
    return { isKaraokeOpen, isNowPlayingExpanded: isKaraokeOpen ? false : s.isNowPlayingExpanded }
  }),
  setKaraokeOpen: (open) => set((s) => ({
    isKaraokeOpen: open,
    isNowPlayingExpanded: open ? false : s.isNowPlayingExpanded,
  })),

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
    pendingAfterAd = null
    tracksSinceAd = 0
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      history: [],
      isKaraokeOpen: false,
      isNowPlayingExpanded: false,
      currentAd: null,
    })
  }
})
