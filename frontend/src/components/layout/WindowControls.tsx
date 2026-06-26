import { useEffect, useState } from 'react'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isTauri) return
    let unlisten: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      const sync = async () => setMaximized(await win.isMaximized())
      sync()
      const u = await win.onResized(sync)
      if (cancelled) u()
      else unlisten = u
    })()
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  if (!isTauri) return null

  const act = (fn: 'minimize' | 'toggleMaximize' | 'close') => async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow()[fn]()
  }

  return (
    <div className="ml-1 flex shrink-0 items-stretch" data-tauri-drag-region={false}>
      <button
        type="button"
        onClick={act('minimize')}
        aria-label="Minimize"
        className="flex h-8 w-11 items-center justify-center text-secondary transition-colors hover:bg-elevated/70 hover:text-primary"
      >
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        onClick={act('toggleMaximize')}
        aria-label={maximized ? 'Restore' : 'Maximize'}
        className="flex h-8 w-11 items-center justify-center text-secondary transition-colors hover:bg-elevated/70 hover:text-primary"
      >
        {maximized ? (
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="2.5" width="6" height="6" />
            <path d="M2.5 2.5V0.5H9.5V7.5H7.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={act('close')}
        aria-label="Close"
        className="flex h-8 w-11 items-center justify-center text-secondary transition-colors hover:bg-red-600 hover:text-white"
      >
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" stroke="currentColor" strokeWidth="1">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  )
}
