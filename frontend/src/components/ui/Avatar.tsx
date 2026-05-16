import { cn } from '@/utils/cn'

interface AvatarProps {
  src: string | null | undefined
  alt: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  round?: boolean
  className?: string
}

export function Avatar({ src, alt, size = 'md', round = false, className }: AvatarProps) {
  const initials = alt
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  }

  return (
    <div
      className={cn(
        'relative flex-shrink-0 bg-elevated flex items-center justify-center font-semibold text-secondary overflow-hidden',
        sizeClasses[size],
        round ? 'rounded-full' : 'rounded-md',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
