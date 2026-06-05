import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomPlayerBar } from './BottomPlayerBar'
import { NowPlayingPanel } from '@/components/player/NowPlayingPanel'
import { PictureInPicturePlayer } from '@/components/player/PictureInPicturePlayer'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { AuthPromptModal } from '@/components/common/AuthPromptModal'

export function AppShell() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isNowPlayingOpen = usePlayerStore((s) => s.isNowPlayingOpen)
  const prevAuth = useRef(isAuthenticated)

  useEffect(() => {
    if (prevAuth.current && !isAuthenticated) {
      navigate('/', { replace: true })
    }
    prevAuth.current = isAuthenticated
  }, [isAuthenticated, navigate])

  return (
    <div className="flex flex-col h-screen bg-base text-primary">
      <TopBar />

      {/* Middle row: floating cards on the base gutter */}
      <div className="flex flex-1 gap-2 px-2 pb-2 min-h-0 overflow-hidden">
        {!isMobile && <Sidebar />}

        <main className="flex-1 min-w-0 rounded-lg bg-page overflow-y-auto">
          <Outlet />
        </main>

        {!isMobile && isAuthenticated && isNowPlayingOpen && <NowPlayingPanel />}
      </div>

      {isAuthenticated && <BottomPlayerBar />}
      {isAuthenticated && <PictureInPicturePlayer />}
      <AuthPromptModal />
    </div>
  )
}
