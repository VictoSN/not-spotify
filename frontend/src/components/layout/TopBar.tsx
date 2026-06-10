import { useState, useEffect, useRef } from 'react'
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
  ArrowDownTrayIcon,
  ClockIcon,
  SparklesIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { HomeIcon as HomeSolid } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useFriendStore } from '@/stores/friendStore'
import { meService, type RecentSearch } from '@/services/meService'
import { Avatar } from '@/components/ui/Avatar'
import { FriendPanel } from '@/components/friends/FriendPanel'

export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()

  const isHome = location.pathname === '/'
  const currentQuery = searchParams.get('q') ?? ''
  const isAdmin = user?.roles?.includes('Admin') ?? false
  const isArtist = user?.roles?.includes('Artist') ?? false

  const [showMenu, setShowMenu] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const [showSearchRecents, setShowSearchRecents] = useState(false)
  const pendingCount = useFriendStore((s) => s.requests.length)
  const [recents, setRecents] = useState<RecentSearch[]>([])
  const [searchValue, setSearchValue] = useState(currentQuery)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setRecents([])
      return
    }
    meService.getRecentSearches().then(setRecents).catch(() => setRecents([]))
  }, [isAuthenticated])

  useEffect(() => {
    setSearchValue(currentQuery)
  }, [currentQuery])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchRecents(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setSearchValue(q)
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
    else navigate('/search')
  }

  const handleRecentClick = (term: string) => {
    setShowSearchRecents(false)
    navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  if (!isAuthenticated) {
    return (
      <header className="grid h-16 shrink-0 grid-cols-[1fr_minmax(280px,560px)_1fr] items-center gap-4 bg-base px-4">
        <Link to="/" className="flex items-center gap-2 justify-self-start shrink-0" aria-label="not-spotify home">
          <MusicalNoteIcon className="w-8 h-8 text-accent" />
          <span className="hidden md:block font-bold text-lg text-primary">not-spotify</span>
        </Link>

        <div className="flex min-w-0 items-center justify-center gap-2 justify-self-center w-full">
          <button
            onClick={() => navigate('/')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-elevated transition-all hover:scale-105 hover:bg-elevated/70"
            aria-label="Home"
            aria-current={isHome ? 'page' : undefined}
          >
            {isHome ? <HomeSolid className="h-6 w-6 text-primary" /> : <HomeIcon className="h-6 w-6 text-secondary" />}
          </button>

          <div className="relative w-full">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
            <input
              type="search"
              placeholder="What do you want to play?"
              value={searchValue}
              onChange={handleSearch}
              onFocus={() => {
                if (!location.pathname.startsWith('/search')) navigate('/search')
              }}
              className="h-12 w-full rounded-full border border-transparent bg-elevated pl-10 pr-10 text-sm text-primary transition-colors placeholder:text-muted hover:border-secondary/30 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="hidden items-center justify-end gap-5 text-sm font-bold text-secondary lg:flex">
          <div className="hidden items-center gap-5 2xl:flex">
            <Link to="/premium" className="transition-colors hover:text-primary">Premium</Link>
            <button className="transition-colors hover:text-primary">Support</button>
            <button className="transition-colors hover:text-primary">Download</button>
            <div className="h-6 w-px bg-secondary/40" />
            <button className="transition-colors hover:text-primary">Install App</button>
          </div>
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

        <div ref={searchContainerRef} className="relative w-full max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="What do you want to play?"
            value={searchValue}
            onChange={handleSearch}
            onFocus={() => {
              if (!location.pathname.startsWith('/search')) navigate('/search')
              if (recents.length > 0) setShowSearchRecents(true)
            }}
            className="w-full bg-elevated text-primary placeholder:text-muted text-sm pl-10 pr-10 h-12 rounded-full border border-transparent hover:border-secondary/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors"
          />
          {showSearchRecents && recents.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-elevated rounded-lg shadow-xl border border-secondary/20 overflow-hidden z-50">
              {recents.slice(0, 5).map((recent) => (
                <button
                  key={recent.id}
                  onClick={() => handleRecentClick(recent.term)}
                  className="w-full px-4 py-2.5 text-left text-sm text-primary hover:bg-surface transition-colors flex items-center gap-3"
                >
                  <MagnifyingGlassIcon className="w-4 h-4 text-secondary flex-shrink-0" />
                  <span>{recent.term}</span>
                </button>
              ))}
            </div>
          )}
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

      {/* Explore Premium pill — only for free-tier authenticated users */}
      {user?.capabilities?.unlimitedPlayback === false && (
        <Link
          to="/premium"
          className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          Explore Premium
        </Link>
      )}

      {/* Friends panel toggle */}
      <div className="relative">
        <button
          onClick={() => {
            setShowFriends((v) => !v)
            setShowMenu(false)
          }}
          aria-label="Friends"
          className="relative flex items-center justify-center w-10 h-10 rounded-full bg-elevated hover:bg-elevated/70 hover:scale-105 transition-all text-secondary hover:text-primary"
        >
          <UsersIcon className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
        {showFriends && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowFriends(false)} />
            <FriendPanel onClose={() => setShowFriends(false)} />
          </>
        )}
      </div>

      {/* Right: user menu */}
      <div className="relative">
        <button
          onClick={() => {
            setShowMenu((v) => !v)
            setShowFriends(false)
          }}
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
              <Link
                to="/account"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                Account
              </Link>
              <Link
                to="/profile"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
              >
                <UserCircleIcon className="w-4 h-4" />
                Profile
              </Link>
              <Link
                to="/settings"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
              >
                <Cog6ToothIcon className="w-4 h-4" />
                Settings
              </Link>
              <Link
                to="/premium"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Premium
              </Link>
              <Link
                to="/history"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
              >
                <ClockIcon className="w-4 h-4" />
                Listening history
              </Link>

              <div className="my-1 border-t border-secondary/10" />

              {isArtist && (
                <Link
                  to="/artist-dashboard"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
                >
                  <MusicalNoteIcon className="w-4 h-4" />
                  Artist Dashboard
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-surface transition-colors"
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                  Admin Dashboard
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
