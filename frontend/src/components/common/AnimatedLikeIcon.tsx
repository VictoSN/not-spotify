import { PlusCircleIcon } from '@heroicons/react/24/outline'
import { cn } from '@/utils/cn'

interface AnimatedLikeIconProps {
  liked: boolean
  className?: string
  heartClassName?: string
}

export function AnimatedLikeIcon({ liked, className, heartClassName }: AnimatedLikeIconProps) {
  if (liked) {
    return (
      <span
        className={cn('liked-heart-pop relative inline-grid shrink-0 place-items-center align-middle leading-none text-accent', className)}
        aria-hidden="true"
      >
        <span className="liked-heart-particle liked-heart-particle-1" />
        <span className="liked-heart-particle liked-heart-particle-2" />
        <span className="liked-heart-particle liked-heart-particle-3" />
        <span className="liked-heart-particle liked-heart-particle-4" />
        <span className="liked-heart-particle liked-heart-particle-5" />
        <span className="liked-heart-particle liked-heart-particle-6" />
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <circle cx="12" cy="12" r="9.75" fill="currentColor" />
          <path
            d="m8.1 12.15 2.45 2.45 5.35-5.35"
            fill="none"
            stroke="#000"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.25"
          />
        </svg>
      </span>
    )
  }

  return <PlusCircleIcon className={cn('shrink-0 stroke-[2.25] transition-colors', heartClassName ?? className)} />
}
