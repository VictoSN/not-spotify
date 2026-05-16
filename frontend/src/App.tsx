import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { useAuthStore } from '@/stores/authStore'

export default function App() {
  const hydrateFromCookie = useAuthStore((s) => s.hydrateFromCookie)

  useEffect(() => {
    hydrateFromCookie()
  }, [hydrateFromCookie])

  return <RouterProvider router={router} />
}
