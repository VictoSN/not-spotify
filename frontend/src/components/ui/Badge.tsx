import { type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'accent' | 'outline'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        {
          'bg-elevated text-secondary': variant === 'default',
          'bg-accent/20 text-accent': variant === 'accent',
          'border border-secondary/30 text-secondary': variant === 'outline',
        },
        className,
      )}
    >
      {children}
    </span>
  )
}
