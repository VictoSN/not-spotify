import { useEffect, useRef, useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { ChevronDownIcon, UserCircleIcon, Cog6ToothIcon, ChartBarSquareIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { useAuthStore } from '@/stores/authStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { Avatar } from '@/components/ui/Avatar'
import { MobileNav } from './MobileNav'
import { BottomPlayerBar } from './BottomPlayerBar'
import { MobileNowPlayingSheet } from '@/components/player/MobileNowPlayingSheet'

export function SettingsShell() {
  const { user, logout } = useAuthStore()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Context-aware menu (bug 14): hide the link to the page we're already on so
  // the alternative view (Account <-> Artist Dashboard) is surfaced instead.
  const isArtist = user?.roles?.includes('Artist') ?? false
  const onAccountPage = location.pathname === '/account'
  const onArtistDashboard = location.pathname === '/artist-dashboard'
  const fullWidth = onArtistDashboard

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/')
  }

  return (
    <div className="dark-theme-scope flex h-full flex-col bg-page text-primary">
      {/* Black top header matching Spotify account page */}
      <header className="sticky top-0 z-20 h-16 shrink-0 border-b border-primary/10 bg-base">
        <div className={`flex h-full items-center px-6 ${fullWidth ? '' : 'mx-auto max-w-[960px]'}`}>
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Not Spotify home">
            <SpotifyMark className="h-8 w-8 text-primary" />
            <span className="hidden text-[18px] font-black tracking-tight text-primary sm:block">Not Spotify</span>
          </Link>

          {/* Nav links */}
          <nav className="ml-10 hidden items-center gap-7 md:flex">
            <Link
              to="/premium"
              className="text-[13px] font-semibold text-secondary transition-colors hover:text-primary"
            >
              Premium plans
            </Link>
            <Link
              to="/support"
              className="text-[13px] font-semibold text-secondary transition-colors hover:text-primary"
            >
              Support
            </Link>
            <Link
              to="/download/windows"
              className="text-[13px] font-semibold text-secondary transition-colors hover:text-primary"
            >
              Download
            </Link>
          </nav>

          {/* Right side */}
          <div className="relative ml-auto flex items-center gap-0" ref={menuRef}>
            {/* Vertical divider */}
            <div className="mr-5 hidden h-5 w-px bg-primary/15 sm:block" />

            {/* Profile */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors hover:bg-primary/10"
            >
              <Avatar src={user?.avatarUrl} alt={user?.name ?? 'User'} size="sm" round />
              <span className="hidden text-[13px] font-semibold text-primary sm:block">
                {user?.name ?? 'Profile'}
              </span>
              <ChevronDownIcon className={`hidden h-3.5 w-3.5 text-primary transition-transform duration-150 sm:block ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 overflow-hidden rounded-lg bg-elevated py-1 shadow-lg ring-1 ring-primary/10">
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <UserCircleIcon className="h-4 w-4 shrink-0 text-secondary" />
                  Profile
                </Link>
                {!onAccountPage && (
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <Cog6ToothIcon className="h-4 w-4 shrink-0 text-secondary" />
                    Account
                  </Link>
                )}
                {isArtist && !onArtistDashboard && (
                  <Link
                    to="/artist-dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <ChartBarSquareIcon className="h-4 w-4 shrink-0 text-secondary" />
                    Artist Dashboard
                  </Link>
                )}
                <div className="my-1 border-t border-primary/10" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0 text-secondary" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="spotify-scrollbar min-h-0 flex-1 overflow-y-auto">
        {location.pathname === '/artist-dashboard' ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-[780px] px-4 py-8">
            <Outlet />
          </div>
        )}
      </main>

      {isMobile && fullWidth && <BottomPlayerBar />}
      {isMobile && fullWidth && <MobileNav />}
      {isMobile && fullWidth && <MobileNowPlayingSheet />}
    </div>
  )
}
