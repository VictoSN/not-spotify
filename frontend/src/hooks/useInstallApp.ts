import { useState, useEffect, useCallback } from 'react'

/**
 * The `beforeinstallprompt` event (Chromium only) isn't in the DOM lib types.
 * Capturing it lets us trigger the PWA install flow from our own UI instead of
 * relying on the browser's address-bar affordance.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Module-level so the captured prompt survives component remounts — the event
// fires once on load, well before the TopBar may have rendered.
let deferredPrompt: BeforeInstallPromptEvent | null = null

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // `display-mode: standalone` covers installed PWAs and the Tauri shell;
  // `navigator.standalone` is the iOS Safari equivalent.
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Drives the "Install app" affordance. `canPrompt` is true when Chromium has
 * offered a native install prompt; `promptInstall` triggers it and resolves to
 * whether a prompt was actually shown (false on browsers that don't support it,
 * e.g. Firefox / Safari — callers fall back to manual instructions).
 */
export function useInstallApp() {
  const [canPrompt, setCanPrompt] = useState(deferredPrompt !== null)
  const [isStandalone, setIsStandalone] = useState(detectStandalone)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault() // stop Chromium's default mini-infobar
      deferredPrompt = e as BeforeInstallPromptEvent
      setCanPrompt(true)
    }
    const onInstalled = () => {
      deferredPrompt = null
      setCanPrompt(false)
      setIsStandalone(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    // A prompt can only be used once; drop it so the button reflects reality.
    deferredPrompt = null
    setCanPrompt(false)
    return true
  }, [])

  return { canPrompt, isStandalone, promptInstall }
}
