import { Link } from 'react-router-dom'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { PlayerControls } from './PlayerControls'
import { ProgressBar } from './ProgressBar'
import { TrackRowMenu } from '@/components/cards/TrackRowMenu'
import { useDominantColor, withAlpha } from '@/hooks/useDominantColor'
import { TrackCard } from '@/components/cards/TrackCard'
import { NowPlayingLyrics } from './NowPlayingLyrics'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { TrackArtwork } from './TrackArtwork'

export function MobileNowPlayingSheet() {
  const { currentTrack, isMobileNowPlayingOpen, setMobileNowPlayingOpen, queue, queueIndex } = usePlayerStore()
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const heroColor = useDominantColor(currentTrack?.album.coverUrl)
  const isLiked = currentTrack ? likedTrackIds.has(currentTrack.id) : false
  const isPrivateUpload = !!currentTrack?.isPrivateUpload

  const toggleLike = () => {
    if (!currentTrack || !isAuthenticated) return
    if (isLiked) unlikeTrack(currentTrack.id)
    else likeTrack(currentTrack)
  }

  if (!isMobileNowPlayingOpen || !currentTrack) return null

  const upNext = queueIndex >= 0 ? queue.slice(queueIndex + 1, queueIndex + 6) : []
  const closeNowPlaying = () => setMobileNowPlayingOpen(false)

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-page overflow-hidden">
      {/* Colour gradient from cover art */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70"
        style={{
          background: heroColor
            ? `linear-gradient(180deg, ${withAlpha(heroColor, 0.8)} 0%, transparent 100%)`
            : 'linear-gradient(180deg, var(--c-accent-dim) 0%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pb-2" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <button
          onClick={closeNowPlaying}
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

      {/* Scrollable content — a single centered column so the artwork, controls,
          lyrics and up-next all share the same width and midline (Spotify-style). */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-6 pb-6">
        {/* Album art */}
        <div className="flex justify-center mb-8 mt-4">
          {isPrivateUpload ? (
            <TrackArtwork track={currentTrack} className="w-64 h-64 sm:w-72 sm:h-72 rounded-xl shadow-2xl object-cover" />
          ) : (
          <Link to={`/album/${currentTrack.album.id}`} onClick={closeNowPlaying}>
            <img
              src={currentTrack.album.coverUrl}
              alt={currentTrack.album.title}
              className="w-64 h-64 sm:w-72 sm:h-72 rounded-xl shadow-2xl object-cover"
            />
          </Link>
          )}
        </div>

        {/* Track info + like */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            {isPrivateUpload ? (
              <><p className="block text-2xl font-black text-primary truncate">{currentTrack.title}</p><p className="block text-base text-secondary truncate mt-0.5">{currentTrack.artist.name}</p></>
            ) : (
              <><Link to={`/album/${currentTrack.album.id}`} onClick={closeNowPlaying} className="block text-2xl font-black text-primary truncate hover:underline">{currentTrack.title}</Link><Link to={`/artist/${currentTrack.artist.id}`} onClick={closeNowPlaying} className="block text-base text-secondary truncate hover:text-primary hover:underline mt-0.5">{currentTrack.artist.name}</Link></>
            )}
          </div>
          <button
            onClick={toggleLike}
            className="shrink-0 mt-1 p-1 transition-transform active:scale-90"
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <AnimatedLikeIcon liked={isLiked} className="w-7 h-7" heartClassName="w-7 h-7 text-secondary hover:text-primary" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <ProgressBar />
        </div>

        {/* Player controls — PlayerControls is a fixed-width grid, so it must be
            centered directly (a wider max-width wrapper would leave it left-aligned). */}
        <div className="flex justify-center mb-8">
          <PlayerControls />
        </div>

        {/* Lyrics (karaoke-synced when the track has timed lyrics) */}
        <div className="mb-4">
          <NowPlayingLyrics track={currentTrack} accentColor={heroColor} />
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
