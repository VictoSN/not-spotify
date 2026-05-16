import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { useState } from 'react'

export function TopBar() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, logout } = useAuthStore()
  const [showMenu, setShowMenu] = useState(false)

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
    else navigate('/search')
  }

  const currentQuery = searchParams.get('q') ?? ''

  return (
    <header className="flex items-center gap-4 px-6 py-3 bg-page/80 backdrop-blur-md sticky top-0 z-20">
      {/* Back / Forward */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-secondary hover:text-primary transition-colors"
          aria-label="Go back"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate(1)}
          className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-secondary hover:text-primary transition-colors"
          aria-label="Go forward"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Search bar */}
      <div className="relative flex-1 max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
        <input
          type="search"
          placeholder="What do you want to listen to?"
          defaultValue={currentQuery}
          onChange={handleSearch}
          onFocus={() => { if (!location.pathname.startsWith('/search')) navigate('/search') }}
          className="w-full bg-elevated text-primary placeholder:text-muted text-sm pl-9 pr-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      {/* User menu */}
      <div className="relative ml-auto">
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="flex items-center gap-2 bg-elevated hover:bg-elevated/80 rounded-full pl-1 pr-3 py-1 transition-colors"
          aria-label="User menu"
        >
          <Avatar src={user?.avatarUrl} alt={user?.name ?? 'User'} size="sm" round />
          <span className="text-sm font-semibold text-primary">{user?.name}</span>
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-44 bg-elevated rounded-md shadow-xl border border-elevated/50 overflow-hidden z-50">
            <button
              onClick={() => { setShowMenu(false); logout() }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-secondary hover:text-primary hover:bg-page/40 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
