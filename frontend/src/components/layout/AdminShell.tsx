import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChartBarSquareIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  MegaphoneIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  QueueListIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  VideoCameraIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Avatar } from '@/components/ui/Avatar'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

type AdminNavItem = {
  to: string
  label: string
  description: string
  icon: IconType
}

const navSections: { label: string; items: AdminNavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      {
        to: '/admin/dashboard',
        label: 'Dashboard',
        description: 'Traffic, plays, and moderation load',
        icon: ChartBarSquareIcon,
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/artists', label: 'Artists', description: 'Profiles and publishing status', icon: UserGroupIcon },
      { to: '/admin/albums', label: 'Albums', description: 'Releases and metadata', icon: RectangleStackIcon },
      { to: '/admin/tracks', label: 'Tracks', description: 'Audio, reviews, and stats', icon: MusicalNoteIcon },
      { to: '/admin/videos', label: 'Music Videos', description: 'Review and moderate uploads', icon: VideoCameraIcon },
      { to: '/admin/podcasts', label: 'Podcasts', description: 'Shows, episodes, and reviews', icon: MicrophoneIcon },
      { to: '/admin/playlists', label: 'Playlists', description: 'Featured flags and curation', icon: QueueListIcon },
    ],
  },
  {
    label: 'Monetization',
    items: [
      { to: '/admin/billing/plans', label: 'Billing plans', description: 'Stripe products and prices', icon: CreditCardIcon },
      { to: '/admin/ads', label: 'Advertisements', description: 'House ads for the free tier', icon: MegaphoneIcon },
    ],
  },
  {
    label: 'Review',
    items: [
      {
        to: '/admin/applications',
        label: 'Applications',
        description: 'Artist access requests',
        icon: ClipboardDocumentListIcon,
      },
    ],
  },
  {
    label: 'Governance',
    items: [
      { to: '/admin/team', label: 'Team & roles', description: 'Grant or revoke admin access', icon: ShieldCheckIcon },
      { to: '/admin/approvals', label: 'Approvals', description: 'Privileged-action requests', icon: ClipboardDocumentListIcon },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/dev', label: 'Dev Tools', description: 'Seed and diagnostics tools', icon: WrenchScrewdriverIcon },
    ],
  },
]

const navItems = navSections.flatMap((section) => section.items)

function getCurrentItem(pathname: string) {
  return (
    [...navItems]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)) ?? navItems[0]
  )
}

export function AdminShell() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentItem = useMemo(() => getCurrentItem(location.pathname), [location.pathname])
  const CurrentIcon = currentItem.icon

  useEffect(() => {
    if (!mobileMenuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileMenuOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex h-full overflow-hidden bg-base text-primary">
      <AdminSidebar />

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/65"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close admin navigation"
          />
          <div className="relative flex h-full w-[min(21rem,calc(100vw-2rem))] flex-col bg-sidebar shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-elevated/45 px-4">
              <AdminBrand />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-md text-secondary transition-colors hover:bg-elevated hover:text-primary"
                aria-label="Close admin navigation"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <AdminNav onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-elevated/40 bg-base/95 px-3 backdrop-blur-xl sm:px-5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-secondary transition-colors hover:bg-elevated hover:text-primary lg:hidden"
            aria-label="Open admin navigation"
            aria-expanded={mobileMenuOpen}
          >
            <Bars3Icon className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent sm:flex">
              <CurrentIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                <span>Admin</span>
                <ChevronRightIcon className="h-3.5 w-3.5" />
                <span className="truncate">{currentItem.label}</span>
              </div>
              <h1 className="truncate text-lg font-bold text-primary sm:text-xl">{currentItem.label}</h1>
            </div>
          </div>

          <Link
            to="/"
            className="flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-secondary transition-colors hover:bg-elevated hover:text-primary"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Back to app</span>
          </Link>

          <div className="hidden items-center gap-2 rounded-md border border-elevated/50 bg-surface px-2.5 py-1.5 md:flex">
            <Avatar src={user?.avatarUrl} alt={user?.name ?? 'Admin'} size="sm" round />
            <div className="min-w-0">
              <p className="max-w-36 truncate text-sm font-bold text-primary">{user?.name ?? 'Admin'}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Administrator</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-secondary transition-colors hover:bg-elevated hover:text-primary"
            aria-label="Log out of admin"
            title="Log out"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </header>

        <main className="spotify-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AdminSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-elevated/40 bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-elevated/40 px-5">
        <AdminBrand />
      </div>
      <AdminNav />
    </aside>
  )
}

function AdminBrand() {
  return (
    <Link to="/admin/dashboard" className="flex min-w-0 items-center gap-2" aria-label="Admin dashboard">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/15">
        <SpotifyMark className="h-5 w-5" />
      </span>
      <span className="block text-xs font-bold uppercase tracking-[0.16em] text-accent">Admin</span>
    </Link>
  )
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="spotify-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
      {navSections.map((section) => (
        <div key={section.label} className="mb-5 last:mb-0">
          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{section.label}</p>
          <div className="space-y-1">
            {section.items.map((item) => (
              <AdminNavLink key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function AdminNavLink({ item, onNavigate }: { item: AdminNavItem; onNavigate?: () => void }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex min-h-14 items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
          isActive ? 'bg-accent/15 text-primary' : 'text-secondary hover:bg-elevated/70 hover:text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
              isActive ? 'bg-accent text-black' : 'bg-elevated text-secondary group-hover:text-primary',
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-sm font-bold', isActive ? 'text-primary' : 'text-inherit')}>
              {item.label}
            </span>
            <span className="block truncate text-xs font-medium text-muted">{item.description}</span>
          </span>
        </>
      )}
    </NavLink>
  )
}

