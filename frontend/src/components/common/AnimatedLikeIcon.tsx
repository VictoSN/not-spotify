import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
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
        className={cn('liked-heart-pop relative inline-grid shrink-0 place-items-center align-middle leading-none text-red-500', className)}
        aria-hidden="true"
      >
        <span className="liked-heart-particle liked-heart-particle-1" />
        <span className="liked-heart-particle liked-heart-particle-2" />
        <span className="liked-heart-particle liked-heart-particle-3" />
        <span className="liked-heart-particle liked-heart-particle-4" />
        <span className="liked-heart-particle liked-heart-particle-5" />
        <span className="liked-heart-particle liked-heart-particle-6" />
        <HeartSolidIcon className="h-full w-full" />
      </span>
    )
  }

  return <HeartOutlineIcon className={cn('shrink-0 stroke-[2.4] transition-colors', heartClassName ?? className)} />
}
