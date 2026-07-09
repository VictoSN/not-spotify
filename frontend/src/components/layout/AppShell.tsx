import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { OverlayScrollbar } from './OverlayScrollbar'
import { BottomPlayerBar } from './BottomPlayerBar'
import { MobileNav } from './MobileNav'
import { NowPlayingPanel } from '@/components/player/NowPlayingPanel'
import { MusicVideoNowPlayingPanel } from '@/components/player/MusicVideoNowPlayingPanel'
import { selectNowPlayingPanel } from '@/components/player/selectNowPlayingPanel'
import { SocialPanel } from '@/components/friends/SocialPanel'
import { MobileNowPlayingSheet } from '@/components/player/MobileNowPlayingSheet'
import { PictureInPicturePlayer } from '@/components/player/PictureInPicturePlayer'
import { PromoPlayer } from '@/components/player/PromoPlayer'
import { KaraokeView } from '@/components/player/KaraokeView'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useHueStore } from '@/stores/hueStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useRatingStore } from '@/stores/ratingStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { AuthPromptModal } from '@/components/common/AuthPromptModal'
import { KeyboardShortcutsHelp } from '@/components/common/KeyboardShortcutsHelp'
import { useFriendPolling } from '@/hooks/useFriendPolling'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useJamSocket } from '@/hooks/useJamSocket'
import { JamBar } from '@/components/jam/JamBar'
import { AppFooter } from '@/components/common/AppFooter'
import { usePresenceSocket } from '@/hooks/usePresenceSocket'
import { useConnectSocket } from '@/hooks/useConnectSocket'
import { analyticsService } from '@/services/analyticsService'
import { backfillCovers, isTrackSaved } from '@/services/offlineAudio'
import { cn } from '@/utils/cn'
import type { AppShellOutletContext } from './appShellContext'

export function AppShell() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const isHomeRoute = location.pathname === '/'
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const offlineMode = useAuthStore((s) => s.offlineMode)
  const hasCoordinatedPageLoad =
    !offlineMode && (isHomeRoute || /^\/(?:album|artist|track)\/[^/]+\/?$/.test(location.pathname))
  const [pageLoading, setPageLoading] = useState(hasCoordinatedPageLoad)
  const fetchLibrary = useLibraryStore((s) => s.fetchLibrary)
  const loadRatings = useRatingStore((s) => s.loadFromBackend)
  const isNowPlayingOpen = usePlayerStore((s) => s.isNowPlayingOpen)
  const isNowPlayingExpanded = usePlayerStore((s) => s.isNowPlayingExpanded)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const currentVideo = usePlayerStore((s) => s.currentVideo)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTrackId = currentTrack?.id
  const libraryExpanded = useUiStore((s) => s.libraryExpanded)
  const socialPanelOpen = useUiStore((s) => s.socialPanelOpen)
  const isKaraokeOpen = usePlayerStore((s) => s.isKaraokeOpen)
  const setKaraokeOpen = usePlayerStore((s) => s.setKaraokeOpen)
  const karaokeVisible = isKaraokeOpen && !!currentTrack
  const hasCurrentMedia = selectNowPlayingPanel(playbackMode) === 'video' ? !!currentVideo : !!currentTrack
  const showOfflineNowPlaying =
    offlineMode &&
    !isMobile &&
    isNowPlayingOpen &&
    playbackMode === 'audio' &&
    !!currentTrack &&
    isTrackSaved(currentTrack.id)
  const rightRailVisible = isAuthenticated && (!offlineMode || showOfflineNowPlaying)
  const nowPlayingExpandedVisible =
    rightRailVisible &&
    !offlineMode &&
    isNowPlayingExpanded &&
    !socialPanelOpen &&
    !isMobile &&
    isNowPlayingOpen &&
    hasCurrentMedia
  const prevAuth = useRef(isAuthenticated)
  const prevOffline = useRef(false)

  // Offline mode (desktop app started/kept alive with no network): steer to the
  // saved-music page so the user lands on something playable instead of watching
  // network-backed pages spin. Only on entering offline mode / launching offline —
  // not on every navigation, so the user can still move around manually.
  useEffect(() => {
    const onOfflineSafeRoute =
      location.pathname === '/' ||
      location.pathname === '/offline' ||
      location.pathname.startsWith('/settings') ||
      /^\/(?:album|playlist)\/[^/]+\/?$/.test(location.pathname)
    if (offlineMode && !prevOffline.current && !onOfflineSafeRoute) {
      navigate('/', { replace: true })
    }
    prevOffline.current = offlineMode
  }, [offlineMode, navigate, location.pathname])

  // Download any saved-item covers that aren't cached to disk yet (items saved
  // before covers were downloaded, or covers that failed while offline). Runs
  // once on startup and again each time the network returns, so downloads
  // self-heal their artwork without the user having to re-save anything.
  useEffect(() => {
    void backfillCovers()
    const onOnline = () => void backfillCovers()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  // Scroll detection for the main content area — drives the Spotify-style locked
  // header tint (the TopBar picks up the page hue once you scroll past the hero).
  const setHeaderScrolled = useHueStore((s) => s.setHeaderScrolled)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)
  const handleMainScroll = () => {
    const next = (mainScrollRef.current?.scrollTop ?? 0) > 8
    if (next !== scrolledRef.current) {
      scrolledRef.current = next
      setHeaderScrolled(next)
    }
  }
  // Reset the tint whenever the route changes so a new page starts un-tinted
  // (the scroll container is shared and keeps its position across navigations).
  useEffect(() => {
    scrolledRef.current = false
    setHeaderScrolled(false)
  }, [location.pathname, setHeaderScrolled])

  useLayoutEffect(() => {
    setPageLoading(hasCoordinatedPageLoad)
  }, [hasCoordinatedPageLoad, location.pathname])

  useEffect(() => {
    if (!isAuthenticated || offlineMode) return
    void fetchLibrary()
    void loadRatings()
  }, [fetchLibrary, isAuthenticated, loadRatings, offlineMode])

  // Real-time presence via WebSocket — instant online/offline updates.
  usePresenceSocket()
  // Social data (now-playing, requests, friends list) on a slower poll.
  useFriendPolling()
  // Space/arrows/M/L player shortcuts.
  useKeyboardShortcuts()
  // Listen-along ("Jam") realtime session.
  useJamSocket()
  // Spotify-Connect multi-device playback (one active device per account).
  useConnectSocket()

  useEffect(() => {
    if (prevAuth.current && !isAuthenticated) {
      navigate('/', { replace: true })
    }
    prevAuth.current = isAuthenticated
  }, [isAuthenticated, navigate])

  useEffect(() => {
    const path = `${location.pathname}${location.search}`
    analyticsService.recordVisit(path).catch(() => { })
  }, [location.pathname, location.search])

  // Karaoke fills the main card and hides the page underneath; navigating
  // would otherwise leave the lyrics overlay covering the new route. Close it
  // whenever the path changes so navigation is never visually blocked.
  useEffect(() => {
    setKaraokeOpen(false)
  }, [location.pathname, setKaraokeOpen])

  useEffect(() => {
    if (!isAuthenticated || !currentTrackId || !isPlaying) return

    const ping = () => {
      analyticsService.playbackHeartbeat(currentTrackId).catch(() => { })
    }

    ping()
    const intervalId = window.setInterval(ping, 30_000)
    return () => window.clearInterval(intervalId)
  }, [currentTrackId, isAuthenticated, isPlaying])

  return (
    <div className="flex h-full flex-col bg-base text-primary">
      <TopBar />

      {/* Middle row: floating rounded cards on the black base gutter. The top gutter is
          kept minimal (pt-0.5) so the dark band above the cards is essentially just the
          header — otherwise an 8px base-coloured strip below the header reads as part of
          it and makes the centered search bar look like it floats too high. */}
      <div
        className={cn(
          'flex flex-1 min-h-0 overflow-hidden transition-[gap] duration-300 ease-out',
          isMobile ? 'p-0 gap-0' : cn(
            'pb-2 pl-2 pt-0',
            isHomeRoute ? 'pr-0' : 'pr-2',
            nowPlayingExpandedVisible ? 'gap-0' : 'gap-2.5',
          ),
        )}
      >
        {!isMobile && <Sidebar takeoverHidden={nowPlayingExpandedVisible} />}

        {/* Expanded library or expanded now-playing takes over the middle row. The main
            card stays mounted and collapses to zero width so the library can smoothly grow
            into it (and reclaim it on minimize) — unmounting here would jump the layout. */}
        <main
          className={cn(
            'relative min-w-0 bg-page overflow-hidden flex flex-col transition-[flex-basis,flex-grow,opacity,transform] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            isMobile ? 'rounded-none' : 'rounded-xl',
            nowPlayingExpandedVisible || libraryExpanded
              ? 'pointer-events-none flex-none basis-0 translate-x-3 opacity-0'
              : 'flex-1 basis-0 translate-x-0 opacity-100',
          )}
        >
          {/* Karaoke covers the main card (page stays mounted underneath); rail + bar stay visible.
              The native scrollbar is hidden (`scrollbar-hide`) so content fills the full width and
              the home rows run to the very edge; the floating <OverlayScrollbar/> thumb is painted
              on top of that edge instead. `overflow-x-clip` keeps the rows' right bleed from
              producing a horizontal page scrollbar. */}
          <div
            ref={mainScrollRef}
            onScroll={handleMainScroll}
            className={`scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-clip ${karaokeVisible ? 'hidden' : ''}`}
          >
            <Outlet context={{ setPageLoading } satisfies AppShellOutletContext} />
            {/* Global footer — sits at the bottom of every routed page's scroll
                content (Spotify-style), so individual pages don't render their own.
                Hidden on mobile: the Spotify mobile app has no page footer, and it
                just pushes the bottom nav / mini-player far down the scroll. */}
            {!pageLoading && !isMobile && <AppFooter />}
          </div>
          {!karaokeVisible && <OverlayScrollbar scrollRef={mainScrollRef} flushRight={isHomeRoute} />}
          {karaokeVisible && (
            <div className="flex-1 min-h-0">
              <KaraokeView />
            </div>
          )}
        </main>

        {/* Right rail on desktop, responsive overlay on smaller screens. */}
        {rightRailVisible && (
          offlineMode
            ? showOfflineNowPlaying && <NowPlayingPanel offlineOnly />
            : socialPanelOpen ? <SocialPanel /> : !isMobile && isNowPlayingOpen && hasCurrentMedia && (
              selectNowPlayingPanel(playbackMode) === 'video' ? <MusicVideoNowPlayingPanel /> : <NowPlayingPanel />
            )
        )}
      </div>

      {isAuthenticated && <JamBar />}
      {isAuthenticated && <PromoPlayer />}
      {isAuthenticated && <BottomPlayerBar />}
      {isMobile && <MobileNav />}
      {isMobile && isAuthenticated && <MobileNowPlayingSheet />}
      {isAuthenticated && playbackMode !== 'video' && <PictureInPicturePlayer />}
      <AuthPromptModal />
      <KeyboardShortcutsHelp />
    </div>
  )
}
