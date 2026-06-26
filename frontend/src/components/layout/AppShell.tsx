import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomPlayerBar } from './BottomPlayerBar'
import { MobileNav } from './MobileNav'
import { NowPlayingPanel } from '@/components/player/NowPlayingPanel'
import { SocialPanel } from '@/components/friends/SocialPanel'
import { MobileNowPlayingSheet } from '@/components/player/MobileNowPlayingSheet'
import { PictureInPicturePlayer } from '@/components/player/PictureInPicturePlayer'
import { PromoPlayer } from '@/components/player/PromoPlayer'
import { KaraokeView } from '@/components/player/KaraokeView'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useHueStore } from '@/stores/hueStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { AuthPromptModal } from '@/components/common/AuthPromptModal'
import { KeyboardShortcutsHelp } from '@/components/common/KeyboardShortcutsHelp'
import { useFriendPolling } from '@/hooks/useFriendPolling'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useJamSocket } from '@/hooks/useJamSocket'
import { JamBar } from '@/components/jam/JamBar'
import { usePresenceSocket } from '@/hooks/usePresenceSocket'
import { analyticsService } from '@/services/analyticsService'
import { cn } from '@/utils/cn'

export function AppShell() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isNowPlayingOpen = usePlayerStore((s) => s.isNowPlayingOpen)
  const isNowPlayingExpanded = usePlayerStore((s) => s.isNowPlayingExpanded)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTrackId = currentTrack?.id
  const libraryExpanded = useUiStore((s) => s.libraryExpanded)
  const socialPanelOpen = useUiStore((s) => s.socialPanelOpen)
  const isKaraokeOpen = usePlayerStore((s) => s.isKaraokeOpen)
  const setKaraokeOpen = usePlayerStore((s) => s.setKaraokeOpen)
  const karaokeVisible = isKaraokeOpen && !!currentTrack
  const nowPlayingExpandedVisible = isNowPlayingExpanded && !socialPanelOpen && !isMobile && isNowPlayingOpen
  const prevAuth = useRef(isAuthenticated)

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

  // Real-time presence via WebSocket — instant online/offline updates.
  usePresenceSocket()
  // Social data (now-playing, requests, friends list) on a slower poll.
  useFriendPolling()
  // Space/arrows/M/L player shortcuts.
  useKeyboardShortcuts()
  // Listen-along ("Jam") realtime session.
  useJamSocket()

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

      {/* Middle row: floating cards on the base gutter */}
      <div
        className={cn(
          'flex flex-1 px-2 pb-2 min-h-0 overflow-hidden transition-[gap] duration-300 ease-out',
          nowPlayingExpandedVisible ? 'gap-0' : 'gap-2',
        )}
      >
        {!isMobile && <Sidebar takeoverHidden={nowPlayingExpandedVisible} />}

        {/* Expanded library or expanded now-playing takes over the middle row. The main
            card stays mounted and collapses to zero width so the library can smoothly grow
            into it (and reclaim it on minimize) — unmounting here would jump the layout. */}
        <main
          className={cn(
            'min-w-0 rounded-lg bg-page overflow-hidden flex flex-col transition-[flex-basis,flex-grow,opacity,transform] duration-300 ease-out motion-reduce:transition-none',
            nowPlayingExpandedVisible || libraryExpanded
              ? 'pointer-events-none flex-none basis-0 translate-x-3 opacity-0'
              : 'flex-1 basis-0 translate-x-0 opacity-100',
          )}
        >
          {/* Karaoke covers the main card (page stays mounted underneath); rail + bar stay visible */}
          <div
            ref={mainScrollRef}
            onScroll={handleMainScroll}
            className={`flex-1 min-h-0 overflow-y-auto ${karaokeVisible ? 'hidden' : ''}`}
          >
            <Outlet />
          </div>
          {karaokeVisible && (
            <div className="flex-1 min-h-0">
              <KaraokeView />
            </div>
          )}
        </main>

        {/* Right rail on desktop, responsive overlay on smaller screens. */}
        {isAuthenticated && (
          socialPanelOpen ? <SocialPanel /> : !isMobile && isNowPlayingOpen && <NowPlayingPanel />
        )}
      </div>

      {isAuthenticated && <JamBar />}
      {isAuthenticated && <PromoPlayer />}
      {isAuthenticated && <BottomPlayerBar />}
      {isMobile && <MobileNav />}
      {isMobile && isAuthenticated && <MobileNowPlayingSheet />}
      {isAuthenticated && <PictureInPicturePlayer />}
      <AuthPromptModal />
      <KeyboardShortcutsHelp />
    </div>
  )
}
