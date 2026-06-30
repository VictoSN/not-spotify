import { useCallback, useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { useAuthStore } from '@/stores/authStore'
import { InstallPrompt } from '@/components/common/InstallPrompt'
import { AppToaster } from '@/components/ui/AppToaster'
import { ConfirmProvider } from '@/components/common/ConfirmDialog'
import { useAppZoomShortcuts } from '@/hooks/useAppZoom'
import { startNotificationLoop } from '@/services/notifications'
import { syncPushSubscriptionWithSettings } from '@/services/webPush'
import { AuthSessionSync, type AuthSessionEvent } from '@/components/common/AuthSessionSync'
import { usePresenceSocket } from '@/hooks/usePresenceSocket'

export default function App() {
  const hydrateFromCookie = useAuthStore((s) => s.hydrateFromCookie)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  useAppZoomShortcuts()
  // One real-time connection per tab, including standalone subdomain pages.
  usePresenceSocket()

  const handleRemoteAuthEvent = useCallback((event: AuthSessionEvent) => {
    if (event === 'login') {
      void useAuthStore.getState().hydrateFromCookie()
      return
    }

    ;(window as { __authToken?: string }).__authToken = undefined
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false,
    })
    window.location.reload()
  }, [])

  useEffect(() => {
    hydrateFromCookie()
  }, [hydrateFromCookie])

  // Reconcile with the shared API cookie whenever a tab becomes active. This
  // is also a fallback for browsers that partition cross-site iframe storage.
  useEffect(() => {
    const reconcileSession = () => {
      if (document.visibilityState === 'hidden') return
      const auth = useAuthStore.getState()
      if (auth.isLoading) return
      if (auth.isAuthenticated) void auth.refreshToken()
      else void auth.hydrateFromCookie()
    }

    window.addEventListener('focus', reconcileSession)
    document.addEventListener('visibilitychange', reconcileSession)
    return () => {
      window.removeEventListener('focus', reconcileSession)
      document.removeEventListener('visibilitychange', reconcileSession)
    }
  }, [])

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
  if (isInitializing) return null

  return (
    <>
      <AuthSessionSync onEvent={handleRemoteAuthEvent} />
      <ConfirmProvider>
        <div className="flex h-screen flex-col bg-base text-primary">
          <div className="min-h-0 flex-1">
            <RouterProvider router={router} />
          </div>
        </div>
        <InstallPrompt />
        <AppToaster />
      </ConfirmProvider>
    </>
  )
}
