import { Link } from 'react-router-dom'
import { useTranslation } from '@/i18n/useTranslation'
import { cn } from '@/utils/cn'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  href?: string
  variant?: 'default' | 'home'
}

export function SectionHeader({ title, subtitle, href, variant = 'default' }: SectionHeaderProps) {
  const { t } = useTranslation()
  const home = variant === 'home'

  return (
    <div className={cn('flex items-center justify-between', home ? 'mb-2' : 'mb-4')}>
      <div className="min-w-0">
        <h2 className={cn('truncate text-primary', home ? 'text-2xl font-bold leading-7' : 'text-xl font-bold')}>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {href && (
        <Link
          to={href}
          className="shrink-0 text-xs font-semibold uppercase tracking-wider text-secondary transition-colors hover:text-primary"
        >
          {t('common.showAll')}
        </Link>
      )}
    </div>
  )
}
