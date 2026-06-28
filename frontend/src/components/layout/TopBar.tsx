import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import {
  MagnifyingGlassIcon,
  MusicalNoteIcon,
  UserGroupIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import {
  CheckBadgeIcon,
  PauseIcon,
  PlayIcon,
  UserGroupIcon as UserGroupSolid,
} from '@heroicons/react/24/solid'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useFriendStore } from '@/stores/friendStore'
import { useUiStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { meService, type RecentSearch } from '@/services/meService'
import { searchService, type SearchResults } from '@/services/searchService'
import { artistService } from '@/services/artistService'
import { trackService } from '@/services/trackService'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { VoiceSearchButton } from '@/components/common/VoiceSearchButton'
import { InstallAppButton, InstallAppMenuItem } from '@/components/common/InstallAppButton'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { WindowControls } from './WindowControls'
import { SpotifyHomeIcon, SpotifyHomeSolidIcon } from '@/components/icons/SpotifyHomeIcon'
import { useDebounce } from '@/hooks/useDebounce'
import { usePlaybackGate, usePlayContextGate } from '@/hooks/usePlaybackGate'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { cn } from '@/utils/cn'
import { useTranslation } from '@/i18n/useTranslation'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import type { Artist } from '@/types/artist'
import type { MusicVideo } from '@/types/musicVideo'

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
  const { t } = useTranslation()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const startTrack = usePlaybackGate()
  const startContext = usePlayContextGate()
  const playVideo = usePlayerStore((s) => s.playVideo)
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentContextType = usePlayerStore((s) => s.currentContextType)
  const currentContextId = usePlayerStore((s) => s.currentContextId)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const currentVideo = usePlayerStore((s) => s.currentVideo)
  const isVideoPlaying = usePlayerStore((s) => s.isVideoPlaying)
  const setKaraokeOpen = usePlayerStore((s) => s.setKaraokeOpen)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const {
    likedTrackIds,
    likeTrack,
    unlikeTrack,
    savedAlbumIds,
    saveAlbum,
    unsaveAlbum,
    followedArtistIds,
    followArtist,
    unfollowArtist,
    savedVideoIds,
    saveVideo,
    unsaveVideo,
  } = useLibraryStore()

  const isHome = location.pathname === '/'
  const currentQuery = searchParams.get('q') ?? ''
  const isArtist = user?.roles?.includes('Artist') ?? false
  const isBrowse = location.pathname === '/search' && currentQuery.trim().length === 0

  const [showMenu, setShowMenu] = useState(false)
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const friendRequests = useFriendStore((s) => s.requests)
  const pendingCount = friendRequests.length
  const socialPanelOpen = useUiStore((s) => s.socialPanelOpen)
  const toggleSocialPanel = useUiStore((s) => s.toggleSocialPanel)
  const setSocialPanelOpen = useUiStore((s) => s.setSocialPanelOpen)
  const chatUnread = useChatStore((s) => s.conversations.reduce((sum, c) => sum + c.unreadCount, 0))
  const socialBadge = chatUnread + pendingCount
  const fetchConversations = useChatStore((s) => s.fetchConversations)

  // Load conversation summaries once after login so the unread badge is
  // correct immediately; live updates then arrive over the presence socket.
  useEffect(() => {
    if (isAuthenticated) fetchConversations()
  }, [isAuthenticated, fetchConversations])
  const [recents, setRecents] = useState<RecentSearch[]>([])
  const [searchValue, setSearchValue] = useState(currentQuery)
  const [suggestionsState, setSuggestionsState] = useState<{ query: string; data: SearchResults } | null>(null)
  const [suggestionsDoneQuery, setSuggestionsDoneQuery] = useState<string | null>(null)
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
  const suggestionTracks = activeSuggestions
    ? [...activeSuggestions.tracks, ...(activeSuggestions.tracksByLyrics ?? [])].filter(
        (track, index, rows) => rows.findIndex((row) => row.id === track.id) === index,
      )
    : []
  const matchingRecents = visibleRecents
    .filter((recent) => !trimmedSearchValue || recent.term.toLowerCase().includes(trimmedSearchValue.toLowerCase()))
    .slice(0, trimmedSearchValue ? 8 : 20)
  const hasSuggestionResults =
    !!activeSuggestions &&
    (suggestionTracks.length > 0 ||
      activeSuggestions.artists.length > 0 ||
      activeSuggestions.albums.length > 0 ||
      activeSuggestions.playlists.length > 0 ||
      (activeSuggestions.musicVideos?.length ?? 0) > 0)
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
      return
    }

    let cancelled = false
    searchService.search(debouncedSearchValue)
      .then((data) => {
        if (!cancelled) {
          setSuggestionsState({ query: debouncedSearchValue, data })
          setSuggestionsDoneQuery(debouncedSearchValue)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestionsState(null)
          setSuggestionsDoneQuery(debouncedSearchValue)
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedSearchValue, showSearchPanel])

  const submitSearch = (value = searchValue) => {
    const q = value.trim()
    setKaraokeOpen(false)
    setShowSearchPanel(false)
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
    else navigate('/search')
  }

  const closeKaraoke = () => setKaraokeOpen(false)

  const goHome = () => {
    closeKaraoke()
    navigate('/')
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
    closeKaraoke()
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
    closeKaraoke()
    setShowSearchPanel(false)
    navigate(path)
  }

  const isTrackActive = (track: Track) => currentTrack?.id === track.id
  const isAlbumActive = (album: Album) =>
    currentContextType !== 'artist' &&
    currentContextType !== 'mix' &&
    currentTrack?.album.id === album.id
  const isArtistActive = (artist: Artist) => currentContextType === 'artist' && currentContextId === artist.id
  const isVideoActive = (video: MusicVideo) => playbackMode === 'video' && currentVideo?.id === video.id

  const playSuggestionTrack = (event: React.MouseEvent, track: Track) => {
    event.stopPropagation()
    if (isTrackActive(track)) {
      togglePlayPause()
      return
    }
    if (startTrack(track, [track])) setShowSearchPanel(false)
  }

  const playSuggestionAlbum = async (event: React.MouseEvent, album: Album) => {
    event.stopPropagation()
    if (isAlbumActive(album)) {
      togglePlayPause()
      return
    }
    try {
      const tracks = await trackService.getByAlbum(album.id)
      if (startContext({ type: 'album', id: album.id }, tracks, 0)) setShowSearchPanel(false)
    } catch {
      // Album playback is best-effort from quick search; detail navigation still works.
    }
  }

  const playSuggestionArtist = async (event: React.MouseEvent, artist: Artist) => {
    event.stopPropagation()
    if (isArtistActive(artist)) {
      togglePlayPause()
      return
    }
    try {
      const tracks = await artistService.getTopTracks(artist.id, 10)
      if (startContext({ type: 'artist', id: artist.id }, tracks, 0)) setShowSearchPanel(false)
    } catch {
      // Artist rows still navigate even if top-track playback cannot be loaded.
    }
  }

  const playSuggestionVideo = (event: React.MouseEvent, video: MusicVideo) => {
    event.stopPropagation()
    if (isVideoActive(video)) {
      togglePlayPause()
      return
    }
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Start watching with a free account', imageUrl: video.thumbnailUrl })
      return
    }
    playVideo(video, [video])
    setShowSearchPanel(false)
  }

  const toggleSuggestionTrackLike = (event: React.MouseEvent, track: Track) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.saveMusicPrompt'), imageUrl: track.album.coverUrl })
      return
    }
    if (likedTrackIds.has(track.id)) unlikeTrack(track.id)
    else likeTrack(track)
  }

  const toggleSuggestionAlbumSave = (event: React.MouseEvent, album: Album) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.saveMusicPrompt'), imageUrl: album.coverUrl })
      return
    }
    if (savedAlbumIds.has(album.id)) unsaveAlbum(album.id)
    else saveAlbum(album)
  }

  const toggleSuggestionArtistFollow = (event: React.MouseEvent, artist: Artist) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.followArtistPrompt'), imageUrl: artist.imageUrl })
      return
    }
    if (followedArtistIds.has(artist.id)) unfollowArtist(artist.id)
    else followArtist(artist)
  }

  const toggleSuggestionVideoSave = (event: React.MouseEvent, video: MusicVideo) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Save videos with a free account', imageUrl: video.thumbnailUrl })
      return
    }
    if (savedVideoIds.has(video.id)) unsaveVideo(video.id)
    else saveVideo(video)
  }

  // Spotify-style account menu: text-only rows, with a trailing external-link
  // arrow on the items that conceptually leave the app (Account/Premium/Install).
  const userMenuItemClass =
    'flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10'
  const userMenuArrowClass = 'h-4 w-4 shrink-0 text-secondary'
  const suggestionsLoading =
    showSearchPanel &&
    trimmedSearchValue.length > 0 &&
    debouncedSearchValue.length > 0 &&
    suggestionsDoneQuery !== debouncedSearchValue
  const showSuggestionSkeleton = trimmedSearchValue.length > 0 && suggestionsLoading

  const searchPanel = shouldShowSearchPanel && (
    <div className="spotify-scrollbar absolute left-0 right-0 top-full z-[1000] mt-2 max-h-[calc(100vh-5.5rem)] overflow-y-auto overscroll-contain rounded-xl border border-secondary/15 bg-elevated py-2 shadow-2xl">
      {showSuggestionSkeleton ? (
        <SearchSuggestionsSkeleton />
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between px-4 py-1 text-[11px] font-normal uppercase tracking-wide text-muted">
            <span>{trimmedSearchValue ? t('topbar.searchSuggestions') : t('topbar.recentSearches')}</span>
            {trimmedSearchValue && (
              <span className="flex items-center gap-2 normal-case tracking-normal text-secondary">
                <kbd className="rounded border border-secondary/40 px-1.5 py-0.5 text-[10px] text-primary">Enter</kbd>
                {t('topbar.search')}
              </span>
            )}
          </div>

          {trimmedSearchValue && (
            <button
              type="button"
              onClick={() => submitSearch(trimmedSearchValue)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-secondary">
                <MagnifyingGlassIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-normal text-primary">
                {t('topbar.searchFor', { query: trimmedSearchValue })}
              </span>
            </button>
          )}

          {matchingRecents.map((recent) => (
            <div
              key={recent.id}
              className="group flex items-center gap-1 px-2 py-1 transition-colors hover:bg-primary/10"
            >
              <button
                type="button"
                onClick={() => handleRecentClick(recent.term)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-secondary">
                  <MagnifyingGlassIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-normal text-primary">{recent.term}</span>
              </button>
              <button
                type="button"
                onClick={(e) => handleRemoveRecentSearch(e, recent.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary opacity-70 transition-colors duration-150 hover:text-primary group-hover:opacity-100"
                aria-label={t('topbar.removeRecentAria', { term: recent.term })}
                title={t('topbar.remove')}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}

          {trimmedSearchValue && activeSuggestions && (
            <>
          {suggestionTracks.slice(0, 3).map((track) => (
            <SearchSuggestionRow
              key={`track-${track.id}`}
              imageUrl={track.album.coverUrl}
              title={track.title}
              subtitle={(
                <>
                  {track.explicit && <span className="mr-1 rounded bg-secondary px-1 text-[9px] font-black text-page">E</span>}
                  {t('topbar.result.songBy', { artist: track.artist.name })}
                </>
              )}
              onOpen={() => openSuggestion(`/track/${track.id}`)}
              onPlay={(event) => playSuggestionTrack(event, track)}
              isActive={isTrackActive(track)}
              isPlaying={isTrackActive(track) && isPlaying}
              action={(
                <button
                  type="button"
                  onClick={(event) => toggleSuggestionTrackLike(event, track)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:text-primary"
                  aria-label={likedTrackIds.has(track.id) ? t('player.unlike') : t('player.like')}
                >
                  <AnimatedLikeIcon
                    liked={likedTrackIds.has(track.id)}
                    className="h-5 w-5"
                    heartClassName="h-5 w-5"
                  />
                </button>
              )}
            />
          ))}

          {activeSuggestions.artists.slice(0, 3).map((artist) => (
            <SearchSuggestionRow
              key={`artist-${artist.id}`}
              imageUrl={artist.imageUrl}
              fallbackText={artist.name.slice(0, 1).toUpperCase()}
              imageRounded="rounded-full"
              title={(
                <span className="flex min-w-0 items-center gap-1">
                  <span className="truncate">{artist.name}</span>
                  {artist.verified && (
                    <CheckBadgeIcon className="h-4 w-4 shrink-0 text-accent" aria-label={t('artist.verified')} />
                  )}
                </span>
              )}
              subtitle={t('topbar.result.artist')}
              onOpen={() => openSuggestion(`/artist/${artist.id}`)}
              onPlay={(event) => playSuggestionArtist(event, artist)}
              isActive={isArtistActive(artist)}
              isPlaying={isArtistActive(artist) && isPlaying}
              action={(
                <button
                  type="button"
                  onClick={(event) => toggleSuggestionArtistFollow(event, artist)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1 text-xs font-normal transition-all hover:scale-[1.02] active:scale-95',
                    followedArtistIds.has(artist.id)
                      ? 'border-primary bg-primary text-page'
                      : 'border-secondary/60 text-primary hover:border-primary',
                  )}
                >
                  {followedArtistIds.has(artist.id) ? t('common.following') : t('common.follow')}
                </button>
              )}
            />
          ))}

          {activeSuggestions.albums.slice(0, 1).map((album) => (
            <SearchSuggestionRow
              key={`album-${album.id}`}
              imageUrl={album.coverUrl}
              title={album.title}
              subtitle={`${album.type === 'single' ? 'Single' : 'Album'} - ${album.artist.name}`}
              onOpen={() => openSuggestion(`/album/${album.id}`)}
              onPlay={(event) => playSuggestionAlbum(event, album)}
              isActive={isAlbumActive(album)}
              isPlaying={isAlbumActive(album) && isPlaying}
              action={(
                <button
                  type="button"
                  onClick={(event) => toggleSuggestionAlbumSave(event, album)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:text-primary"
                  aria-label={savedAlbumIds.has(album.id) ? t('detail.removeFromLibrary') : t('detail.saveToLibrary')}
                >
                  <AnimatedLikeIcon
                    liked={savedAlbumIds.has(album.id)}
                    className="h-5 w-5"
                    heartClassName="h-5 w-5"
                  />
                </button>
              )}
            />
          ))}

          {(activeSuggestions.musicVideos ?? []).slice(0, 2).map((video) => (
            <SearchSuggestionRow
              key={`video-${video.id}`}
              imageUrl={video.thumbnailUrl}
              title={video.title}
              subtitle={`Music video - ${video.artist.name}`}
              onOpen={() => openSuggestion(`/videos/${video.id}`)}
              onPlay={(event) => playSuggestionVideo(event, video)}
              isActive={isVideoActive(video)}
              isPlaying={isVideoActive(video) && isVideoPlaying}
              action={(
                <button
                  type="button"
                  onClick={(event) => toggleSuggestionVideoSave(event, video)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:text-primary"
                  aria-label={savedVideoIds.has(video.id) ? t('detail.removeFromLibrary') : t('detail.saveToLibrary')}
                >
                  <AnimatedLikeIcon
                    liked={savedVideoIds.has(video.id)}
                    className="h-5 w-5"
                    heartClassName="h-5 w-5"
                  />
                </button>
              )}
            />
          ))}

          {activeSuggestions.playlists.slice(0, 1).map((playlist) => (
            <button
              key={`playlist-${playlist.id}`}
              type="button"
              onClick={() => openSuggestion(`/playlist/${playlist.id}`)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/10"
            >
              {playlist.coverUrl ? (
                <img src={playlist.coverUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10 text-secondary">
                  <MusicalNoteIcon className="h-5 w-5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-normal text-primary">{playlist.name}</span>
                <span className="block truncate text-xs font-normal text-secondary">{t('topbar.result.playlist')}</span>
              </span>
            </button>
          ))}
            </>
          )}

          {trimmedSearchValue && activeSuggestions && !hasSuggestionResults && (
            <div className="px-4 py-4 text-sm font-normal text-secondary">
              {t('topbar.noQuickMatches')}
            </div>
          )}

          {isAuthenticated && visibleRecents.length > 0 && matchingRecents.length > 0 && (
            <div className="px-4 pb-1 pt-2">
              <button
                type="button"
                onClick={handleClearRecentSearches}
                className="rounded-full border border-secondary/60 px-4 py-1.5 text-xs font-normal text-primary transition-all duration-200 hover:scale-[1.02] hover:border-primary hover:bg-primary/10 active:scale-95"
              >
                {t('topbar.clearRecentSearches')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )

  if (!isAuthenticated) {
    return (
      <header data-tauri-drag-region className="sticky top-0 z-50 grid h-14 shrink-0 grid-cols-[1fr_minmax(0,560px)_1fr] items-center gap-4 bg-base/90 px-4 backdrop-blur-xl md:h-14">
        <Link to="/" onClick={closeKaraoke} className="flex items-center justify-self-start shrink-0" aria-label={t('topbar.brandHome')}>
          <SpotifyMark className="w-7 h-7 md:w-8 md:h-8" />
        </Link>

        {/* Search bar — hidden on mobile (accessed via Search tab in bottom nav) */}
        <div className="hidden md:flex min-w-0 items-center justify-center gap-1.5 justify-self-center w-full">
          <button
            onClick={goHome}
            className="topbar-control spotify-tooltip-anchor relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated transition-all hover:scale-105 hover:bg-elevated/70"
            aria-label={t('topbar.home')}
            aria-current={isHome ? 'page' : undefined}
          >
            {isHome ? (
              <SpotifyHomeSolidIcon className="h-6 w-6 text-primary" />
            ) : (
              <SpotifyHomeIcon className="h-6 w-6 text-secondary" />
            )}
            <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">{t('topbar.home')}</span>
          </button>

          <div ref={searchContainerRef} className="relative w-full">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 text-secondary" />
            <input
              ref={searchInputRef}
              type="text"
              inputMode="search"
              placeholder={t('topbar.searchPlaceholder')}
              value={searchValue}
              onChange={handleSearch}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setShowSearchPanel(true)}
              className="h-11 w-full rounded-full border border-transparent bg-elevated pl-12 pr-20 text-[16px] font-normal text-primary transition-colors placeholder:font-normal placeholder:text-secondary hover:border-secondary/30 focus:border-primary focus:outline-none"
            />
            {searchValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="spotify-tooltip-anchor absolute right-[4.45rem] top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-secondary transition-colors duration-150 hover:text-primary"
                aria-label={t('topbar.clearSearch')}
              >
                <XMarkIcon className="h-4 w-4" />
                <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">{t('topbar.clearSearchField')}</span>
              </button>
            )}
            <div className="pointer-events-none absolute right-14 top-1/2 h-6 w-px -translate-y-1/2 bg-secondary/25" />
            <button
              type="button"
              onClick={handleBrowseClick}
              className={cn(
                'spotify-tooltip-anchor absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-surface hover:text-primary',
                isBrowse ? 'text-primary' : 'text-secondary',
              )}
              aria-label={t('topbar.browseAll')}
              aria-current={isBrowse ? 'page' : undefined}
            >
              <BrowseTrayIcon filled={isBrowse} />
              <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">{t('topbar.browse')}</span>
            </button>
            {searchPanel}
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-3 text-sm font-bold text-secondary lg:gap-5">
          <div className="hidden items-center gap-5 2xl:flex">
            <Link to="/premium" onClick={closeKaraoke} className="whitespace-nowrap transition-colors hover:text-primary">{t('topbar.premium')}</Link>
            <InstallAppButton className="whitespace-nowrap transition-colors hover:text-primary" />
            <Link to="/support" onClick={closeKaraoke} className="whitespace-nowrap transition-colors hover:text-primary">{t('topbar.support')}</Link>
            <div className="h-6 w-px bg-secondary/40" />
          </div>
          <Link to="/signup" onClick={closeKaraoke} className="hidden shrink-0 whitespace-nowrap transition-colors hover:text-primary md:block">
            {t('topbar.signUp')}
          </Link>
          <Link
            to="/login"
            onClick={closeKaraoke}
            className="shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-bold text-page transition-transform hover:scale-105 active:scale-95 md:px-6 md:py-3 md:text-sm"
          >
            {t('topbar.logIn')}
          </Link>
          <WindowControls />
        </div>
      </header>
    )
  }

  return (
    <header data-tauri-drag-region className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-1.5 bg-base/90 px-3 backdrop-blur-xl md:h-14 md:gap-2 md:px-4 relative">
      {/* Far left: logo */}
      <Link to="/" onClick={closeKaraoke} className="flex items-center shrink-0" aria-label={t('topbar.brandHome')}>
        <SpotifyMark className="w-7 h-7 md:w-8 md:h-8" />
      </Link>

      {/* Center: home + search + theme toggle — desktop only */}
      <div className="absolute inset-y-0 left-1/2 hidden w-[min(560px,calc(100vw-36rem))] min-w-[420px] -translate-x-1/2 items-center justify-center gap-1.5 lg:flex">
        <button
          onClick={goHome}
          className="topbar-control spotify-tooltip-anchor relative flex h-11 min-h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-[9999px] bg-elevated transition-all hover:scale-105 hover:bg-elevated/70"
          aria-label={t('topbar.home')}
          aria-current={isHome ? 'page' : undefined}
        >
          {isHome ? (
            <SpotifyHomeSolidIcon className="h-6 w-6 text-primary" />
          ) : (
            <SpotifyHomeIcon className="h-6 w-6 text-secondary" />
          )}
          <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">{t('topbar.home')}</span>
        </button>

        <div ref={searchContainerRef} className="relative w-full">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 text-secondary" />
          <input
            ref={searchInputRef}
            type="text"
            inputMode="search"
            placeholder={t('topbar.searchPlaceholder')}
            value={searchValue}
            onChange={handleSearch}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setShowSearchPanel(true)}
            className="topbar-search-input h-11 w-full rounded-full border border-transparent bg-elevated pl-12 pr-28 text-[16px] font-normal text-primary transition-colors placeholder:font-normal placeholder:text-secondary hover:border-secondary/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          {/* Right-side controls grouped inside the pill: clear · mic · divider · browse */}
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {searchValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="spotify-tooltip-anchor flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-secondary transition-colors duration-150 hover:text-primary"
                aria-label={t('topbar.clearSearch')}
              >
                <XMarkIcon className="h-4 w-4" />
                <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">{t('topbar.clearSearchField')}</span>
              </button>
            )}
            {/* Voice search — only renders where the Web Speech API exists */}
            <VoiceSearchButton
              onResult={(text) => { setSearchValue(text); submitSearch(text) }}
              className="h-8 w-8 bg-transparent hover:bg-transparent hover:scale-110"
            />
            <div className="h-6 w-px shrink-0 bg-secondary/25" />
            <button
              type="button"
              onClick={handleBrowseClick}
              className={cn(
                'spotify-tooltip-anchor flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 hover:text-primary',
                isBrowse ? 'text-primary' : 'text-secondary',
              )}
              aria-label={t('topbar.browseAll')}
              aria-current={isBrowse ? 'page' : undefined}
            >
              <BrowseTrayIcon filled={isBrowse} />
              <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">{t('topbar.browse')}</span>
            </button>
          </div>
          {searchPanel}
        </div>
      </div>

      {/* Mobile: page title area (spacer) */}
      <div className="flex-1" />

      {/* Free-user account links */}
      {user?.capabilities?.unlimitedPlayback === false && (
        <div className="hidden shrink-0 items-center gap-4 text-sm font-bold text-secondary sm:flex">
          <Link to="/premium" onClick={closeKaraoke} className="transition-colors hover:text-primary">
            {t('topbar.premium')}
          </Link>
          <InstallAppButton className="transition-colors hover:text-primary" />
        </div>
      )}

      {/* Messages — red badge shows unread count */}
      <button
        onClick={() => {
          toggleSocialPanel()
          setShowMenu(false)
        }}
        aria-label={socialBadge > 0 ? `Social (${socialBadge} updates)` : 'Social'}
        aria-pressed={socialPanelOpen}
        className={cn(
          'spotify-tooltip-anchor relative flex h-10 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:scale-105 hover:text-primary active:scale-95',
          socialPanelOpen ? 'text-accent' : 'text-secondary'
        )}
      >
        {socialPanelOpen ? <UserGroupSolid className="h-5 w-5" /> : <UserGroupIcon className="h-5 w-5" />}
        <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">Social</span>
        {socialBadge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white">
            {socialBadge > 9 ? '9+' : socialBadge}
          </span>
        )}
      </button>

      {/* Notifications bell — desktop only */}
      <NotificationBell />

      {/* Friend activity feed toggle — desktop only */}

      {/* Friends panel toggle — desktop only */}

      {/* Right: user menu */}
      <div className="relative">
        <button
          onClick={() => {
            setShowMenu((v) => !v)
            setSocialPanelOpen(false)
          }}
          className="topbar-control flex h-10 w-10 items-center justify-center rounded-full bg-elevated transition-all hover:scale-105 hover:bg-elevated/70 active:scale-95"
          aria-label={t('topbar.userMenu')}
        >
          <Avatar src={user?.avatarUrl} alt={user?.name ?? t('topbar.user')} size="sm" round className="!h-full !w-full text-sm" />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-[990]" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full z-[1000] mt-2 max-h-[calc(100vh-5rem)] w-80 overflow-hidden rounded-md border border-secondary/10 bg-elevated py-2 shadow-2xl">
              <Link
                to="/account"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                {t('topbar.account')}
                <ArrowTopRightOnSquareIcon className={userMenuArrowClass} />
              </Link>
              <Link
                to="/premium"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                {t('topbar.familyPlan')}
                <ArrowTopRightOnSquareIcon className={userMenuArrowClass} />
              </Link>
              <Link
                to="/profile"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                {t('topbar.profile')}
              </Link>
              <Link
                to="/recents"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                {t('topbar.recents')}
              </Link>
              <Link
                to="/support"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                {t('topbar.support')}
                <ArrowTopRightOnSquareIcon className={userMenuArrowClass} />
              </Link>
              <InstallAppMenuItem className={userMenuItemClass} label={t('topbar.download')} onSelect={() => setShowMenu(false)} />
              <Link
                to="/settings"
                onClick={() => setShowMenu(false)}
                className={userMenuItemClass}
              >
                {t('topbar.settings')}
              </Link>
              {/* Theme toggle — moved here from the top bar */}
              <button
                onClick={() => { toggleTheme(); setShowMenu(false) }}
                className={userMenuItemClass}
              >
                {theme === 'dark' ? t('topbar.lightMode') : t('topbar.darkMode')}
              </button>

              <div className="my-1 border-t border-secondary/10" />

              {isArtist && (
                <Link
                  to="/artist-dashboard"
                  onClick={() => setShowMenu(false)}
                  className={userMenuItemClass}
                >
                  {t('topbar.artistDashboard')}
                </Link>
              )}
              {/* No "Admin Dashboard" link here by design — the admin console is
                  reached only via the dedicated /adminlogin entrance. */}
              <button
                onClick={() => {
                  setShowMenu(false)
                  logout()
                }}
                className={userMenuItemClass}
              >
                {t('topbar.logOut')}
              </button>
            </div>
          </>
        )}
      </div>

      <WindowControls />
    </header>
  )
}

function SearchSuggestionsSkeleton() {
  const { t } = useTranslation()
  const label = t('topbar.loadingSearchSuggestions')

  return (
    <div className="px-1 pb-1 pt-1" role="status" aria-label={label}>
      {SEARCH_SKELETON_ROWS.map(([titleWidth, subtitleWidth], index) => (
        <div key={index} className="flex items-center gap-3 px-1.5 py-1.5">
          <span className="search-skeleton-shimmer h-12 w-12 shrink-0 rounded" />
          <span className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className={cn('search-skeleton-shimmer h-4 rounded-full', titleWidth)} />
            <span className={cn('search-skeleton-shimmer h-2.5 rounded-full', subtitleWidth)} />
          </span>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

function SearchSuggestionRow({
  imageUrl,
  fallbackText,
  imageRounded = 'rounded',
  title,
  subtitle,
  onOpen,
  onPlay,
  isActive: _isActive = false,
  isPlaying = false,
  action,
}: {
  imageUrl?: string | null
  fallbackText?: string
  imageRounded?: string
  title: ReactNode
  subtitle: ReactNode
  onOpen: () => void
  onPlay?: (event: React.MouseEvent) => void
  isActive?: boolean
  isPlaying?: boolean
  action?: ReactNode
}) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    onOpen()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none',
        _isActive && 'bg-primary/10',
      )}
    >
      <div className={cn('relative h-12 w-12 shrink-0 overflow-hidden bg-primary/10', imageRounded)}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-150 group-hover:brightness-50"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-normal text-secondary transition-colors group-hover:text-primary">
            {fallbackText ?? <MusicalNoteIcon className="h-5 w-5" />}
          </span>
        )}
        {onPlay && (
          <button
            type="button"
            onClick={onPlay}
            className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/45 text-white opacity-0 transition-opacity duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 group-hover:opacity-100"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <PauseIcon className="h-5 w-5" />
            ) : (
              <PlayIcon className="h-5 w-5 translate-x-[1px]" />
            )}
          </button>
        )}
      </div>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-normal text-primary">{title}</span>
        <span className="block truncate text-xs font-normal text-secondary">{subtitle}</span>
      </span>

      {action}
    </div>
  )
}

function BrowseTrayIcon({ filled = false }: { filled?: boolean }) {
  if (filled) {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8" fill="currentColor">
        <path d="M10.5 6.8A1.3 1.3 0 0 1 11.8 5.5h8.4a1.3 1.3 0 0 1 1.3 1.3V10h-2.45V8h-6.1v2H10.5z" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7.35 11.85h17.3a1.45 1.45 0 0 1 1.43 1.68l-1.58 9.95a2.45 2.45 0 0 1-2.42 2.07H9.92a2.45 2.45 0 0 1-2.42-2.07l-1.58-9.95a1.45 1.45 0 0 1 1.43-1.68Zm5.65 6.9a1.2 1.2 0 0 0 0 2.4h6a1.2 1.2 0 1 0 0-2.4z"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8" fill="none">
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
