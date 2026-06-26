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
    <div className="flex min-h-screen flex-col bg-[#121212] text-white">
      {/* Black top header matching Spotify account page */}
      <header className="sticky top-0 z-20 h-16 shrink-0 bg-black">
        <div className="mx-auto flex h-full max-w-[960px] items-center px-6">
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Home">
            <SpotifyMark className="h-8 w-8 text-white" />
            <span className="hidden text-[18px] font-black tracking-tight text-white sm:block">Spotify</span>
          </Link>

          {/* Nav links */}
          <nav className="ml-10 hidden items-center gap-7 md:flex">
            <Link
              to="/premium"
              className="text-[13px] font-semibold text-[#b3b3b3] transition-colors hover:text-white"
            >
              Premium plans
            </Link>
            <span className="text-[13px] font-semibold text-[#b3b3b3] cursor-default">Support</span>
            <span className="text-[13px] font-semibold text-[#b3b3b3] cursor-default">Download</span>
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-0">
            {/* Vertical divider */}
            <div className="mr-5 h-5 w-px bg-[#3a3a3a] hidden sm:block" />

            {/* Profile */}
            <button
              type="button"
              className="flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors hover:bg-white/10"
            >
              <Avatar src={user?.avatarUrl} alt={user?.name ?? 'User'} size="sm" round />
              <span className="hidden text-[13px] font-semibold text-white sm:block">
                {user?.name ?? 'Profile'}
              </span>
              <ChevronDownIcon className="hidden h-3.5 w-3.5 text-white sm:block" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
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
