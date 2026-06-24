import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
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
        className={cn(
          'liked-heart-pop relative inline-grid shrink-0 place-items-center text-accent',
          className,
        )}
        aria-hidden="true"
      >
        <span className="like-particle like-particle-1" />
        <span className="like-particle like-particle-2" />
        <span className="like-particle like-particle-3" />
        <span className="like-particle like-particle-4" />
        <span className="like-particle like-particle-5" />
        <span className="like-particle like-particle-6" />
        <HeartSolidIcon className="relative z-10 h-full w-full drop-shadow-[0_0_4px_rgba(30,215,96,0.35)]" />
      </span>
    )
  }

  return <HeartOutlineIcon className={cn('shrink-0 transition-colors', heartClassName ?? className)} />
}
