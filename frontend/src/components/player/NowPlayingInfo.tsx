import { Link } from 'react-router-dom'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useTranslation } from '@/i18n/useTranslation'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { StarRating } from './StarRating'

export function NowPlayingInfo() {
  const { t } = useTranslation()
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()

  if (!currentTrack) return <div className="w-56" />

  const isLiked = likedTrackIds.has(currentTrack.id)

  const toggleLike = () => {
    if (isLiked) unlikeTrack(currentTrack.id)
    else likeTrack(currentTrack)
  }

  return (
    <div className="flex items-center gap-3 w-56">
      <img
        src={currentTrack.album.coverUrl}
        alt={currentTrack.album.title}
        className="w-14 h-14 rounded object-cover flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <Link
          to={`/album/${currentTrack.album.id}`}
          className="text-sm font-medium text-primary hover:underline truncate block leading-tight"
        >
          {currentTrack.title}
        </Link>
        <Link
          to={`/artist/${currentTrack.artist.id}`}
          className="text-xs text-secondary hover:text-primary hover:underline truncate block leading-tight"
        >
          {currentTrack.artist.name}
        </Link>
        <div className="mt-1 hidden md:block">
          <StarRating track={currentTrack} />
        </div>
      </div>
      <button onClick={toggleLike} aria-label={isLiked ? t('player.unlike') : t('player.like')}>
        <AnimatedLikeIcon liked={isLiked} className="w-4 h-4" heartClassName="w-4 h-4 text-secondary hover:text-primary" />
      </button>
    </div>
  )
}
