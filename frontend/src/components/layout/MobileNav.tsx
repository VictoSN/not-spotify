import { NavLink, useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  MagnifyingGlassIcon,
  QueueListIcon,
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
import { useTranslation } from '@/i18n/useTranslation'

interface NavItem {
  to: string
  labelKey: string
  Icon: React.ComponentType<{ className?: string }>
  IconActive: React.ComponentType<{ className?: string }>
  exact?: boolean
  authOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'topbar.home', Icon: HomeIcon, IconActive: HomeSolid, exact: true },
  { to: '/search', labelKey: 'topbar.search', Icon: MagnifyingGlassIcon, IconActive: SearchSolid },
  { to: '/library', labelKey: 'topbar.library', Icon: RectangleStackIcon, IconActive: LibSolid },
  { to: '/queue', labelKey: 'topbar.queue', Icon: QueueListIcon, IconActive: QueueListIcon },
]

export function MobileNav() {
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <nav
      className="shrink-0 bg-base border-t border-elevated/30 pb-safe"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label={t('topbar.mainNavigation')}
    >
      <div className="flex items-stretch h-14">
        {NAV_ITEMS.map(({ to, labelKey, Icon, IconActive, exact }) => (
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
                <span>{t(labelKey)}</span>
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
          aria-label={isAuthenticated ? t('topbar.profile') : t('topbar.logIn')}
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
          <span>{isAuthenticated ? t('topbar.profile') : t('topbar.logIn')}</span>
        </button>
      </div>
    </nav>
  )
}
