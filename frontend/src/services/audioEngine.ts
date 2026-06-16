import { usePlayerStore } from '@/stores/playerStore'
import { resolvePlaybackSrc } from '@/services/offlineAudio'
import {
  EQUALIZER_BANDS,
  EQUALIZER_EVENT,
  getEqualizerSettings,
  normalizeEqualizerSettings,
} from '@/services/equalizerPrefs'
import type { Track } from '@/types/track'

/*
 * Two-deck audio engine.
 *
 * A single <audio> element can't crossfade (you'd hear a gap while the next
 * source loads) so we keep two interchangeable "decks". One deck plays the
 * current track; the idle deck pre-buffers the next deterministic track so:
 *   - gapless: the next song starts instantly with no buffering gap, and
 *   - crossfade: the outgoing and incoming songs overlap with volume ramps.
 *
 * The player store stays the single source of truth for *what* plays next
 * (shuffle / repeat / autoplay all live there). The engine only reacts to the
 * store, except for one proactive move: when crossfade is on it calls skipNext()
 * a few seconds early so the two tracks can overlap.
 */

const PRELOAD_LEAD = 15 // seconds before the end to start buffering the next deck
const MAX_CROSSFADE = 12 // seconds (Spotify caps here too)

/** Crossfade length in seconds (0 = off). Persisted by Settings under ns-pref-crossfade. */
function readCrossfadeSeconds(): number {
  try {
    const raw = window.localStorage.getItem('ns-pref-crossfade')
    if (raw == null) return 0
    const v = JSON.parse(raw) as unknown
    // Back-compat: the toggle used to store a boolean.
    if (typeof v === 'boolean') return v ? 6 : 0
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_CROSSFADE, n)) : 0
  } catch {
    return 0
  }
}

/** Volume-normalization toggle (off by default). Persisted by Settings under ns-pref-normalize. */
function readNormalizeEnabled(): boolean {
  try {
    return window.localStorage.getItem('ns-pref-normalize') === 'true'
  } catch {
    return false
  }
}

const clampVol = (v: number) => Math.max(0, Math.min(1, v))

class AudioEngine {
  private decks: [HTMLAudioElement, HTMLAudioElement]
  private srcs: [string, string] = ['', '']
  private active: 0 | 1 = 0
  private audioContext: AudioContext | null = null
  private deckSources: [MediaElementAudioSourceNode | null, MediaElementAudioSourceNode | null] = [null, null]
  private deckFilters: [BiquadFilterNode[], BiquadFilterNode[]] = [[], []]
  // Shared output stage after the per-deck EQ chains: a compressor that levels
  // loud songs + a makeup gain that lifts quiet ones (volume normalization).
  private normalizer: DynamicsCompressorNode | null = null
  private normalizeGain: GainNode | null = null
  private equalizerGains = getEqualizerSettings().gains
  private crossfadeSec = readCrossfadeSeconds()
  private normalizeEnabled = readNormalizeEnabled()
  private fadeRaf: number | null = null
  /** Deck currently ramping out during a crossfade (so we can stop it on cancel). */
  private fadingOut: HTMLAudioElement | null = null
  /** True between the early skipNext() and the next deck taking over. */
  private crossfading = false
  private preloadedId: string | null = null
  private unsubscribe: (() => void) | null = null
  private mediaSessionTrackId: string | null = null
  private onPrefChange: () => void
  private onEqualizerChange: (event: Event) => void

  constructor() {
    this.decks = [new Audio(), new Audio()]
    this.decks.forEach((deck, i) => {
      deck.crossOrigin = 'anonymous'
      deck.preload = 'auto'
      this.bindDeckEvents(i as 0 | 1)
    })
    this.onPrefChange = () => {
      this.crossfadeSec = readCrossfadeSeconds()
      this.normalizeEnabled = readNormalizeEnabled()
      this.applyNormalize()
    }
    this.onEqualizerChange = (event) => {
      const next = event instanceof CustomEvent
        ? normalizeEqualizerSettings(event.detail)
        : getEqualizerSettings()
      this.equalizerGains = next.gains
      this.applyEqualizerGains()
    }
    window.addEventListener('ns-pref-change', this.onPrefChange)
    window.addEventListener(EQUALIZER_EVENT, this.onEqualizerChange)
    this.bindMediaSessionActions()
    this.subscribeToStore()
  }

  private get activeDeck(): HTMLAudioElement {
    return this.decks[this.active]
  }

  private get idleIndex(): 0 | 1 {
    return (1 - this.active) as 0 | 1
  }

  private bindDeckEvents(i: 0 | 1) {
    const deck = this.decks[i]
    deck.addEventListener('timeupdate', () => this.onTimeUpdate(i))
    deck.addEventListener('ended', () => this.onEnded(i))
    deck.addEventListener('error', () => {
      if (i === this.active) usePlayerStore.getState().pause()
    })
  }

  private ensureAudioGraph() {
    if (this.audioContext) return
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    try {
      this.audioContext = new AudioContextClass()
      // Output stage shared by both decks: EQ → compressor → makeup gain → out.
      this.normalizer = this.audioContext.createDynamicsCompressor()
      this.normalizeGain = this.audioContext.createGain()
      this.normalizer.connect(this.normalizeGain)
      this.normalizeGain.connect(this.audioContext.destination)
      this.connectDeckToGraph(0)
      this.connectDeckToGraph(1)
      this.applyEqualizerGains()
      this.applyNormalize()
    } catch {
      this.audioContext = null
      this.deckSources = [null, null]
      this.deckFilters = [[], []]
      this.normalizer = null
      this.normalizeGain = null
    }
  }

  private connectDeckToGraph(index: 0 | 1) {
    if (!this.audioContext || this.deckSources[index]) return

    const source = this.audioContext.createMediaElementSource(this.decks[index])
    const filters = EQUALIZER_BANDS.map((band) => {
      const filter = this.audioContext!.createBiquadFilter()
      filter.type = band.type
      filter.frequency.value = band.frequency
      filter.Q.value = band.type === 'peaking' ? 1 : 0.707
      return filter
    })

    source.connect(filters[0])
    filters.forEach((filter, i) => {
      const next = filters[i + 1]
      if (next) filter.connect(next)
    })
    // Feed the shared normalizer stage (falls back to the raw output if, for any
    // reason, the normalizer failed to construct).
    filters[filters.length - 1].connect(this.normalizer ?? this.audioContext.destination)

    this.deckSources[index] = source
    this.deckFilters[index] = filters
  }

  private applyEqualizerGains() {
    if (!this.audioContext) return
    const now = this.audioContext.currentTime
    this.deckFilters.forEach((filters) => {
      filters.forEach((filter, i) => {
        filter.gain.setTargetAtTime(this.equalizerGains[i] ?? 0, now, 0.015)
      })
    })
  }

  /**
   * Volume normalization. We have no per-track loudness data (that would need a
   * backend ffmpeg scan), so we level perceived loudness in real time: a
   * compressor catches the peaks of loud songs while the makeup gain lifts
   * quieter ones, pulling both toward a consistent level. When off, ratio 1
   * makes the compressor a transparent pass-through with unity makeup gain.
   */
  private applyNormalize() {
    if (!this.audioContext || !this.normalizer || !this.normalizeGain) return
    const now = this.audioContext.currentTime
    const c = this.normalizer
    if (this.normalizeEnabled) {
      c.threshold.setValueAtTime(-18, now)
      c.knee.setValueAtTime(6, now)
      c.ratio.setValueAtTime(6, now)
      c.attack.setValueAtTime(0.01, now)
      c.release.setValueAtTime(0.3, now)
      this.normalizeGain.gain.setTargetAtTime(1.6, now, 0.05)
    } else {
      c.threshold.setValueAtTime(0, now)
      c.knee.setValueAtTime(0, now)
      c.ratio.setValueAtTime(1, now)
      c.attack.setValueAtTime(0.003, now)
      c.release.setValueAtTime(0.25, now)
      this.normalizeGain.gain.setTargetAtTime(1, now, 0.05)
    }
  }

  private resumeAudioGraph() {
    this.ensureAudioGraph()
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {})
    }
  }

  private onTimeUpdate(i: 0 | 1) {
    if (i !== this.active) return // ignore the outgoing deck's tail during a crossfade
    const deck = this.activeDeck
    const duration = deck.duration || 0
    usePlayerStore.getState().tick(deck.currentTime, duration)

    if (duration <= 0) return
    const remaining = duration - deck.currentTime

    // Gapless: buffer the next deterministic track ahead of time.
    if (remaining <= PRELOAD_LEAD) this.preloadNext()

    // Crossfade: advance early so the two tracks can overlap. peekNextTrack only
    // returns a track when the next one is deterministic (no shuffle/autoplay),
    // which is also the only case we can pre-buffer — so this stays in sync.
    if (this.crossfadeSec > 0 && remaining <= this.crossfadeSec && !this.crossfading) {
      if (this.peekNextTrack()) {
        this.crossfading = true
        usePlayerStore.getState().skipNext()
      }
    }
  }

  private onEnded(i: 0 | 1) {
    if (i !== this.active) return // a finished crossfade tail — already handled
    const { repeatMode, skipNext } = usePlayerStore.getState()
    if (repeatMode === 'one') {
      this.activeDeck.currentTime = 0
      this.activeDeck.play().catch(() => {})
    } else if (!this.crossfading) {
      // When crossfading the early skipNext() already advanced us; don't double-skip.
      skipNext()
    }
  }

  /** The next track only if it's deterministic (sequential, no shuffle/autoplay). */
  private peekNextTrack(): Track | null {
    const { queue, queueIndex, repeatMode, shuffleEnabled } = usePlayerStore.getState()
    if (repeatMode === 'one') return null
    if (shuffleEnabled) return null
    if (!queue.length) return null
    const nextIndex = queueIndex + 1
    if (nextIndex < queue.length) return queue[nextIndex]
    if (repeatMode === 'all') return queue[0]
    return null
  }

  private preloadNext() {
    const next = this.peekNextTrack()
    if (!next || this.preloadedId === next.id) return
    const idle = this.decks[this.idleIndex]
    if (this.fadingOut === idle) return // still draining a previous crossfade
    const src = resolvePlaybackSrc(next)
    if (this.srcs[this.idleIndex] !== src) {
      idle.src = src
      this.srcs[this.idleIndex] = src
      idle.volume = 0
      idle.load()
    }
    this.preloadedId = next.id
  }

  private cancelFade() {
    if (this.fadeRaf != null) {
      cancelAnimationFrame(this.fadeRaf)
      this.fadeRaf = null
    }
    if (this.fadingOut) {
      this.fadingOut.pause()
      this.fadingOut.currentTime = 0
      this.fadingOut = null
    }
  }

  private runCrossfade(oldDeck: HTMLAudioElement, newDeck: HTMLAudioElement, seconds: number, targetVol: () => number) {
    this.fadingOut = oldDeck
    const start = performance.now()
    const durationMs = seconds * 1000
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      const target = targetVol()
      newDeck.volume = clampVol(target * p)
      oldDeck.volume = clampVol(target * (1 - p))
      if (p < 1) {
        this.fadeRaf = requestAnimationFrame(step)
      } else {
        this.fadeRaf = null
        this.fadingOut = null
        oldDeck.pause()
        oldDeck.currentTime = 0
        newDeck.volume = target
      }
    }
    this.fadeRaf = requestAnimationFrame(step)
  }

  private switchToTrack(track: Track, isPlaying: boolean, targetVol: number, playbackRate: number) {
    if (isPlaying) this.resumeAudioGraph()
    this.cancelFade()
    const src = resolvePlaybackSrc(track)
    const oldDeck = this.activeDeck
    const newIndex = this.idleIndex
    const newDeck = this.decks[newIndex]

    // Reuse the pre-buffered deck when it already holds this src (gapless); else load.
    if (this.srcs[newIndex] !== src) {
      newDeck.src = src
      this.srcs[newIndex] = src
      newDeck.load()
    }
    newDeck.currentTime = 0
    newDeck.playbackRate = playbackRate
    this.active = newIndex
    this.preloadedId = null

    const doCrossfade = this.crossfadeSec > 0 && !oldDeck.paused && isPlaying
    if (doCrossfade) {
      newDeck.volume = 0
      newDeck.play().catch(() => usePlayerStore.getState().pause())
      this.runCrossfade(oldDeck, newDeck, this.crossfadeSec, () => {
        const { isMuted, volume } = usePlayerStore.getState()
        return isMuted ? 0 : volume
      })
    } else {
      oldDeck.pause()
      oldDeck.currentTime = 0
      newDeck.volume = targetVol
      if (isPlaying) newDeck.play().catch(() => usePlayerStore.getState().pause())
    }
    this.crossfading = false
  }

  private stopAll() {
    this.cancelFade()
    this.decks.forEach((deck, i) => {
      deck.pause()
      deck.src = ''
      this.srcs[i] = ''
    })
    this.crossfading = false
    this.preloadedId = null
  }

  private subscribeToStore() {
    let prevTrackId: string | null = null
    let prevIsPlaying = false
    let prevVolume = 0.8
    let prevIsMuted = false
    let prevSeek = 0
    let prevRate = 1

    this.unsubscribe = usePlayerStore.subscribe((state) => {
      const { currentTrack, isPlaying, volume, isMuted, currentTime, duration, playbackRate } = state
      const target = isMuted ? 0 : volume

      if (currentTrack) {
        if (currentTrack.id !== prevTrackId) {
          this.switchToTrack(currentTrack, isPlaying, target, playbackRate)
          prevTrackId = currentTrack.id
          prevIsPlaying = isPlaying
          prevSeek = 0
        } else if (Math.abs(currentTime - this.activeDeck.currentTime) > 1.5 && currentTime !== prevSeek) {
          // External seek (not from our own timeupdate tick).
          this.activeDeck.currentTime = currentTime
          prevSeek = currentTime
        }
      } else {
        if (prevTrackId !== null) this.stopAll()
        prevTrackId = null
      }

      // Play / pause for the active deck.
      if (isPlaying !== prevIsPlaying) {
        if (isPlaying) {
          this.resumeAudioGraph()
          this.activeDeck.play().catch(() => usePlayerStore.getState().pause())
        }
        else this.activeDeck.pause()
        prevIsPlaying = isPlaying
      }

      // Volume / mute — skip while a crossfade ramp owns the volume; it reads the
      // live target itself and lands on it when the ramp completes.
      if (volume !== prevVolume || isMuted !== prevIsMuted) {
        if (this.fadeRaf == null) this.activeDeck.volume = target
        prevVolume = volume
        prevIsMuted = isMuted
      }

      // Playback speed (reapplied per track in switchToTrack since load() resets it).
      if (playbackRate !== prevRate) {
        this.activeDeck.playbackRate = playbackRate
        prevRate = playbackRate
      }

      this.updateMediaSession({ currentTrack, isPlaying, currentTime, duration })
    })
  }

  private getMediaSession(): MediaSession | null {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return null
    return (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession ?? null
  }

  private bindMediaSessionActions() {
    const session = this.getMediaSession()
    if (!session) return

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // Some browsers expose Media Session but do not support every action.
      }
    }

    setHandler('play', () => usePlayerStore.getState().resume())
    setHandler('pause', () => usePlayerStore.getState().pause())
    setHandler('previoustrack', () => usePlayerStore.getState().skipPrevious())
    setHandler('nexttrack', () => usePlayerStore.getState().skipNext())
    setHandler('seekbackward', (details) => {
      const state = usePlayerStore.getState()
      state.seek(Math.max(0, state.currentTime - (details.seekOffset ?? 10)))
    })
    setHandler('seekforward', (details) => {
      const state = usePlayerStore.getState()
      const duration =
        state.duration > 0 ? state.duration : state.currentTrack?.durationMs ? state.currentTrack.durationMs / 1000 : 0
      state.seek(duration > 0 ? Math.min(duration, state.currentTime + (details.seekOffset ?? 10)) : state.currentTime)
    })
    setHandler('seekto', (details) => {
      if (details.seekTime == null) return
      usePlayerStore.getState().seek(details.seekTime)
    })
  }

  private updateMediaSession(state: {
    currentTrack: Track | null
    isPlaying: boolean
    currentTime: number
    duration: number
  }) {
    const session = this.getMediaSession()
    if (!session) return

    const { currentTrack, isPlaying, currentTime, duration } = state
    if (!currentTrack) {
      this.mediaSessionTrackId = null
      session.metadata = null
      session.playbackState = 'none'
      return
    }

    if (currentTrack.id !== this.mediaSessionTrackId && typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist.name,
        album: currentTrack.album.title,
        artwork: this.buildArtwork(currentTrack),
      })
      this.mediaSessionTrackId = currentTrack.id
    }

    session.playbackState = isPlaying ? 'playing' : 'paused'

    const displayDuration = duration > 0 ? duration : currentTrack.durationMs / 1000
    if (displayDuration > 0) {
      try {
        session.setPositionState({
          duration: displayDuration,
          playbackRate: this.activeDeck.playbackRate,
          position: Math.min(displayDuration, Math.max(0, currentTime)),
        })
      } catch {
        // Ignore invalid transient values while metadata is loading.
      }
    }
  }

  private buildArtwork(track: Track): MediaImage[] {
    if (!track.album.coverUrl) return []
    return [96, 128, 192, 256, 384, 512].map((size) => ({
      src: track.album.coverUrl,
      sizes: `${size}x${size}`,
    }))
  }

  destroy() {
    this.unsubscribe?.()
    window.removeEventListener('ns-pref-change', this.onPrefChange)
    window.removeEventListener(EQUALIZER_EVENT, this.onEqualizerChange)
    this.cancelFade()
    this.decks.forEach((deck) => {
      deck.pause()
      deck.src = ''
    })
    this.audioContext?.close().catch(() => {})
    this.normalizer = null
    this.normalizeGain = null
    const session = this.getMediaSession()
    if (session) {
      session.metadata = null
      session.playbackState = 'none'
    }
  }
}

// Singleton — instantiated once when the module is imported
export const audioEngine = new AudioEngine()
