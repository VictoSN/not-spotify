import { cn } from '@/utils/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  // Full-page loading is coordinated by the shell so content appears as one
  // complete view. Keep compact action indicators, but never paint the large
  // circular loader over an otherwise empty page.
  if (size === 'lg') return null

  return (
    <div
      className={cn(
        'border-2 border-secondary/20 border-t-accent rounded-full animate-spin',
        { 'w-4 h-4': size === 'sm', 'w-8 h-8': size === 'md' },
        className,
      )}
    />
  )
}
