import { usePlayerStore } from '@/stores/playerStore'

class AudioEngine {
  private audio: HTMLAudioElement
  private currentSrc = ''
  private unsubscribe: (() => void) | null = null

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'metadata'
    this.bindEvents()
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

    this.unsubscribe = usePlayerStore.subscribe((state) => {
      const { currentTrack, isPlaying, volume, isMuted, currentTime } = state

      // Track changed — load new source
      if (currentTrack && currentTrack.id !== prevTrackId) {
        const src = currentTrack.audioUrl
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

      // Play / pause
      if (isPlaying !== prevIsPlaying) {
        if (isPlaying) {
          this.audio.play().catch(() => usePlayerStore.getState().pause())
        } else {
          this.audio.pause()
        }
        prevIsPlaying = isPlaying
      }

      // Volume / mute
      if (volume !== prevVolume || isMuted !== prevIsMuted) {
        this.audio.volume = isMuted ? 0 : volume
        prevVolume = volume
        prevIsMuted = isMuted
      }
    })
  }

  destroy() {
    this.unsubscribe?.()
    this.audio.pause()
    this.audio.src = ''
  }
}

// Singleton — instantiated once when the module is imported
export const audioEngine = new AudioEngine()
