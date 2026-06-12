import { Link } from 'react-router-dom'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  href?: string
}

export function SectionHeader({ title, subtitle, href }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-xl font-bold text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {href && (
        <Link to={href} className="text-xs font-semibold text-secondary hover:text-primary uppercase tracking-wider transition-colors">
          Show all
        </Link>
      )}
    </div>
  )
}
