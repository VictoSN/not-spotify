import { Link } from 'react-router-dom'

interface SectionHeaderProps {
  title: string
  href?: string
}

export function SectionHeader({ title, href }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-primary">{title}</h2>
      {href && (
        <Link to={href} className="text-xs font-semibold text-secondary hover:text-primary uppercase tracking-wider transition-colors">
          Show all
        </Link>
      )}
    </div>
  )
}
