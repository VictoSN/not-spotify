import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { formatSeconds } from '@/utils/formatTime'

type DocumentPictureInPicture = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
  window?: Window | null
}

let suppressUntilVisible = false
let closingProgrammatically = false

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const previousIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 6h2v12H7zM10 12l9-6v12z" fill="currentColor" />
  </svg>
`
const nextIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 6h2v12h-2zM14 12l-9 6V6z" fill="currentColor" />
  </svg>
`
const playIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5v14l11-7z" fill="currentColor" />
  </svg>
`
const pauseIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
  </svg>
`

async function openPlayerPictureInPicture() {
  const api = window.documentPictureInPicture
  const { currentTrack } = usePlayerStore.getState()
  if (!api || !currentTrack || suppressUntilVisible) return false

  try {
    const pipWindow = await api.requestWindow({ width: 304, height: 360 })
    pipWindow.addEventListener('pagehide', () => {
      if (!closingProgrammatically) {
        suppressUntilVisible = true
      }
      closingProgrammatically = false
    })
    renderPipDocument(pipWindow)
    return true
  } catch {
    return false
  }
}

function closePlayerPictureInPicture() {
  const pipWindow = window.documentPictureInPicture?.window
  if (pipWindow && !pipWindow.closed) {
    closingProgrammatically = true
    pipWindow.close()
  }
}

function renderPipDocument(pipWindow: Window) {
  const state = usePlayerStore.getState()
  const { currentTrack, isPlaying, currentTime, duration } = state
  if (!currentTrack) return

  const displayDuration = duration > 0 ? duration : currentTrack.durationMs / 1000
  const progress = displayDuration > 0 ? Math.min(100, Math.max(0, (currentTime / displayDuration) * 100)) : 0
  const playLabel = isPlaying ? 'Pause' : 'Play'
  const currentPlayIcon = isPlaying ? pauseIcon : playIcon

  pipWindow.document.body.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      html, body { height: 100%; margin: 0; overflow: hidden; }
      body {
        background: transparent;
        color: #fff;
        font-family: Montserrat, "Helvetica Neue", Arial, sans-serif;
        user-select: none;
      }
      .player {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 100%;
        padding: 8px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 8px;
        background: #121212;
        box-shadow: 0 18px 60px rgba(0, 0, 0, .55);
      }
      .art {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        border-radius: 7px;
        background: #000;
        box-shadow: 0 12px 30px rgba(0, 0, 0, .35);
      }
      .art img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transform: scale(1.01);
      }
      .art::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.42)),
          radial-gradient(circle at center, rgba(0,0,0,.18), rgba(0,0,0,.38));
      }
      button {
        border: 0;
        border-radius: 999px;
        color: #fff;
        background: transparent;
        cursor: pointer;
        font: inherit;
      }
      button svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .art-controls {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
      }
      .side-control {
        display: grid;
        width: 32px;
        height: 32px;
        place-items: center;
        color: rgba(255,255,255,.78);
        filter: drop-shadow(0 2px 8px rgba(0,0,0,.55));
      }
      .primary-control {
        display: grid;
        width: 62px;
        height: 62px;
        place-items: center;
        background: #fff;
        color: #000;
        box-shadow: 0 10px 26px rgba(0,0,0,.42);
      }
      .primary-control svg {
        width: 28px;
        height: 28px;
      }
      .footer {
        flex: 0 0 auto;
        min-width: 0;
      }
      .meta { min-width: 0; }
      .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 18px;
        line-height: 1.15;
        font-weight: 900;
      }
      .artist {
        margin-top: 3px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #b3b3b3;
        font-size: 13px;
        font-weight: 900;
      }
      .bar-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 7px;
        color: #fff;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }
      .bar {
        height: 4px;
        flex: 1;
        overflow: hidden;
        border-radius: 999px;
        background: #4b4b4b;
      }
      .bar span {
        display: block;
        height: 100%;
        width: ${progress}%;
        border-radius: inherit;
        background: #fff;
      }
      .info-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .info-row .meta {
        flex: 1;
        min-width: 0;
      }
      .save {
        display: grid;
        width: 30px;
        height: 30px;
        flex: 0 0 auto;
        place-items: center;
        border: 2px solid rgba(255,255,255,.78);
        color: rgba(255,255,255,.86);
        font-size: 25px;
        font-weight: 300;
        line-height: 1;
      }
    </style>
    <main class="player">
      <div class="art">
        <img src="${escapeHtml(currentTrack.album.coverUrl)}" alt="" />
        <div class="art-controls">
          <button class="side-control" id="previous" aria-label="Previous">${previousIcon}</button>
          <button class="primary-control" id="toggle" aria-label="${playLabel}">${currentPlayIcon}</button>
          <button class="side-control" id="next" aria-label="Next">${nextIcon}</button>
        </div>
      </div>
      <div class="footer">
        <div class="bar-row">
          <span>${formatSeconds(currentTime)}</span>
          <div class="bar"><span></span></div>
          <span>${formatSeconds(displayDuration)}</span>
        </div>
        <div class="info-row">
          <div class="meta">
            <div class="title">${escapeHtml(currentTrack.title)}</div>
            <div class="artist">${escapeHtml(currentTrack.artist.name)}</div>
          </div>
          <button class="save" aria-label="Save">+</button>
        </div>
      </div>
    </main>
  `

  pipWindow.document.getElementById('toggle')?.addEventListener('click', () => {
    usePlayerStore.getState().togglePlayPause()
  })
  pipWindow.document.getElementById('previous')?.addEventListener('click', () => {
    usePlayerStore.getState().skipPrevious()
  })
  pipWindow.document.getElementById('next')?.addEventListener('click', () => {
    usePlayerStore.getState().skipNext()
  })
}

export function PictureInPicturePlayer() {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const stateSignature = usePlayerStore((s) =>
    s.currentTrack ? `${s.currentTrack.id}:${s.isPlaying}:${Math.round(s.currentTime)}:${Math.round(s.duration)}` : '',
  )
  const openingRef = useRef(false)

  useEffect(() => {
    if (!currentTrack || !isPlaying) {
      closePlayerPictureInPicture()
      return
    }

    const syncWithVisibility = () => {
      const isAppActive = document.visibilityState === 'visible' && document.hasFocus()

      if (isAppActive) {
        suppressUntilVisible = false
        closePlayerPictureInPicture()
        return
      }

      const pipWindow = window.documentPictureInPicture?.window
      if (openingRef.current || (pipWindow && !pipWindow.closed)) return
      openingRef.current = true
      openPlayerPictureInPicture().finally(() => {
        openingRef.current = false
      })
    }

    document.addEventListener('visibilitychange', syncWithVisibility)
    window.addEventListener('focus', syncWithVisibility)
    window.addEventListener('blur', syncWithVisibility)
    syncWithVisibility()

    return () => {
      document.removeEventListener('visibilitychange', syncWithVisibility)
      window.removeEventListener('focus', syncWithVisibility)
      window.removeEventListener('blur', syncWithVisibility)
    }
  }, [currentTrack, isPlaying])

  useEffect(() => {
    const pipWindow = window.documentPictureInPicture?.window
    if (pipWindow && !pipWindow.closed) renderPipDocument(pipWindow)
  }, [stateSignature])

  useEffect(() => closePlayerPictureInPicture, [])

  return null
}
