import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { MusicalNoteIcon } from '@heroicons/react/24/solid'
import { router } from '@/router'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { InstallPrompt } from '@/components/common/InstallPrompt'
import { AppToaster } from '@/components/ui/AppToaster'
import { ConfirmProvider } from '@/components/common/ConfirmDialog'
import { DesktopTitleBar } from '@/components/layout/DesktopTitleBar'
import { useAppZoomShortcuts } from '@/hooks/useAppZoom'

export default function App() {
  const hydrateFromCookie = useAuthStore((s) => s.hydrateFromCookie)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  useAppZoomShortcuts()

  useEffect(() => {
    hydrateFromCookie()
  }, [hydrateFromCookie])

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
        <DesktopTitleBar />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
          <MusicalNoteIcon className="h-12 w-12 text-accent" />
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <ConfirmProvider>
      <div className="flex h-screen flex-col bg-base text-primary">
        <DesktopTitleBar />
        <div className="min-h-0 flex-1">
          <RouterProvider router={router} />
        </div>
      </div>
      <InstallPrompt />
      <AppToaster />
    </ConfirmProvider>
  )
}
