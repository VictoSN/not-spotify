import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { useAuthStore } from '@/stores/authStore'
import { InstallPrompt } from '@/components/common/InstallPrompt'
import { AppToaster } from '@/components/ui/AppToaster'
import { ConfirmProvider } from '@/components/common/ConfirmDialog'
import { useAppZoomShortcuts } from '@/hooks/useAppZoom'
import { startNotificationLoop } from '@/services/notifications'
import { syncPushSubscriptionWithSettings } from '@/services/webPush'
import { Spinner } from '@/components/ui/Spinner'

export default function App() {
  const hydrateFromCookie = useAuthStore((s) => s.hydrateFromCookie)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  useAppZoomShortcuts()

  useEffect(() => {
    hydrateFromCookie()
  }, [hydrateFromCookie])

  useEffect(() => {
    startNotificationLoop()
  }, [])

  useEffect(() => {
    const sync = () => {
      if (useAuthStore.getState().isAuthenticated) {
        void syncPushSubscriptionWithSettings()
      }
    }
    sync()
    const unsubAuth = useAuthStore.subscribe((state, prev) => {
      if (state.isAuthenticated && state.user?.id !== prev.user?.id) sync()
      if (!state.isAuthenticated && prev.isAuthenticated) sync()
    })
    window.addEventListener('ns-pref-change', sync)
    return () => {
      unsubAuth()
      window.removeEventListener('ns-pref-change', sync)
    }
  }, [])

  // Spotify-style: suppress the browser's native right-click menu app-wide so
  // right-click is reserved for our own context menus. Still allow the native
  // menu inside editable fields (so copy/paste/spellcheck works) and wherever
  // an element opts back in with [data-native-context-menu].
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target?.closest('input, textarea, [contenteditable=""], [contenteditable="true"], [data-native-context-menu]')
      ) {
        return
      }
      e.preventDefault()
    }
    document.addEventListener('contextmenu', onContextMenu)
    return () => document.removeEventListener('contextmenu', onContextMenu)
  }, [])

  // Hold the first paint until the cookie session is resolved, so a logged-in
  // refresh never flashes the logged-out chrome (and protected routes don't bounce).
  if (isInitializing) {
    return (
      <div className="flex h-full items-center justify-center bg-base text-primary">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-secondary">Loading Not Spotify</p>
        </div>
      </div>
    )
  }

  return (
    <ConfirmProvider>
      {/* h-full (not h-screen/100vh) so the app inherits #root's 100dvh height.
          On mobile 100vh is the toolbar-hidden ("large") viewport, which makes the
          shell taller than the visible screen and pushes the persistent bottom nav
          + mini-player below the fold until you scroll. */}
      <div className="flex h-full flex-col bg-base text-primary">
        <div className="min-h-0 flex-1">
          <RouterProvider router={router} />
        </div>
      </div>
      <InstallPrompt />
      <AppToaster />
    </ConfirmProvider>
  )
}
