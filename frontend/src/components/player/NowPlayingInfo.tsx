import { Link } from 'react-router-dom'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useTranslation } from '@/i18n/useTranslation'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { StarRating } from './StarRating'

export function NowPlayingInfo() {
  const { t } = useTranslation()
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const currentVideo = usePlayerStore((s) => s.currentVideo)
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()

  if (playbackMode === 'video') {
    if (!currentVideo) return <div className="w-56" />
    return (
      <div className="flex items-center gap-3 w-56">
        <Link to={`/videos/${currentVideo.id}`} className="w-14 h-14 rounded bg-elevated flex-shrink-0 overflow-hidden">
          {currentVideo.thumbnailUrl ? (
            <img
              src={currentVideo.thumbnailUrl}
              alt={currentVideo.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-secondary">MV</div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={`/videos/${currentVideo.id}`}
            className="text-sm font-medium text-primary hover:underline truncate block leading-tight"
          >
            {currentVideo.title}
          </Link>
          <Link
            to={`/artist/${currentVideo.artist.id}`}
            className="text-xs text-secondary hover:text-primary hover:underline truncate block leading-tight"
          >
            {currentVideo.artist.name}
          </Link>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">Music video</p>
        </div>
      </div>
    )
  }

  if (!currentTrack) return <div className="w-56" />

  const isLiked = likedTrackIds.has(currentTrack.id)

  // Podcast episodes adapt to the Track shape but their "artist"/"album" ids are
  // the show id — route both to the show page instead of a non-existent artist.
  const isEpisode = !!currentTrack.podcastId
  const isPrivateUpload = !!currentTrack.isPrivateUpload
  const titleTo = isEpisode ? `/podcasts/${currentTrack.podcastId}` : `/album/${currentTrack.album.id}`
  const creatorTo = isEpisode ? `/podcasts/${currentTrack.podcastId}` : `/artist/${currentTrack.artist.id}`

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
        {isPrivateUpload ? (
          <>
            <p className="text-sm font-medium text-primary truncate leading-tight">{currentTrack.title}</p>
            <p className="text-xs text-secondary truncate leading-tight">{currentTrack.artist.name}</p>
          </>
        ) : (
          <>
            <Link to={titleTo} className="text-sm font-medium text-primary hover:underline truncate block leading-tight">{currentTrack.title}</Link>
            <Link to={creatorTo} className="text-xs text-secondary hover:text-primary hover:underline truncate block leading-tight">{currentTrack.artist.name}</Link>
          </>
        )}
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
