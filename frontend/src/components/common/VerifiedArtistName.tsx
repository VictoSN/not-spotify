import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { cn } from '@/utils/cn'

interface VerifiedArtistNameProps {
  name: string
  verified?: boolean
  className?: string
  iconClassName?: string
}

export function VerifiedArtistName({
  name,
  verified = false,
  className,
  iconClassName,
}: VerifiedArtistNameProps) {
  return (
    <span className={cn('inline-flex max-w-full min-w-0 items-center gap-1 align-middle', className)}>
      <span className="min-w-0 truncate">{name}</span>
      {verified && (
        <CheckBadgeIcon
          className={cn('h-4 w-4 shrink-0 text-accent', iconClassName)}
          role="img"
          aria-label="Verified artist"
        />
      )}
    </span>
  )
}
