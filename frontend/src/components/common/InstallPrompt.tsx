import { useEffect, useState } from 'react'
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline'

// The browser's beforeinstallprompt event (not in the TS DOM lib by default).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'ns-install-dismissed'

/**
 * A small, dismissible "Install app" banner shown only when the browser reports
 * the app is installable (Chromium fires `beforeinstallprompt`). Renders nothing
 * on browsers that don't support it (Safari/Firefox) or once already installed.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault() // stop Chrome's mini-infobar; we show our own UI
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => {
      setVisible(false)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore storage errors
    }
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => null)
    setVisible(false)
    setDeferred(null)
  }

  if (!visible || !deferred) return null

  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border border-primary/10 bg-elevated p-4 shadow-2xl sm:bottom-28">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <ArrowDownTrayIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">Install not-spotify</p>
          <p className="mt-0.5 text-xs text-secondary">
            Add it to your device for a full-screen, app-like experience.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-black transition hover:scale-[1.03]"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-secondary transition hover:text-primary"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 text-muted transition hover:text-primary"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
