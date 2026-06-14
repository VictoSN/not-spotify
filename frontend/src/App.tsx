import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { MusicalNoteIcon } from '@heroicons/react/24/solid'
import { router } from '@/router'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { InstallPrompt } from '@/components/common/InstallPrompt'

export default function App() {
  const hydrateFromCookie = useAuthStore((s) => s.hydrateFromCookie)
  const isInitializing = useAuthStore((s) => s.isInitializing)

  useEffect(() => {
    hydrateFromCookie()
  }, [hydrateFromCookie])

  // Hold the first paint until the cookie session is resolved, so a logged-in
  // refresh never flashes the logged-out chrome (and protected routes don't bounce).
  if (isInitializing) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-base">
        <MusicalNoteIcon className="h-12 w-12 text-accent" />
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <InstallPrompt />
    </>
  )
}
