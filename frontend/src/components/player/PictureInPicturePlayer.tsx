import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

// Module-level ref so BottomPlayerBar can trigger PiP without prop drilling.
let _videoEl: HTMLVideoElement | null = null

async function playPipVideo(video: HTMLVideoElement) {
  if (!video.paused) return
  await video.play()
}

function setAutoPip(video: HTMLVideoElement, enabled: boolean) {
  if (enabled) video.setAttribute('autopictureinpicture', '')
  else video.removeAttribute('autopictureinpicture')
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
  const autoPipSuppressedRef = useRef(false)

  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)

  // Create the hidden canvas + video element once on mount
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = CW
    canvas.height = CH
    canvasRef.current = canvas

    const video = document.createElement('video')
    video.muted = true
    video.autoplay = true
    // autoPictureInPicture: browser automatically enters PiP on tab-hide and
    // exits on tab-show — fixes both the "persists after close" and return-button bugs.
    setAutoPip(video, true)
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

    const onEnterPip = () => {
      autoPipSuppressedRef.current = false
    }

    const onLeavePip = () => {
      if (document.visibilityState === 'hidden') {
        autoPipSuppressedRef.current = true
        setAutoPip(video, false)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        autoPipSuppressedRef.current = false
        setAutoPip(video, true)
        if (document.pictureInPictureElement === video) {
          document.exitPictureInPicture().catch(() => {})
        }
        return
      }

      const { currentTrack, isPlaying } = usePlayerStore.getState()
      if (!autoPipSuppressedRef.current && currentTrack && isPlaying) {
        setAutoPip(video, true)
        enterPip()
      }
    }

    const onVideoPlay = () => {
      const state = usePlayerStore.getState()
      if (state.currentTrack && !state.isPlaying) state.resume()
    }

    const onVideoPause = () => {
      if (document.pictureInPictureElement !== video || document.visibilityState === 'visible') return
      const state = usePlayerStore.getState()
      if (state.isPlaying) state.pause()
    }

    video.addEventListener('enterpictureinpicture', onEnterPip)
    video.addEventListener('leavepictureinpicture', onLeavePip)
    video.addEventListener('play', onVideoPlay)
    video.addEventListener('pause', onVideoPause)
    document.addEventListener('visibilitychange', onVisibilityChange)
    video.play().catch(() => {/* autoplay blocked — PiP won't work but app still plays audio */})

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      video.removeEventListener('enterpictureinpicture', onEnterPip)
      video.removeEventListener('leavepictureinpicture', onLeavePip)
      video.removeEventListener('play', onVideoPlay)
      video.removeEventListener('pause', onVideoPause)
      document.removeEventListener('visibilitychange', onVisibilityChange)
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

  // mediaSession metadata — populates the native PiP title / artwork / OS widget
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!currentTrack) {
      navigator.mediaSession.metadata = null
      return
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist.name,
      album: currentTrack.album.title,
      artwork: [{ src: currentTrack.album.coverUrl, sizes: '512x512', type: 'image/jpeg' }],
    })
    const store = usePlayerStore.getState
    navigator.mediaSession.setActionHandler('play', () => store().resume())
    navigator.mediaSession.setActionHandler('pause', () => store().pause())
    navigator.mediaSession.setActionHandler('nexttrack', () => store().skipNext())
    navigator.mediaSession.setActionHandler('previoustrack', () => store().skipPrevious())

    return () => {
      ;(['play', 'pause', 'nexttrack', 'previoustrack'] as const).forEach((a) =>
        navigator.mediaSession.setActionHandler(a, null),
      )
    }
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
