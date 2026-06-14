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
  UsersIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  RssIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightSolid,
  HomeIcon as HomeSolid,
  UsersIcon as UsersSolid,
} from '@heroicons/react/24/solid'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useFriendStore } from '@/stores/friendStore'
import { useUiStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { meService, type RecentSearch } from '@/services/meService'
import { searchService, type SearchResults } from '@/services/searchService'
import { Avatar } from '@/components/ui/Avatar'
import { FriendPanel } from '@/components/friends/FriendPanel'
import { VoiceSearchButton } from '@/components/common/VoiceSearchButton'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/utils/cn'

const SEARCH_SKELETON_ROWS = [
  ['w-[84%]', 'w-[45%]'],
  ['w-[75%]', 'w-[37%]'],
  ['w-[63%]', 'w-[40%]'],
  ['w-[60%]', 'w-[28%]'],
  ['w-[57%]', 'w-[37%]'],
  ['w-[72%]', 'w-[34%]'],
] as const

export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()

  const isHome = location.pathname === '/'
  const isMessagesActive = location.pathname.startsWith('/messages')
  const currentQuery = searchParams.get('q') ?? ''
  const isAdmin = user?.roles?.includes('Admin') ?? false
  const isArtist = user?.roles?.includes('Artist') ?? false

  const [showMenu, setShowMenu] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const pendingCount = useFriendStore((s) => s.requests.length)
  const friendActivityOpen = useUiStore((s) => s.friendActivityOpen)
  const toggleFriendActivity = useUiStore((s) => s.toggleFriendActivity)
  const chatUnread = useChatStore((s) => s.conversations.reduce((sum, c) => sum + c.unreadCount, 0))
  const fetchConversations = useChatStore((s) => s.fetchConversations)

  // Load conversation summaries once after login so the unread badge is
  // correct immediately; live updates then arrive over the presence socket.
  useEffect(() => {
    if (isAuthenticated) fetchConversations()
  }, [isAuthenticated, fetchConversations])
  const [recents, setRecents] = useState<RecentSearch[]>([])
  const [searchValue, setSearchValue] = useState(currentQuery)
  const [suggestionsState, setSuggestionsState] = useState<{ query: string; data: SearchResults } | null>(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    meService.getRecentSearches().then(setRecents).catch(() => setRecents([]))
  }, [isAuthenticated])
  // Guests never show recents (state may hold the previous session's terms).
  const visibleRecents = isAuthenticated ? recents : []
  const trimmedSearchValue = searchValue.trim()
  const debouncedSearchValue = useDebounce(trimmedSearchValue, 220)
  const activeSuggestions = suggestionsState?.query === trimmedSearchValue ? suggestionsState.data : null
  const matchingRecents = visibleRecents
    .filter((recent) => !trimmedSearchValue || recent.term.toLowerCase().includes(trimmedSearchValue.toLowerCase()))
    .slice(0, trimmedSearchValue ? 8 : 20)
  const hasSuggestionResults =
    !!activeSuggestions &&
    (activeSuggestions.tracks.length > 0 ||
      activeSuggestions.artists.length > 0 ||
      activeSuggestions.albums.length > 0 ||
      activeSuggestions.playlists.length > 0)
  const shouldShowSearchPanel = showSearchPanel && (trimmedSearchValue.length > 0 || matchingRecents.length > 0)

  // Keep the input in sync when the URL query changes (e.g. recent-search click)
  // — render-phase adjustment instead of a setState-in-effect.
  const [prevQuery, setPrevQuery] = useState(currentQuery)
  if (prevQuery !== currentQuery) {
    setPrevQuery(currentQuery)
    setSearchValue(currentQuery)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!showSearchPanel || !debouncedSearchValue) {
      setSuggestionsLoading(false)
      if (!debouncedSearchValue) setSuggestionsState(null)
      return
    }

    let cancelled = false
    setSuggestionsLoading(true)
    searchService.search(debouncedSearchValue)
      .then((data) => {
        if (!cancelled) setSuggestionsState({ query: debouncedSearchValue, data })
      })
      .catch(() => {
        if (!cancelled) setSuggestionsState(null)
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedSearchValue, showSearchPanel])

  const submitSearch = (value = searchValue) => {
    const q = value.trim()
    setShowSearchPanel(false)
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
    else navigate('/search')
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value)
    setShowSearchPanel(true)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitSearch()
    }
    if (e.key === 'Escape') setShowSearchPanel(false)
  }

  const handleRecentClick = (term: string) => {
    submitSearch(term)
  }

  const handleBrowseClick = () => {
    setSearchValue('')
    setShowSearchPanel(false)
    navigate('/search')
  }

  const handleClearSearch = () => {
    setSearchValue('')
    setSuggestionsState(null)
    setShowSearchPanel(visibleRecents.length > 0)
    searchInputRef.current?.focus()
  }

  const handleRemoveRecentSearch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    meService.removeRecentSearch(id)
      .then(() => {
        setRecents((rows) => rows.filter((row) => row.id !== id))
        setShowSearchPanel(true)
      })
      .catch(() => {})
  }

  const handleClearRecentSearches = () => {
    meService.clearRecentSearches()
      .then(() => {
        setRecents([])
        if (!trimmedSearchValue) setShowSearchPanel(false)
      })
      .catch(() => {})
  }

  const openSuggestion = (path: string) => {
    setShowSearchPanel(false)
    navigate(path)
  }

  const userMenuItemClass =
    'flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-white/10'
  const userMenuIconClass = 'h-4 w-4 text-secondary'
  const showSuggestionSkeleton = trimmedSearchValue.length > 0 && suggestionsLoading

  const searchPanel = shouldShowSearchPanel && (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[calc(100vh-5.5rem)] overflow-y-auto overscroll-contain rounded-xl border border-secondary/15 bg-[#282828] py-2 shadow-2xl [scrollbar-color:rgba(255,255,255,0.3)_transparent] [scrollbar-width:thin]">
      {showSuggestionSkeleton ? (
        <SearchSuggestionsSkeleton />
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between px-4 py-1 text-[11px] font-bold uppercase tracking-wide text-muted">
            <span>{trimmedSearchValue ? 'Search suggestions' : 'Recent searches'}</span>
            {trimmedSearchValue && (
              <span className="flex items-center gap-2 normal-case tracking-normal text-secondary">
                <kbd className="rounded border border-secondary/40 px-1.5 py-0.5 text-[10px] text-primary">Enter</kbd>
                Search
              </span>
            )}
          </div>

          {trimmedSearchValue && (
            <button
              type="button"
              onClick={() => submitSearch(trimmedSearchValue)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-secondary">
                <MagnifyingGlassIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-primary">
                Search for "{trimmedSearchValue}"
              </span>
            </button>
          )}

          {matchingRecents.map((recent) => (
            <div
              key={recent.id}
              className="group flex items-center gap-1 px-2 py-1 transition-colors hover:bg-white/10"
            >
              <button
                type="button"
                onClick={() => handleRecentClick(recent.term)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-secondary">
                  <MagnifyingGlassIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-primary">{recent.term}</span>
              </button>
              <button
                type="button"
                onClick={(e) => handleRemoveRecentSearch(e, recent.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary opacity-70 transition-colors duration-150 hover:text-primary group-hover:opacity-100"
                aria-label={`Remove ${recent.term} from recent searches`}
                title="Remove"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}

          {trimmedSearchValue && activeSuggestions && (
            <>
          {activeSuggestions.tracks.slice(0, 3).map((track) => (
            <button
              key={`track-${track.id}`}
              type="button"
              onClick={() => openSuggestion(`/track/${track.id}`)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/10"
            >
              <img src={track.album.coverUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-primary">{track.title}</span>
                <span className="block truncate text-xs font-semibold text-secondary">
                  {track.explicit && <span className="mr-1 rounded bg-secondary px-1 text-[9px] font-black text-[#282828]">E</span>}
                  Song - {track.artist.name}
                </span>
              </span>
            </button>
          ))}

          {activeSuggestions.artists.slice(0, 3).map((artist) => (
            <button
              key={`artist-${artist.id}`}
              type="button"
              onClick={() => openSuggestion(`/artist/${artist.id}`)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/10"
            >
              {artist.imageUrl ? (
                <img src={artist.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-secondary">
                  {artist.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-primary">{artist.name}</span>
                <span className="block truncate text-xs font-semibold text-secondary">Artist</span>
              </span>
            </button>
          ))}

          {activeSuggestions.albums.slice(0, 1).map((album) => (
            <button
              key={`album-${album.id}`}
              type="button"
              onClick={() => openSuggestion(`/album/${album.id}`)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/10"
            >
              <img src={album.coverUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-primary">{album.title}</span>
                <span className="block truncate text-xs font-semibold text-secondary">Album - {album.artist.name}</span>
              </span>
            </button>
          ))}

          {activeSuggestions.playlists.slice(0, 1).map((playlist) => (
            <button
              key={`playlist-${playlist.id}`}
              type="button"
              onClick={() => openSuggestion(`/playlist/${playlist.id}`)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/10"
            >
              {playlist.coverUrl ? (
                <img src={playlist.coverUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/10 text-secondary">
                  <MusicalNoteIcon className="h-5 w-5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-primary">{playlist.name}</span>
                <span className="block truncate text-xs font-semibold text-secondary">Playlist</span>
              </span>
            </button>
          ))}
            </>
          )}

          {trimmedSearchValue && activeSuggestions && !hasSuggestionResults && (
            <div className="px-4 py-4 text-sm font-semibold text-secondary">
              No quick matches. Press Enter to search everywhere.
            </div>
          )}

          {isAuthenticated && visibleRecents.length > 0 && matchingRecents.length > 0 && (
            <div className="px-4 pb-1 pt-2">
              <button
                type="button"
                onClick={handleClearRecentSearches}
                className="rounded-full border border-secondary/60 px-4 py-1.5 text-xs font-black text-primary transition-all duration-200 hover:scale-[1.02] hover:border-primary hover:bg-white/10 active:scale-95"
              >
                Clear recent searches
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )

  if (!isAuthenticated) {
    return (
      <header className="sticky top-0 z-50 grid h-14 shrink-0 grid-cols-[1fr_minmax(0,560px)_1fr] items-center gap-4 border-b border-elevated/30 bg-base/90 px-4 backdrop-blur-xl md:h-16">
        <Link to="/" className="flex items-center gap-2 justify-self-start shrink-0" aria-label="not-spotify home">
          <MusicalNoteIcon className="w-7 h-7 md:w-8 md:h-8 text-accent" />
          <span className="hidden md:block font-bold text-lg text-primary">not-spotify</span>
        </Link>

        {/* Search bar — hidden on mobile (accessed via Search tab in bottom nav) */}
        <div className="hidden md:flex min-w-0 items-center justify-center gap-2 justify-self-center w-full">
          <button
            onClick={() => navigate('/')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-elevated transition-all hover:scale-105 hover:bg-elevated/70"
            aria-label="Home"
            aria-current={isHome ? 'page' : undefined}
          >
            {isHome ? <HomeSolid className="h-6 w-6 text-primary" /> : <HomeIcon className="h-6 w-6 text-secondary" />}
          </button>

          <div ref={searchContainerRef} className="relative w-full">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
            <input
              ref={searchInputRef}
              type="text"
              inputMode="search"
              placeholder="What do you want to play?"
              value={searchValue}
              onChange={handleSearch}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setShowSearchPanel(true)}
              className="h-12 w-full rounded-full border border-transparent bg-elevated pl-10 pr-20 text-sm font-semibold text-primary transition-colors placeholder:font-semibold placeholder:text-secondary hover:border-secondary/30 focus:border-primary focus:outline-none"
            />
            {searchValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-[4.45rem] top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-secondary transition-colors duration-150 hover:text-primary"
                aria-label="Clear search"
                title="Clear search"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
            <div className="pointer-events-none absolute right-14 top-1/2 h-6 w-px -translate-y-1/2 bg-secondary/25" />
            <button
              type="button"
              onClick={handleBrowseClick}
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface hover:text-primary"
              aria-label="Browse all"
              title="Browse all"
            >
              <BrowseTrayIcon />
            </button>
            {searchPanel}
          </div>
        </div>

        <div className="flex items-center justify-end gap-5 text-sm font-bold text-secondary">
          <div className="hidden items-center gap-5 2xl:flex">
            <Link to="/premium" className="transition-colors hover:text-primary">Premium</Link>
            <button className="transition-colors hover:text-primary">Support</button>
            <div className="h-6 w-px bg-secondary/40" />
          </div>
          <Link to="/signup" className="hidden md:block transition-colors hover:text-primary">
            Sign up
          </Link>
          <Link
            to="/login"
            className="rounded-full bg-primary px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-bold text-page transition-transform hover:scale-105 active:scale-95"
          >
            Log in
          </Link>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b border-elevated/30 bg-base/90 px-3 backdrop-blur-xl md:h-16 md:gap-4 md:px-4 relative">
      {/* Far left: logo */}
      <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="not-spotify home">
        <MusicalNoteIcon className="w-7 h-7 md:w-8 md:h-8 text-accent" />
        <span className="hidden md:block font-bold text-lg text-primary">not-spotify</span>
      </Link>

      {/* Center: home + search + theme toggle — desktop only */}
      <div className="absolute left-1/2 top-1/2 hidden w-[min(560px,calc(100vw-36rem))] min-w-[420px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 lg:flex">
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
            type="text"
            inputMode="search"
            placeholder="What do you want to play?"
            value={searchValue}
            onChange={handleSearch}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setShowSearchPanel(true)}
            className="h-12 w-full rounded-full border border-transparent bg-elevated pl-10 pr-20 text-sm font-semibold text-primary transition-colors placeholder:font-semibold placeholder:text-secondary hover:border-secondary/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-[4.45rem] top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-secondary transition-colors duration-150 hover:text-primary"
              aria-label="Clear search"
              title="Clear search"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
          <div className="pointer-events-none absolute right-14 top-1/2 h-6 w-px -translate-y-1/2 bg-secondary/25" />
          <button
            type="button"
            onClick={handleBrowseClick}
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface hover:text-primary"
            aria-label="Browse all"
            title="Browse all"
          >
            <BrowseTrayIcon />
          </button>
          {searchPanel}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-12 h-12 rounded-full bg-elevated hover:bg-elevated/70 hover:scale-105 flex items-center justify-center text-secondary hover:text-primary transition-all shrink-0"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        {/* Voice search — only renders where the Web Speech API exists */}
        <VoiceSearchButton onResult={(text) => { setSearchValue(text); submitSearch(text) }} />
      </div>

      {/* Mobile: page title area (spacer) */}
      <div className="flex-1" />

      {/* Free-user account links */}
      {user?.capabilities?.unlimitedPlayback === false && (
        <div className="hidden shrink-0 items-center gap-4 text-sm font-bold text-secondary sm:flex">
          <Link to="/premium" className="transition-colors hover:text-primary">
            Premium
          </Link>
          <button type="button" className="transition-colors hover:text-primary">
            Support
          </button>
        </div>
      )}

      {/* Messages — red badge shows unread count */}
      <button
        onClick={() => navigate(isMessagesActive ? '/' : '/messages')}
        aria-label={chatUnread > 0 ? `Messages (${chatUnread} unread)` : 'Messages'}
        className={cn(
          'spotify-tooltip-anchor relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated transition-all hover:scale-105 hover:bg-elevated/70 hover:text-primary',
          isMessagesActive ? 'text-primary' : 'text-secondary'
        )}
      >
        {isMessagesActive ? <ChatBubbleLeftRightSolid className="h-5 w-5" /> : <ChatBubbleLeftRightIcon className="h-5 w-5" />}
        <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">Messages</span>
        {chatUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {chatUnread > 9 ? '9+' : chatUnread}
          </span>
        )}
      </button>

      {/* Notifications bell — desktop only */}
      <NotificationBell />

      {/* Friend activity feed toggle — desktop only */}
      <button
        onClick={() => {
          toggleFriendActivity()
          setShowFriends(false)
          setShowMenu(false)
        }}
        aria-label="Friend activity"
        aria-pressed={friendActivityOpen}
        className={cn(
          'spotify-tooltip-anchor relative hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated transition-all hover:scale-105 hover:bg-elevated/70 hover:text-primary md:flex',
          friendActivityOpen ? 'text-accent' : 'text-secondary'
        )}
      >
        <RssIcon className="h-5 w-5" />
        <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">Friend activity</span>
      </button>

      {/* Friends panel toggle — desktop only */}
      <div className="relative hidden md:block">
        <button
          onClick={() => {
            setShowFriends((v) => !v)
            setShowMenu(false)
          }}
          aria-label="Friends"
          className={cn(
            'spotify-tooltip-anchor relative flex h-10 w-10 items-center justify-center rounded-full bg-elevated transition-all hover:scale-105 hover:bg-elevated/70 hover:text-primary',
            showFriends ? 'text-primary' : 'text-secondary'
          )}
        >
          {showFriends ? <UsersSolid className="h-5 w-5" /> : <UsersIcon className="h-5 w-5" />}
          <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">Friends</span>
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
          className="flex items-center gap-2 bg-elevated hover:bg-elevated/80 rounded-full pl-1 pr-2 md:pr-3 py-1 transition-colors"
          aria-label="User menu"
        >
          <Avatar src={user?.avatarUrl} alt={user?.name ?? 'User'} size="sm" round />
          <span className="hidden sm:block text-sm font-semibold text-primary">{user?.name}</span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-md border border-secondary/10 bg-[#282828] py-1 shadow-xl">
              <Link
                to="/account"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                <UserIcon className={userMenuIconClass} />
                Account
              </Link>
              <Link
                to="/profile"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                <UserCircleIcon className={userMenuIconClass} />
                Profile
              </Link>
              <Link
                to="/settings"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                <Cog6ToothIcon className={userMenuIconClass} />
                Settings
              </Link>
              {/* Theme toggle in mobile menu */}
              <button
                onClick={() => { toggleTheme(); setShowMenu(false) }}
                className={cn(userMenuItemClass, 'md:hidden')}
              >
                {theme === 'dark' ? <SunIcon className={userMenuIconClass} /> : <MoonIcon className={userMenuIconClass} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <Link
                to="/premium"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                <ArrowDownTrayIcon className={userMenuIconClass} />
                Premium
              </Link>
              <Link
                to="/history"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                <ClockIcon className={userMenuIconClass} />
                Listening history
              </Link>
              <Link
                to="/stats"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                <ChartBarIcon className={userMenuIconClass} />
                Listening stats
              </Link>

              <div className="my-1 border-t border-secondary/10" />

              {isArtist && (
                <Link
                  to="/artist-dashboard"
                  onClick={() => setShowMenu(false)}
                  className={userMenuItemClass}
                >
                  <MusicalNoteIcon className={userMenuIconClass} />
                  Artist Dashboard
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setShowMenu(false)}
                  className={userMenuItemClass}
                >
                  <Cog6ToothIcon className={userMenuIconClass} />
                  Admin Dashboard
                </Link>
              )}
              <button
                onClick={() => {
                  setShowMenu(false)
                  logout()
                }}
                className={userMenuItemClass}
              >
                <ArrowRightOnRectangleIcon className={userMenuIconClass} />
                Log out
              </button>
            </div>
          </>
        )}
      </div>

    </header>
  )
}

function SearchSuggestionsSkeleton() {
  return (
    <div className="px-1 pb-1 pt-1" role="status" aria-label="Loading search suggestions">
      {SEARCH_SKELETON_ROWS.map(([titleWidth, subtitleWidth], index) => (
        <div key={index} className="flex items-center gap-3 px-1.5 py-1.5">
          <span className="search-skeleton-shimmer h-12 w-12 shrink-0 rounded" />
          <span className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className={cn('search-skeleton-shimmer h-4 rounded-full', titleWidth)} />
            <span className={cn('search-skeleton-shimmer h-2.5 rounded-full', subtitleWidth)} />
          </span>
        </div>
      ))}
      <span className="sr-only">Loading search suggestions</span>
    </div>
  )
}

function BrowseTrayIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7" fill="none">
      <path
        d="M11 9.5V6.8h10v2.7M7.5 13.2h17l-1.55 10H9.05l-1.55-10Z"
        stroke="currentColor"
        strokeWidth="2.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.1 18.25h5.8"
        stroke="currentColor"
        strokeWidth="2.45"
        strokeLinecap="round"
      />
    </svg>
  )
}
