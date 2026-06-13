import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

// Module-level ref so BottomPlayerBar can trigger PiP without prop drilling.
let _videoEl: HTMLVideoElement | null = null

async function playPipVideo(video: HTMLVideoElement) {
  if (!video.paused) return
  await video.play()
}

export async function enterPip() {
  const video = _videoEl
  if (!video || !document.pictureInPictureEnabled) return

  try {
    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture()
      return
    }

    await playPipVideo(video)
    await video.requestPictureInPicture()
  } catch {
    // Keep app playback unaffected if the browser denies PiP.
  }
}

// Canvas size for the PiP overlay artwork
const CW = 512
const CH = 512

// Draw current state onto the canvas — called at ~4 fps while playing
function drawFrame(
  ctx: CanvasRenderingContext2D,
  cover: HTMLImageElement | null,
) {
  const { currentTrack, currentTime, duration } = usePlayerStore.getState()
  if (!currentTrack) return

  const displayDuration = duration > 0 ? duration : currentTrack.durationMs / 1000

  // Background
  ctx.fillStyle = '#121212'
  ctx.fillRect(0, 0, CW, CH)

  // Album art + gradient scrim
  if (cover?.complete && cover.naturalWidth > 0) {
    ctx.drawImage(cover, 0, 0, CW, CH)
    const scrim = ctx.createLinearGradient(0, CH * 0.45, 0, CH)
    scrim.addColorStop(0, 'rgba(0,0,0,0)')
    scrim.addColorStop(1, 'rgba(0,0,0,0.88)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, CW, CH)
  }

  // Title
  ctx.font = 'bold 28px "Helvetica Neue",Arial,sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'alphabetic'
  const titleY = CH - 76
  ctx.fillText(clampText(ctx, currentTrack.title, CW - 40), 20, titleY)

  // Artist
  ctx.font = '500 20px "Helvetica Neue",Arial,sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.fillText(clampText(ctx, currentTrack.artist.name, CW - 40), 20, titleY + 30)

  // Progress bar track
  const barY = CH - 22
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  roundRect(ctx, 20, barY, CW - 40, 4, 2)
  ctx.fill()

  // Progress bar fill
  if (displayDuration > 0) {
    const pct = Math.min(1, currentTime / displayDuration)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    roundRect(ctx, 20, barY, (CW - 40) * pct, 4, 2)
    ctx.fill()
  }
}

function clampText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo) + '…'
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  if (w <= 0) return
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
  } else {
    ctx.rect(x, y, w, h)
  }
}

export function PictureInPicturePlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const coverRef = useRef<HTMLImageElement | null>(null)
  const coverUrlRef = useRef('')
  const rafRef = useRef<number | null>(null)

  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const isMuted = usePlayerStore((s) => s.isMuted)

  // Create the hidden canvas + video element once on mount
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = CW
    canvas.height = CH
    canvasRef.current = canvas

    const video = document.createElement('video')
    // Reflect the app's mute state so the PiP window's mute icon is honest.
    video.muted = usePlayerStore.getState().isMuted
    video.autoplay = true
    video.playsInline = true
    Object.assign(video.style, {
      position: 'fixed', top: '0', left: '0',
      width: '1px', height: '1px',
      opacity: '0.001', pointerEvents: 'none',
      zIndex: '-1',
    })
    document.body.appendChild(video)
    videoRef.current = video
    _videoEl = video

    const stream = canvas.captureStream(4)
    video.srcObject = stream

    // Mirror the PiP window's play / pause / mute buttons to the real audio,
    // but ONLY while actually in PiP. The hidden canvas-stream video fires
    // spurious 'play' events (the live MediaStream keeps feeding frames even
    // after we pause it — e.g. on navigation); without this guard those events
    // would wrongly resume a track the user paused.
    const inPip = () => document.pictureInPictureElement === video

    const onVideoPlay = () => {
      if (!inPip()) return
      const s = usePlayerStore.getState()
      if (s.currentTrack && !s.isPlaying) s.resume()
    }
    const onVideoPause = () => {
      if (!inPip()) return
      const s = usePlayerStore.getState()
      if (s.isPlaying) s.pause()
    }
    const onVolumeChange = () => {
      if (!inPip()) return
      const s = usePlayerStore.getState()
      if (video.muted !== s.isMuted) s.toggleMute()
    }

    video.addEventListener('play', onVideoPlay)
    video.addEventListener('pause', onVideoPause)
    video.addEventListener('volumechange', onVolumeChange)
    video.play().catch(() => {/* autoplay blocked — PiP won't work but app still plays audio */})

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      video.removeEventListener('play', onVideoPlay)
      video.removeEventListener('pause', onVideoPause)
      video.removeEventListener('volumechange', onVolumeChange)
      if (document.pictureInPictureElement === video) {
        document.exitPictureInPicture().catch(() => {})
      }
      video.remove()
      _videoEl = null
    }
  }, [])

  // Render loop — draw canvas frames while a track is loaded
  useEffect(() => {
    if (!currentTrack) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let active = true
    const loop = () => {
      if (!active) return
      drawFrame(ctx, coverRef.current)
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      active = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [currentTrack, isPlaying, currentTime, duration])

  // Reload cover image when the track changes
  useEffect(() => {
    if (!currentTrack || coverUrlRef.current === currentTrack.album.coverUrl) return
    coverUrlRef.current = currentTrack.album.coverUrl
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { coverRef.current = img }
    img.onerror = () => { coverRef.current = null }
    img.src = currentTrack.album.coverUrl
  }, [currentTrack])

  // Keep the hidden PiP video in step with the real audio player so native
  // PiP controls do not become detached from the app state.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentTrack) return
    if (isPlaying && video.paused) {
      playPipVideo(video).catch(() => {})
    } else if (!isPlaying && !video.paused) {
      video.pause()
    }
  }, [currentTrack, isPlaying])

  // Reflect app mute state on the PiP video so its mute icon stays honest.
  useEffect(() => {
    const video = videoRef.current
    if (video && video.muted !== isMuted) video.muted = isMuted
  }, [isMuted])

  // mediaSession metadata — populates the native PiP title / artwork / OS widget.
  // NOTE: the action handlers (play/pause/next/prev/seek) are owned solely by
  // audioEngine, which registers them once at startup and never nulls them.
  // Registering them here too (and nulling on every track change) left Edge's
  // PiP next/prev/seek buttons wired to momentarily-null handlers — so only
  // play/pause appeared to work. Keep this effect to metadata only.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = currentTrack
      ? new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist.name,
          album: currentTrack.album.title,
          artwork: [{ src: currentTrack.album.coverUrl, sizes: '512x512', type: 'image/jpeg' }],
        })
      : null
  }, [currentTrack])

  // mediaSession playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  // mediaSession position state
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return
    const displayDuration = duration > 0 ? duration : currentTrack.durationMs / 1000
    try {
      navigator.mediaSession.setPositionState({
        duration: displayDuration,
        playbackRate: 1,
        position: Math.min(currentTime, displayDuration),
      })
    } catch { /* setPositionState throws if duration is 0 */ }
  }, [currentTime, duration, currentTrack])

  // Exit PiP when playback stops entirely (logout / track cleared)
  useEffect(() => {
    const video = videoRef.current
    if (!currentTrack && video && document.pictureInPictureElement === video) {
      document.exitPictureInPicture().catch(() => {})
    }
  }, [currentTrack])

  return null
}
