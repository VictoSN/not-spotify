import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { InstallPrompt } from '@/components/common/InstallPrompt'
import { AppToaster } from '@/components/ui/AppToaster'
import { ConfirmProvider } from '@/components/common/ConfirmDialog'
import { useAppZoomShortcuts } from '@/hooks/useAppZoom'
import { startNotificationLoop } from '@/services/notifications'
import { syncPushSubscriptionWithSettings } from '@/services/webPush'

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
      <div className="flex h-screen flex-col bg-base">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
          <SpotifyMark className="h-12 w-12" />
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <ConfirmProvider>
      <div className="flex h-screen flex-col bg-base text-primary">
        <div className="min-h-0 flex-1">
          <RouterProvider router={router} />
        </div>
      </div>
      <InstallPrompt />
      <AppToaster />
    </ConfirmProvider>
  )
}
