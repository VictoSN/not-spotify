import { Link } from 'react-router-dom'
import { ChevronDownIcon, HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { PlayerControls } from './PlayerControls'
import { ProgressBar } from './ProgressBar'
import { TrackRowMenu } from '@/components/cards/TrackRowMenu'
import { useDominantColor } from '@/hooks/useDominantColor'
import { TrackCard } from '@/components/cards/TrackCard'

export function MobileNowPlayingSheet() {
  const { currentTrack, isNowPlayingOpen, toggleNowPlaying, queue, queueIndex } = usePlayerStore()
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const heroColor = useDominantColor(currentTrack?.album.coverUrl)
  const isLiked = currentTrack ? likedTrackIds.has(currentTrack.id) : false

  const toggleLike = () => {
    if (!currentTrack || !isAuthenticated) return
    if (isLiked) unlikeTrack(currentTrack.id)
    else likeTrack(currentTrack)
  }

  if (!isNowPlayingOpen || !currentTrack) return null

  const upNext = queueIndex >= 0 ? queue.slice(queueIndex + 1, queueIndex + 6) : []

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-page overflow-hidden">
      {/* Colour gradient from cover art */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70"
        style={{
          background: heroColor
            ? `linear-gradient(180deg, ${heroColor}cc 0%, transparent 100%)`
            : 'linear-gradient(180deg, var(--c-accent-dim) 0%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pb-2" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <button
          onClick={toggleNowPlaying}
          className="flex items-center justify-center w-10 h-10 rounded-full text-secondary hover:text-primary active:scale-95 transition-all"
          aria-label="Close now playing"
        >
          <ChevronDownIcon className="w-6 h-6" />
        </button>
        <div className="text-center min-w-0 flex-1 px-2">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider truncate">
            Now Playing
          </p>
        </div>
        <TrackRowMenu track={currentTrack} alwaysVisible />
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-6">
        {/* Album art */}
        <div className="flex justify-center mb-8 mt-4">
          <Link to={`/album/${currentTrack.album.id}`} onClick={toggleNowPlaying}>
            <img
              src={currentTrack.album.coverUrl}
              alt={currentTrack.album.title}
              className="w-64 h-64 sm:w-72 sm:h-72 rounded-xl shadow-2xl object-cover"
            />
          </Link>
        </div>

        {/* Track info + like */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            <Link
              to={`/album/${currentTrack.album.id}`}
              onClick={toggleNowPlaying}
              className="block text-2xl font-black text-primary truncate hover:underline"
            >
              {currentTrack.title}
            </Link>
            <Link
              to={`/artist/${currentTrack.artist.id}`}
              onClick={toggleNowPlaying}
              className="block text-base text-secondary truncate hover:text-primary hover:underline mt-0.5"
            >
              {currentTrack.artist.name}
            </Link>
          </div>
          <button
            onClick={toggleLike}
            className="shrink-0 mt-1 p-1 transition-transform active:scale-90"
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            {isLiked
              ? <HeartSolid className="w-7 h-7 text-accent" />
              : <HeartIcon className="w-7 h-7 text-secondary hover:text-primary transition-colors" />
            }
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <ProgressBar />
        </div>

        {/* Player controls */}
        <div className="flex justify-center mb-8">
          <div className="w-full max-w-xs">
            <PlayerControls />
          </div>
        </div>

        {/* Up next */}
        {upNext.length > 0 && (
          <div className="mt-4">
            <h3 className="text-base font-bold text-primary mb-3">Next up</h3>
            <div className="flex flex-col gap-1">
              {upNext.map((track) => (
                <TrackCard key={track.id} track={track} queue={queue} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
