import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomPlayerBar } from './BottomPlayerBar'
import { useIsMobile } from '@/hooks/useMediaQuery'

export function AppShell() {
  const isMobile = useIsMobile()
  const [sidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-page">
      {/* Sidebar */}
      {!isMobile && (
        <Sidebar collapsed={sidebarCollapsed} />
      )}

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-24">
          <Outlet />
        </main>
      </div>

      {/* Fixed bottom player */}
      <BottomPlayerBar />
    </div>
  )
}
