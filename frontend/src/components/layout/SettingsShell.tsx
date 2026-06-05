import { Outlet, Link, useNavigate } from 'react-router-dom'
import {
  MusicalNoteIcon,
  ArrowLeftIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { Avatar } from '@/components/ui/Avatar'

/**
 * Chrome-less shell for account/settings pages — mirrors Spotify's account
 * subdomain (no library sidebar, no player), just a slim top bar + the page.
 */
export function SettingsShell() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-page text-primary">
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-6 border-b border-elevated/40 bg-base/95 px-4 backdrop-blur sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="not-spotify home">
          <MusicalNoteIcon className="h-7 w-7 text-accent" />
          <span className="hidden text-lg font-bold text-primary sm:block">not-spotify</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-bold text-secondary md:flex">
          <Link to="/premium" className="transition-colors hover:text-primary">Premium</Link>
          <span className="cursor-default">Support</span>
          <span className="cursor-default">Download</span>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-secondary transition-all hover:scale-105 hover:bg-elevated/70 hover:text-primary"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>

          <Link
            to="/"
            className="hidden items-center gap-1.5 text-sm font-semibold text-secondary transition-colors hover:text-primary sm:flex"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to app
          </Link>

          <div className="flex items-center gap-2">
            <Avatar src={user?.avatarUrl} alt={user?.name ?? 'User'} size="sm" round />
            <button
              onClick={handleLogout}
              className="text-sm font-semibold text-secondary transition-colors hover:text-primary"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
