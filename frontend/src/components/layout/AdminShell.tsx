import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { MusicalNoteIcon, UserGroupIcon, RectangleStackIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'

const navItems = [
  { to: '/admin/artists', label: 'Artists', icon: UserGroupIcon },
  { to: '/admin/albums',  label: 'Albums',  icon: RectangleStackIcon },
  { to: '/admin/tracks',  label: 'Tracks',  icon: MusicalNoteIcon },
]

export function AdminShell() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Top nav bar */}
      <header className="h-14 bg-surface border-b border-elevated/40 flex items-center px-6 gap-6 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2 text-accent font-bold text-lg select-none">
          <MusicalNoteIcon className="w-5 h-5" />
          <span>not-spotify</span>
          <span className="text-secondary font-normal text-sm ml-1">Admin</span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-secondary hover:text-primary hover:bg-elevated/50'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to app
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-sm text-secondary">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-secondary hover:text-primary transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
