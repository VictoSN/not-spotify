import { useState } from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import {
  MusicalNoteIcon,
  UserGroupIcon,
  RectangleStackIcon,
  ArrowLeftIcon,
  ClipboardDocumentListIcon,
  WrenchScrewdriverIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'

const navItems = [
  { to: '/admin/artists',      label: 'Artists',      icon: UserGroupIcon },
  { to: '/admin/albums',       label: 'Albums',        icon: RectangleStackIcon },
  { to: '/admin/tracks',       label: 'Tracks',        icon: MusicalNoteIcon },
  { to: '/admin/applications', label: 'Applications', icon: ClipboardDocumentListIcon },
  { to: '/admin/dev',          label: 'Dev Tools',    icon: WrenchScrewdriverIcon },
]

export function AdminShell() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* ── Top nav bar ─────────────────────────────────────────── */}
      <header className="bg-surface border-b border-elevated/40 shrink-0">
        {/* Main row */}
        <div className="h-14 flex items-center px-4 sm:px-6 gap-3 sm:gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2 text-accent font-bold text-base sm:text-lg select-none shrink-0">
            <MusicalNoteIcon className="w-5 h-5" />
            <span className="hidden xs:inline">not-spotify</span>
            <span className="text-secondary font-normal text-sm ml-1">Admin</span>
          </div>

          {/* Desktop nav links — hidden below lg */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
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
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Back to app</span>
            </Link>

            <span className="hidden sm:block text-sm text-secondary truncate max-w-[120px]">{user?.name}</span>

            {/* Hamburger — visible below lg */}
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md text-secondary hover:text-primary hover:bg-elevated/50 transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen
                ? <XMarkIcon className="w-5 h-5" />
                : <Bars3Icon className="w-5 h-5" />
              }
            </button>
          </div>
        </div>

        {/* Mobile/tablet dropdown nav — shown when hamburger is open */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-elevated/30 px-4 py-3 flex flex-col gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/15 text-accent'
                      : 'text-secondary hover:text-primary hover:bg-elevated/50'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            ))}
            <div className="mt-2 pt-2 border-t border-elevated/30 flex items-center justify-between">
              <span className="text-sm text-secondary">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-secondary hover:text-primary transition-colors"
              >
                Log out
              </button>
            </div>
          </nav>
        )}

        {/* Tablet secondary nav row — visible between md and lg, always-open strip */}
        <div className="hidden md:flex lg:hidden items-center gap-1 px-4 pb-2 flex-wrap">
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
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto overflow-x-auto">
        <Outlet />
      </main>
    </div>
  )
}
