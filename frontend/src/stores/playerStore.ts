import { create } from 'zustand'
import type { Track } from '@/types/track'
import type { Ad } from '@/types/ad'
import type { MusicVideo } from '@/types/musicVideo'
import { trackService } from '@/services/trackService'
import { adService } from '@/services/adService'
import { useAuthStore } from './authStore'

// Fire-and-forget play tracking. We dedupe within a short window so seeking/re-clicking
// the current track doesn't spam /me/plays. Module-scoped because it's an HTTP throttle,
// not part of the player's user-visible state.
const RECENT_PLAY_DEDUPE_MS = 5000
const lastRecordedAt = new Map<string, number>()

function isPrivateListening(): boolean {
  try {
    return window.localStorage.getItem('ns-pref-private-listening') === 'true'
  } catch {
    return false
  }
}

function recordPlay(trackId: string) {
  if (!useAuthStore.getState().isAuthenticated) return
  // Private listening: skip server-side play history + LastSeenAt bump
  // so other users can't see what or when you're listening.
  if (isPrivateListening()) return
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
export type PlaybackMode = 'audio' | 'video'

/** What kind of surface seeded the current queue (album page, playlist, etc.). */
export type PlayContextType = 'album' | 'playlist' | 'artist' | 'liked' | 'mix'
export interface PlayContext {
  type: PlayContextType
  id: string
}

/** Settings page persists this under ns-pref-autoplay (default true). */
function autoplayEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem('ns-pref-autoplay')
    return raw == null ? true : JSON.parse(raw) === true
  } catch {
    return true
  }
}

// How many recommended tracks we keep queued ahead — both when filling a
// standalone song's "Up Next" and when topping the queue up after it runs out.
const REC_QUEUE_SIZE = 15

/** Recommendations for a song, minus anything already in `existing`. */
async function fetchRecommendations(track: Track, existing: Track[]): Promise<Track[]> {
  // Song-based "radio": ranked by co-listen ("listeners like you also played") and
  // genre overlap *across artists*, not locked to the seed's artist. This is what
  // keeps an album going once it ends — same-artist top tracks would just be the
  // album we already played, leaving nothing fresh to queue.
  // Dynamic import avoids a store→service→store cycle at module load.
  const { trackService } = await import('@/services/trackService')
  // Ask for enough to still net ~REC_QUEUE_SIZE after dropping everything already in
  // the queue — an album seed's radio is heavy on that album's own tracks, which we
  // dedupe away. Backend clamps this to 60.
  const want = Math.min(60, existing.length + REC_QUEUE_SIZE + 5)
  const recs = await trackService.getRadio(track.id, want)
  const seen = new Set(existing.map((t) => t.id))
  return recs.filter((t) => !seen.has(t.id)).slice(0, REC_QUEUE_SIZE)
}

// --- Standalone "recommended → Up Next" -----------------------------------
// Playing a song on its own (a track page, a track card, a recommendation) gives
// a one-item queue, so "Up Next" would be empty. We fill it with the same artist
// recommendations the Now Playing panel shows, so the recommended track becomes
// the next in queue. Playing a playlist/album hands us a real multi-track queue,
// which we leave untouched. The token is bumped on every play()/setQueue() so a
// slow fetch from a previous standalone play can't append onto a queue the user
// has since replaced.
let standaloneFillToken = 0

function fillStandaloneQueue(track: Track, newQueue: Track[]) {
  const token = ++standaloneFillToken
  if (newQueue.length > 1) return // a real playlist/album context — leave it alone
  void (async () => {
    try {
      const fresh = await fetchRecommendations(track, newQueue)
      const s = usePlayerStore.getState()
      // Bail if the user moved on: a newer play/queue ran, the track changed, or a
      // real queue arrived while we were fetching.
      if (token !== standaloneFillToken) return
      if (s.currentTrack?.id !== track.id) return
      if (s.queue.length > 1) return
      if (fresh.length === 0) return
      usePlayerStore.setState({
        queue: [...s.queue, ...fresh],
        recommendedIds: new Set(fresh.map((t) => t.id)),
      })
    } catch {
      /* recommendations are best-effort; leave the lone track queued */
    }
  })()
}

interface PlayerState {
  playbackMode: PlaybackMode
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  currentVideo: MusicVideo | null
  isVideoPlaying: boolean
  videoCurrentTime: number
  videoDuration: number
  videoQueue: MusicVideo[]
  videoQueueIndex: number
  queue: Track[]
  queueIndex: number
  /** The album/playlist/artist/liked surface that seeded the current queue, so
   *  play buttons across the app can show pause for the active context. Null when
   *  a standalone track is playing (a single track card / track page). */
  currentContextType: PlayContextType | null
  currentContextId: string | null
  /** Ids of queue tracks that were appended as autoplay/radio recommendations (not
   *  part of the album/playlist the user started). Lets the Queue page mark where
   *  "your queue" ends and the radio begins. */
  recommendedIds: Set<string>
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
  playVideo: (video: MusicVideo, queue?: MusicVideo[]) => void
  /** Start a queue from a known context (album/playlist/artist/liked) so the
   *  matching play buttons reflect the playing state. */
  playContext: (context: PlayContext, tracks: Track[], startIndex?: number) => void
  endAd: () => void
  pause: () => void
  resume: () => void
  pauseVideo: () => void
  resumeVideo: () => void
  togglePlayPause: () => void
  skipNext: () => void
  skipPrevious: () => void
  seek: (seconds: number) => void
  videoTick: (currentTime: number, duration: number) => void
  stopVideo: () => void
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
  playbackMode: 'audio',
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  currentVideo: null,
  isVideoPlaying: false,
  videoCurrentTime: 0,
  videoDuration: 0,
  videoQueue: [],
  videoQueueIndex: -1,
  queue: [],
  queueIndex: -1,
  currentContextType: null,
  currentContextId: null,
  recommendedIds: new Set(),
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
      playbackMode: 'audio',
      currentVideo: null,
      isVideoPlaying: false,
      videoCurrentTime: 0,
      videoDuration: 0,
      currentTrack: track,
      queue: newQueue,
      queueIndex: index,
      // A standalone pick (track card / track page) has no album/playlist context.
      currentContextType: null,
      currentContextId: null,
      recommendedIds: new Set(),
      history: newHistory,
      isPlaying: true,
      currentTime: 0,
    })
    recordPlay(track.id)
    // Standalone song → fill Up Next with this artist's recommendations.
    fillStandaloneQueue(track, newQueue)
  },

  playVideo: (video, queue) => {
    pendingAfterAd = null
    standaloneFillToken++
    const newQueue = queue && queue.length > 0 ? queue : [video]
    const index = Math.max(0, newQueue.findIndex((item) => item.id === video.id))
    set({
      playbackMode: 'video',
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      currentContextType: null,
      currentContextId: null,
      recommendedIds: new Set(),
      currentAd: null,
      currentVideo: video,
      videoQueue: newQueue,
      videoQueueIndex: index,
      isVideoPlaying: true,
      videoCurrentTime: 0,
      videoDuration: video.durationMs > 0 ? video.durationMs / 1000 : 0,
    })
  },

  playContext: (context, tracks, startIndex = 0) => {
    const track = tracks[startIndex]
    if (!track) return
    // A deliberate context play cancels any in-progress ad gate / standalone fill.
    pendingAfterAd = null
    standaloneFillToken++
    if (get().currentAd) set({ currentAd: null })
    const { currentTrack, history } = get()
    const newHistory = currentTrack ? [...history, currentTrack].slice(-50) : history
    set({
      playbackMode: 'audio',
      currentVideo: null,
      isVideoPlaying: false,
      videoCurrentTime: 0,
      videoDuration: 0,
      currentTrack: track,
      queue: tracks,
      queueIndex: startIndex,
      currentContextType: context.type,
      currentContextId: context.id,
      recommendedIds: new Set(),
      history: newHistory,
      isPlaying: true,
      currentTime: 0,
    })
    recordPlay(track.id)
  },

  pause: () => set({ isPlaying: false }),
  resume: () => { if (!get().currentAd) set({ isPlaying: true }) },
  pauseVideo: () => set({ isVideoPlaying: false }),
  resumeVideo: () => { if (get().currentVideo) set({ playbackMode: 'video', isVideoPlaying: true, isPlaying: false }) },

  togglePlayPause: () => {
    const { playbackMode, isPlaying, currentTrack, currentAd, currentVideo, isVideoPlaying } = get()
    if (playbackMode === 'video') {
      if (!currentVideo) return
      set({ isVideoPlaying: !isVideoPlaying, isPlaying: false })
      return
    }
    if (currentAd || !currentTrack) return // transport is locked while an ad plays
    set({ isPlaying: !isPlaying })
  },

  skipNext: () => {
    if (get().playbackMode === 'video') {
      const { videoQueue, videoQueueIndex } = get()
      if (!videoQueue.length) return
      const nextIndex = videoQueueIndex + 1
      if (nextIndex >= videoQueue.length) {
        set({ isVideoPlaying: false })
        return
      }
      const next = videoQueue[nextIndex]
      set({
        currentVideo: next,
        videoQueueIndex: nextIndex,
        videoCurrentTime: 0,
        videoDuration: next.durationMs > 0 ? next.durationMs / 1000 : 0,
        isVideoPlaying: true,
      })
      return
    }
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
      else if (autoplayEnabled() && currentTrack) {
        // Autoplay: the queue (playlist, album, or a standalone song) ran out — keep
        // going with recommendations based on the last song. Applies to everyone;
        // free users still pass through the ad gate as each track advances.
        void (async () => {
          try {
            const fresh = await fetchRecommendations(currentTrack, get().queue)
            // Bail if the user started something else while we were fetching.
            if (get().currentTrack?.id !== currentTrack.id) return
            if (fresh.length === 0) { set({ isPlaying: false }); return }
            const base = get().queue
            set({
              queue: [...base, ...fresh],
              recommendedIds: new Set([...get().recommendedIds, ...fresh.map((t) => t.id)]),
            })
            advanceWithAdGate(fresh[0], base.length)
          } catch {
            set({ isPlaying: false })
          }
        })()
        return
      }
      else { set({ isPlaying: false }); return }
    }
    const next = queue[nextIndex]
    advanceWithAdGate(next, nextIndex)
  },

  skipPrevious: () => {
    if (get().playbackMode === 'video') {
      const { videoCurrentTime, videoQueueIndex, videoQueue } = get()
      if (videoCurrentTime > 3) {
        set({ videoCurrentTime: 0 })
        return
      }
      if (videoQueueIndex > 0) {
        const prev = videoQueue[videoQueueIndex - 1]
        set({
          currentVideo: prev,
          videoQueueIndex: videoQueueIndex - 1,
          videoCurrentTime: 0,
          videoDuration: prev.durationMs > 0 ? prev.durationMs / 1000 : 0,
          isVideoPlaying: true,
        })
      }
      return
    }
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

  seek: (seconds) => {
    if (get().playbackMode === 'video') set({ videoCurrentTime: seconds })
    else set({ currentTime: seconds })
  },

  videoTick: (currentTime, duration) => set({ videoCurrentTime: currentTime, videoDuration: duration }),

  stopVideo: () => set({
    playbackMode: get().currentTrack ? 'audio' : 'audio',
    currentVideo: null,
    isVideoPlaying: false,
    videoCurrentTime: 0,
    videoDuration: 0,
    videoQueue: [],
    videoQueueIndex: -1,
  }),

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
    // An explicit queue (playlist/album) cancels any pending standalone rec fill.
    standaloneFillToken++
    set({ playbackMode: 'audio', currentVideo: null, isVideoPlaying: false, videoCurrentTime: 0, videoDuration: 0, queue: tracks, queueIndex: startIndex, currentTrack: track, currentContextType: null, currentContextId: null, recommendedIds: new Set(), isPlaying: true, currentTime: 0 })
    recordPlay(track.id)
  },

  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),

  playNext: (track) =>
    set((s) => {
      // Nothing playing — just start it.
      if (!s.currentTrack) {
        recordPlay(track.id)
        return { playbackMode: 'audio', currentVideo: null, isVideoPlaying: false, currentTrack: track, queue: [track], queueIndex: 0, isPlaying: true, currentTime: 0 }
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
      playbackMode: 'audio',
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      currentVideo: null,
      isVideoPlaying: false,
      videoCurrentTime: 0,
      videoDuration: 0,
      videoQueue: [],
      videoQueueIndex: -1,
      queue: [],
      queueIndex: -1,
      currentContextType: null,
      currentContextId: null,
      recommendedIds: new Set(),
      history: [],
      isKaraokeOpen: false,
      isNowPlayingExpanded: false,
      currentAd: null,
    })
  }
})
