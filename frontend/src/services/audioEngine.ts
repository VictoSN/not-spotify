import { usePlayerStore } from '@/stores/playerStore'
import { resolvePlaybackSrc } from '@/services/offlineAudio'
import type { Track } from '@/types/track'

class AudioEngine {
  private audio: HTMLAudioElement
  private currentSrc = ''
  private unsubscribe: (() => void) | null = null
  private mediaSessionTrackId: string | null = null

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'metadata'
    this.bindEvents()
    this.bindMediaSessionActions()
    this.subscribeToStore()
  }

  private bindEvents() {
    this.audio.addEventListener('timeupdate', () => {
      usePlayerStore.getState().tick(this.audio.currentTime, this.audio.duration || 0)
    })

    this.audio.addEventListener('ended', () => {
      const { repeatMode, skipNext } = usePlayerStore.getState()
      if (repeatMode === 'one') {
        this.audio.currentTime = 0
        this.audio.play().catch(() => {})
      } else {
        skipNext()
      }
    })

    this.audio.addEventListener('error', () => {
      usePlayerStore.getState().pause()
    })
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
      let trackChanged = false

      // Track changed — load new source
      if (currentTrack) {
        if (currentTrack.id !== prevTrackId) {
          trackChanged = true
          // Plays the locally-saved copy when the track is downloaded for
          // offline (and a SW controls the page); otherwise the network URL.
          const src = resolvePlaybackSrc(currentTrack)
          if (src !== this.currentSrc) {
            this.audio.src = src
            this.currentSrc = src
            this.audio.load()
          }
          prevTrackId = currentTrack.id
        }

        // Seek requested externally (not from timeupdate)
        if (Math.abs(currentTime - this.audio.currentTime) > 1.5 && currentTime !== prevSeek) {
          this.audio.currentTime = currentTime
          prevSeek = currentTime
        }
      } else {
        if (this.currentSrc !== '') {
          this.audio.src = ''
          this.currentSrc = ''
        }
        prevTrackId = null
      }

      // Play / pause
      if (isPlaying !== prevIsPlaying) {
        if (isPlaying) {
          this.audio.play().catch(() => usePlayerStore.getState().pause())
        } else {
          this.audio.pause()
        }
        prevIsPlaying = isPlaying
      } else if (trackChanged && isPlaying) {
        this.audio.play().catch(() => usePlayerStore.getState().pause())
      }

      // Volume / mute
      if (volume !== prevVolume || isMuted !== prevIsMuted) {
        this.audio.volume = isMuted ? 0 : volume
        prevVolume = volume
        prevIsMuted = isMuted
      }

      // Playback speed — reapplied on track change since load() can reset it.
      if (playbackRate !== prevRate || trackChanged) {
        this.audio.playbackRate = playbackRate
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
          playbackRate: this.audio.playbackRate,
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
    this.audio.pause()
    this.audio.src = ''
    const session = this.getMediaSession()
    if (session) {
      session.metadata = null
      session.playbackState = 'none'
    }
  }
}

// Singleton — instantiated once when the module is imported
export const audioEngine = new AudioEngine()
