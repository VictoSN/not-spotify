import { useEffect, useState } from 'react'
import { useRatingStore } from '@/stores/ratingStore'
import type { Track } from '@/types/track'

interface StarRatingProps {
  track: Track
}

export function StarRating({ track }: StarRatingProps) {
  const { getMyRating, setRating, getAggregate, seedAggregate } = useRatingStore()
  const [hovered, setHovered] = useState(0)

  // Seed aggregate from track DTO on mount / when track changes
  useEffect(() => {
    seedAggregate(track.id, track.ratingCount ?? 0, track.averageRating ?? 0)
  }, [track.id, track.ratingCount, track.averageRating, seedAggregate])

  const myRating = getMyRating(track.id)
  const { ratingCount, averageRating } = getAggregate(track.id)
  const display = hovered || myRating

  return (
    <div className="flex items-center gap-2">
      {/* Stars */}
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHovered(0)}
        aria-label={`Rate this song. Your rating: ${myRating} of 5`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(track.id, star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className="group transition-transform hover:scale-125 active:scale-95"
          >
            <StarIcon
              filled={star <= display}
              className={`w-4 h-4 transition-colors duration-100 ${
                star <= display
                  ? 'text-accent'
                  : 'text-secondary/40 group-hover:text-secondary'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Aggregate */}
      {ratingCount > 0 && (
        <span className="text-xs text-secondary whitespace-nowrap">
          {averageRating.toFixed(1)} <span className="text-secondary/50">({ratingCount})</span>
        </span>
      )}
    </div>
  )
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
