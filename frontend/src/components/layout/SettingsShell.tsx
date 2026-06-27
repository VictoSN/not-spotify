import { Outlet, Link } from 'react-router-dom'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { useAuthStore } from '@/stores/authStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { Avatar } from '@/components/ui/Avatar'
import { MobileNav } from './MobileNav'
import { BottomPlayerBar } from './BottomPlayerBar'
import { MobileNowPlayingSheet } from '@/components/player/MobileNowPlayingSheet'

/**
 * Chrome-less shell for account/settings pages — mirrors Spotify's account
 * subdomain (no library sidebar, no player), just a slim top bar + the page.
 */
export function SettingsShell() {
  const { user } = useAuthStore()
  const isMobile = useIsMobile()

  return (
    <div className="flex h-full flex-col bg-page text-primary">
      {/* Black top header matching Spotify account page */}
      <header className="sticky top-0 z-20 h-16 shrink-0 bg-base">
        <div className="mx-auto flex h-full max-w-[960px] items-center px-6">
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Home">
            <SpotifyMark className="h-8 w-8 text-primary" />
            <span className="hidden text-[18px] font-black tracking-tight text-primary sm:block">Spotify</span>
          </Link>

          {/* Nav links */}
          <nav className="ml-10 hidden items-center gap-7 md:flex">
            <Link
              to="/premium"
              className="text-[13px] font-semibold text-secondary transition-colors hover:text-primary"
            >
              Premium plans
            </Link>
            <span className="text-[13px] font-semibold text-secondary cursor-default">Support</span>
            <span className="text-[13px] font-semibold text-secondary cursor-default">Download</span>
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-0">
            {/* Vertical divider */}
            <div className="mr-5 h-5 w-px bg-secondary/30 hidden sm:block" />

            {/* Profile */}
            <button
              type="button"
              className="flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors hover:bg-elevated"
            >
              <Avatar src={user?.avatarUrl} alt={user?.name ?? 'User'} size="sm" round />
              <span className="hidden text-[13px] font-semibold text-primary sm:block">
                {user?.name ?? 'Profile'}
              </span>
              <ChevronDownIcon className="hidden h-3.5 w-3.5 text-primary sm:block" />
            </button>
          </div>
        </div>
      </header>

      <main className="spotify-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[780px] px-4 py-8">
          <Outlet />
        </div>
      </main>

      {isMobile && <BottomPlayerBar />}
      {isMobile && <MobileNav />}
      {isMobile && <MobileNowPlayingSheet />}
    </div>
  )
}
