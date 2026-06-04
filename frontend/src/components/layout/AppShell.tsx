import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomPlayerBar } from './BottomPlayerBar'
import { NowPlayingPanel } from '@/components/player/NowPlayingPanel'
import { usePlayerStore } from '@/stores/playerStore'
import { useIsMobile } from '@/hooks/useMediaQuery'

export function AppShell() {
  const isMobile = useIsMobile()
  const isNowPlayingOpen = usePlayerStore((s) => s.isNowPlayingOpen)

  return (
    <div className="flex flex-col h-screen bg-base text-primary">
      <TopBar />

      {/* Middle row: floating cards on the base gutter */}
      <div className="flex flex-1 gap-2 px-2 pb-2 min-h-0 overflow-hidden">
        {!isMobile && <Sidebar />}

        <main className="flex-1 min-w-0 rounded-lg bg-page overflow-y-auto">
          <Outlet />
        </main>

        {!isMobile && isNowPlayingOpen && <NowPlayingPanel />}
      </div>

      <BottomPlayerBar />
    </div>
  )
}
