import { NavLink, useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  MagnifyingGlassIcon,
  RectangleStackIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid,
  MagnifyingGlassIcon as SearchSolid,
  RectangleStackIcon as LibSolid,
  UserCircleIcon as UserSolid,
} from '@heroicons/react/24/solid'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

interface NavItem {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  IconActive: React.ComponentType<{ className?: string }>
  exact?: boolean
  authOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', Icon: HomeIcon, IconActive: HomeSolid, exact: true },
  { to: '/search', label: 'Search', Icon: MagnifyingGlassIcon, IconActive: SearchSolid },
  { to: '/library', label: 'Library', Icon: RectangleStackIcon, IconActive: LibSolid },
]

export function MobileNav() {
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()

  return (
    <nav
      className="shrink-0 bg-base border-t border-elevated/30 pb-safe"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch h-14">
        {NAV_ITEMS.map(({ to, label, Icon, IconActive, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide transition-colors',
                isActive ? 'text-primary' : 'text-secondary',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <IconActive className="w-6 h-6" />
                ) : (
                  <Icon className="w-6 h-6" />
                )}
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Profile / Login tab */}
        <button
          onClick={() => navigate(isAuthenticated ? '/profile' : '/login')}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide transition-colors',
            location.pathname.startsWith('/profile') || location.pathname.startsWith('/account')
              ? 'text-primary'
              : 'text-secondary',
          )}
          aria-label={isAuthenticated ? 'Profile' : 'Log in'}
        >
          {isAuthenticated && user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : location.pathname.startsWith('/profile') || location.pathname.startsWith('/account') ? (
            <UserSolid className="w-6 h-6" />
          ) : (
            <UserCircleIcon className="w-6 h-6" />
          )}
          <span>{isAuthenticated ? 'Profile' : 'Log in'}</span>
        </button>
      </div>
    </nav>
  )
}
