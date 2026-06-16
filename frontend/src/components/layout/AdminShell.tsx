import { useState, type ComponentType, type SVGProps } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  MusicalNoteIcon,
  RectangleStackIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

type AdminIcon = ComponentType<SVGProps<SVGSVGElement>>

const navItems: { to: string; label: string; description: string; icon: AdminIcon }[] = [
  { to: '/admin/dashboard', label: 'Dashboard', description: 'Overview', icon: ChartBarSquareIcon },
  { to: '/admin/artists', label: 'Artists', description: 'Profiles and ownership', icon: UserGroupIcon },
  { to: '/admin/albums', label: 'Albums', description: 'Releases and review', icon: RectangleStackIcon },
  { to: '/admin/tracks', label: 'Tracks', description: 'Audio catalog', icon: MusicalNoteIcon },
  { to: '/admin/applications', label: 'Applications', description: 'Artist requests', icon: ClipboardDocumentListIcon },
  { to: '/admin/dev', label: 'Dev Tools', description: 'Diagnostics', icon: WrenchScrewdriverIcon },
]

function activeItem(pathname: string) {
  return navItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)) ?? navItems[0]
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 px-3">
      {navItems.map(({ to, label, description, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex min-h-14 items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
              isActive
                ? 'bg-accent/15 text-accent'
                : 'text-secondary hover:bg-elevated/60 hover:text-primary',
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{label}</span>
            <span className="block truncate text-xs text-secondary">{description}</span>
          </span>
        </NavLink>
      ))}
    </nav>
  )
}

export function AdminShell() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const current = activeItem(location.pathname)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-page text-primary">
      <aside className="hidden w-72 shrink-0 border-r border-elevated/40 bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-elevated/40 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white">
            <MusicalNoteIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-primary">not-spotify</p>
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-secondary">Admin console</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <AdminNav />
        </div>

        <div className="border-t border-elevated/40 p-4">
          <div className="mb-3 min-w-0">
            <p className="truncate text-sm font-bold text-primary">{user?.name ?? 'Admin'}</p>
            <p className="truncate text-xs text-secondary">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-secondary/20 text-sm font-bold text-secondary transition-colors hover:border-primary/30 hover:text-primary"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-elevated/40 bg-surface/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-secondary transition-colors hover:bg-elevated hover:text-primary lg:hidden"
            aria-label="Open admin navigation"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-secondary">Admin</p>
            <h1 className="truncate text-lg font-black text-primary">{current.label}</h1>
          </div>

          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-secondary/20 px-3 text-sm font-bold text-secondary transition-colors hover:border-primary/30 hover:text-primary"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Back to app</span>
          </Link>
        </header>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative flex h-full w-[min(20rem,calc(100vw-3rem))] flex-col bg-surface shadow-2xl">
              <div className="flex h-16 items-center justify-between border-b border-elevated/40 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white">
                    <MusicalNoteIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-primary">not-spotify</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Admin console</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-secondary transition-colors hover:bg-elevated hover:text-primary"
                  aria-label="Close admin navigation"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                <AdminNav onNavigate={() => setMobileMenuOpen(false)} />
              </div>

              <div className="border-t border-elevated/40 p-4">
                <p className="truncate text-sm font-bold text-primary">{user?.name ?? 'Admin'}</p>
                <p className="mb-3 truncate text-xs text-secondary">{user?.email}</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-secondary/20 text-sm font-bold text-secondary transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </aside>
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
