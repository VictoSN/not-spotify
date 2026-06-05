import { useState } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  HomeIcon,
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  MusicalNoteIcon,
  UserIcon,
  UserCircleIcon,
  QuestionMarkCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { HomeIcon as HomeSolid } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { Avatar } from '@/components/ui/Avatar'

export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [showMenu, setShowMenu] = useState(false)

  const isHome = location.pathname === '/'
  const currentQuery = searchParams.get('q') ?? ''
  const isAdmin = user?.roles?.includes('Admin') ?? false

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
    else navigate('/search')
  }

  if (!isAuthenticated) {
    return (
      <header className="grid h-16 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-4 bg-base px-4">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="not-spotify home">
          <MusicalNoteIcon className="w-8 h-8 text-accent" />
          <span className="hidden md:block font-bold text-lg text-primary">not-spotify</span>
        </Link>

        <div className="flex min-w-0 items-center justify-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-elevated transition-all hover:scale-105 hover:bg-elevated/70"
            aria-label="Home"
            aria-current={isHome ? 'page' : undefined}
          >
            {isHome ? <HomeSolid className="h-6 w-6 text-primary" /> : <HomeIcon className="h-6 w-6 text-secondary" />}
          </button>

          <div className="relative w-full max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
            <input
              type="search"
              placeholder="What do you want to play?"
              defaultValue={currentQuery}
              onChange={handleSearch}
              onFocus={() => {
                if (!location.pathname.startsWith('/search')) navigate('/search')
              }}
              className="h-12 w-full rounded-full border border-transparent bg-elevated pl-10 pr-4 text-sm text-primary transition-colors placeholder:text-muted hover:border-secondary/30 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="hidden items-center gap-5 text-sm font-bold text-secondary lg:flex">
          <button className="transition-colors hover:text-primary">Premium</button>
          <button className="transition-colors hover:text-primary">Support</button>
          <button className="transition-colors hover:text-primary">Download</button>
          <div className="h-6 w-px bg-secondary/40" />
          <button className="transition-colors hover:text-primary">Install App</button>
          <Link to="/signup" className="transition-colors hover:text-primary">
            Sign up
          </Link>
          <Link
            to="/login"
            className="rounded-full bg-primary px-6 py-3 font-bold text-page transition-transform hover:scale-105 active:scale-95"
          >
            Log in
          </Link>
        </div>
      </header>
    )
  }

  return (
    <header className="flex items-center gap-4 px-4 h-16 shrink-0 bg-base">
      {/* Far left: logo */}
      <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="not-spotify home">
        <MusicalNoteIcon className="w-8 h-8 text-accent" />
        <span className="hidden md:block font-bold text-lg text-primary">not-spotify</span>
      </Link>

      {/* Center: home + search + theme toggle */}
      <div className="flex-1 flex items-center justify-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="w-12 h-12 rounded-full bg-elevated hover:bg-elevated/70 hover:scale-105 flex items-center justify-center transition-all"
          aria-label="Home"
          aria-current={isHome ? 'page' : undefined}
        >
          {isHome ? <HomeSolid className="w-6 h-6 text-primary" /> : <HomeIcon className="w-6 h-6 text-secondary" />}
        </button>

        <div className="relative w-full max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
          <input
            type="search"
            placeholder="What do you want to play?"
            defaultValue={currentQuery}
            onChange={handleSearch}
            onFocus={() => {
              if (!location.pathname.startsWith('/search')) navigate('/search')
            }}
            className="w-full bg-elevated text-primary placeholder:text-muted text-sm pl-10 pr-4 h-12 rounded-full border border-transparent hover:border-secondary/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors"
          />
        </div>

        {/* Theme toggle — sits right beside the search */}
        <button
          onClick={toggleTheme}
          className="w-12 h-12 rounded-full bg-elevated hover:bg-elevated/70 hover:scale-105 flex items-center justify-center text-secondary hover:text-primary transition-all shrink-0"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
      </div>

      {/* Right: user menu */}
      <div className="relative">
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="flex items-center gap-2 bg-elevated hover:bg-elevated/80 rounded-full pl-1 pr-3 py-1 transition-colors"
          aria-label="User menu"
        >
          <Avatar src={user?.avatarUrl} alt={user?.name ?? 'User'} size="sm" round />
          <span className="hidden sm:block text-sm font-semibold text-primary">{user?.name}</span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-52 bg-elevated rounded-md shadow-xl border border-secondary/10 overflow-hidden z-50 py-1">
              {/* Display-only placeholders for now (to be wired up later) */}
              <button
                type="button"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors cursor-default"
              >
                <UserIcon className="w-4 h-4" />
                Account
              </button>
              <button
                type="button"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors cursor-default"
              >
                <UserCircleIcon className="w-4 h-4" />
                Profile
              </button>
              <button
                type="button"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors cursor-default"
              >
                <QuestionMarkCircleIcon className="w-4 h-4" />
                Support
              </button>
              <button
                type="button"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors cursor-default"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Download
              </button>

              <div className="my-1 border-t border-secondary/10" />

              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                  Admin
                </Link>
              )}
              <button
                onClick={() => {
                  setShowMenu(false)
                  logout()
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
