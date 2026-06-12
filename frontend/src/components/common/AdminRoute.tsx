import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui/Spinner'

export function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-page">
        <Spinner size="lg" />
      </div>
    )
  }

  // Admin area has its own sign-in; remember where they were headed so
  // AdminLoginPage can return them there after authenticating.
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  // Signed-in members without the Admin role never reach admin routes.
  const isAdmin = user?.roles?.includes('Admin') ?? false
  if (!isAdmin) return <Navigate to="/" replace />

  return <Outlet />
}
