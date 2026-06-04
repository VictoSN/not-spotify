import { useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  HomeIcon,
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { HomeIcon as HomeSolid } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { Avatar } from '@/components/ui/Avatar'

export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [showMenu, setShowMenu] = useState(false)

  const isHome = location.pathname === '/'
  const currentQuery = searchParams.get('q') ?? ''

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
    else navigate('/search')
  }

  return (
    <header className="flex items-center gap-4 px-4 h-16 shrink-0 bg-base">
      {/* Left: back / forward */}
      <div className="hidden sm:flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center text-secondary hover:text-primary transition-colors"
          aria-label="Go back"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate(1)}
          className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center text-secondary hover:text-primary transition-colors"
          aria-label="Go forward"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Center: home + search + theme toggle */}
      <div className="flex-1 flex items-center justify-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="w-12 h-12 rounded-full bg-elevated hover:bg-elevated/70 hover:scale-105 flex items-center justify-center transition-all"
          aria-label="Home"
          aria-current={isHome ? 'page' : undefined}
        >
          {isHome ? (
            <HomeSolid className="w-6 h-6 text-primary" />
          ) : (
            <HomeIcon className="w-6 h-6 text-secondary" />
          )}
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
            <div className="absolute right-0 top-full mt-2 w-44 bg-elevated rounded-md shadow-xl border border-secondary/10 overflow-hidden z-50">
              <button
                onClick={() => {
                  setShowMenu(false)
                  logout()
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
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
