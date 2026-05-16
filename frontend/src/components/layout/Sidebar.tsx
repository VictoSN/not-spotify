import { NavLink, Link } from 'react-router-dom'
import {
  HomeIcon,
  MagnifyingGlassIcon,
  BookmarkSquareIcon,
  PlusCircleIcon,
  MusicalNoteIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid,
  MagnifyingGlassIcon as SearchSolid,
} from '@heroicons/react/24/solid'
import { useLibraryStore } from '@/stores/libraryStore'
import { cn } from '@/utils/cn'

interface SidebarProps {
  collapsed?: boolean
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const { savedPlaylists, createPlaylist } = useLibraryStore()

  const handleCreatePlaylist = async () => {
    const name = `My Playlist #${savedPlaylists.length + 1}`
    await createPlaylist(name)
  }

  const navItem = (to: string, label: string, Icon: React.ElementType, ActiveIcon: React.ElementType) => (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
          isActive ? 'text-primary' : 'text-secondary hover:text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? <ActiveIcon className="w-5 h-5 flex-shrink-0" /> : <Icon className="w-5 h-5 flex-shrink-0" />}
          {!collapsed && <span className="font-semibold text-sm">{label}</span>}
        </>
      )}
    </NavLink>
  )

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar py-2 overflow-hidden transition-all',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <Link to="/" className="px-5 py-4 mb-1 flex items-center gap-2">
        <MusicalNoteIcon className="w-7 h-7 text-accent flex-shrink-0" />
        {!collapsed && <span className="font-bold text-lg text-primary">not-spotify</span>}
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-2">
        {navItem('/', 'Home', HomeIcon, HomeSolid)}
        {navItem('/search', 'Search', MagnifyingGlassIcon, SearchSolid)}
        {navItem('/library', 'Library', BookmarkSquareIcon, BookmarkSquareIcon)}
      </nav>

      {/* Library */}
      <div className="mt-4 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-5 mb-2">
          {!collapsed && <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Your Library</span>}
          <button
            onClick={handleCreatePlaylist}
            className="text-secondary hover:text-primary transition-colors"
            aria-label="Create playlist"
          >
            <PlusCircleIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {savedPlaylists.map((playlist) => (
            <NavLink
              key={playlist.id}
              to={`/playlist/${playlist.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                  isActive ? 'bg-elevated' : 'hover:bg-elevated/50',
                )
              }
            >
              <div className="w-9 h-9 rounded flex-shrink-0 overflow-hidden bg-elevated">
                {playlist.coverUrl ? (
                  <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm">🎵</div>
                )}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{playlist.name}</p>
                  <p className="text-xs text-secondary">Playlist</p>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </aside>
  )
}
