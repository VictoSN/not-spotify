import { MusicalNoteIcon } from '@heroicons/react/24/outline'
import { type ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="text-muted">
        {icon ?? <MusicalNoteIcon className="w-16 h-16" />}
      </div>
      <div>
        <p className="text-primary font-semibold text-lg">{title}</p>
        {description && <p className="text-secondary text-sm mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}
