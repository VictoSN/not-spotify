import { useEffect, useState, type ReactNode } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  MinusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { cn } from '@/utils/cn'

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function DesktopTitleBar() {
  const [isDesktop, setIsDesktop] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isTauriRuntime()) return
    setIsDesktop(true)
    const current = getCurrentWindow()
    current.isMaximized().then(setIsMaximized).catch(() => setIsMaximized(false))
    const unlisten = current.onResized(() => {
      current.isMaximized().then(setIsMaximized).catch(() => setIsMaximized(false))
    })
    return () => {
      void unlisten.then((dispose) => dispose())
    }
  }, [])

  if (!isDesktop) return null

  const current = getCurrentWindow()
  const startDrag = () => current.startDragging().catch(() => {})
  const minimize = () => current.minimize().catch(() => {})
  const toggleMaximize = async () => {
    try {
      await current.toggleMaximize()
      setIsMaximized(await current.isMaximized())
    } catch {
      /* ignore native window errors */
    }
  }
  const close = () => current.close().catch(() => {})

  return (
    <div
      className="desktop-titlebar flex h-9 shrink-0 items-center border-b border-elevated/50 bg-base text-primary select-none"
      onMouseDown={(event) => {
        if (event.button !== 0) return
        if (event.detail === 2) void toggleMaximize()
        else void startDrag()
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <SpotifyMark className="h-4 w-4 shrink-0" />
        <span className="truncate text-xs font-bold tracking-wide text-secondary">NotSpotify</span>
      </div>
      <WindowButton label="Minimize" onClick={minimize}>
        <MinusIcon className="h-4 w-4" />
      </WindowButton>
      <WindowButton label={isMaximized ? 'Restore' : 'Maximize'} onClick={() => void toggleMaximize()}>
        {isMaximized ? <ArrowsPointingInIcon className="h-4 w-4" /> : <ArrowsPointingOutIcon className="h-4 w-4" />}
      </WindowButton>
      <WindowButton label="Close" onClick={close} danger>
        <XMarkIcon className="h-4 w-4" />
      </WindowButton>
    </div>
  )
}

function WindowButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex h-9 w-11 items-center justify-center text-secondary transition-colors hover:bg-elevated hover:text-primary',
        danger && 'hover:bg-red-600 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}
