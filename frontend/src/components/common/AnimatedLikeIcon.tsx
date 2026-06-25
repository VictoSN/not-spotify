import { CheckIcon, HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline'
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
        className={cn('liked-heart-pop relative inline-grid shrink-0 place-items-center text-accent', className)}
        aria-hidden="true"
      >
        <span className="liked-heart-particle liked-heart-particle-1" />
        <span className="liked-heart-particle liked-heart-particle-2" />
        <span className="liked-heart-particle liked-heart-particle-3" />
        <span className="liked-heart-particle liked-heart-particle-4" />
        <span className="liked-heart-particle liked-heart-particle-5" />
        <span className="liked-heart-particle liked-heart-particle-6" />
        <HeartSolidIcon className="h-full w-full" />
        <span className="liked-heart-check-inside">
          <CheckIcon className="h-full w-full" />
        </span>
      </span>
    )
  }

  return <HeartOutlineIcon className={cn('shrink-0 transition-colors', heartClassName ?? className)} />
}
