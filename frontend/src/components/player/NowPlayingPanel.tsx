import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeartIcon, ChevronLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid, CheckBadgeIcon } from '@heroicons/react/24/solid'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { artistService } from '@/services/artistService'
import { albumService } from '@/services/albumService'
import { TrackCard } from '@/components/cards/TrackCard'
import { TrackRowMenu } from '@/components/cards/TrackRowMenu'
import { Spinner } from '@/components/ui/Spinner'
import { formatNumber } from '@/utils/formatNumber'
import { useDominantColor } from '@/hooks/useDominantColor'
import { cn } from '@/utils/cn'

const NP_KEY = 'ns-nowplaying-width'
const NP_DEFAULT = 320
const NP_MIN = 280
const NP_MAX = 460

function getInitialNpWidth(): number {
  if (typeof window === 'undefined') return NP_DEFAULT
  const stored = Number(window.localStorage.getItem(NP_KEY))
  if (!stored || Number.isNaN(stored)) return NP_DEFAULT
  return Math.min(Math.max(stored, NP_MIN), NP_MAX)
}

function NowPlayingDragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group absolute top-0 left-0 h-full w-2 cursor-col-resize z-20 flex justify-center"
      aria-hidden="true"
    >
      <div className="w-px h-full bg-transparent group-hover:bg-accent/50 transition-colors" />
    </div>
  )
}

function PanelSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pb-4">
      <h3 className="text-base font-bold text-primary">{title}</h3>
      {subtitle && <p className="text-xs text-secondary mb-2">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-2'}>{children}</div>
    </section>
  )
}

type ArtistData = { artistId: string; artist: Artist | null; related: Track[] }
type AlbumData = { albumId: string; album: Album | null }

export function NowPlayingPanel() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const isNowPlayingCollapsed = usePlayerStore((s) => s.isNowPlayingCollapsed)
  const setNowPlayingCollapsed = usePlayerStore((s) => s.setNowPlayingCollapsed)

  const { likedTrackIds, likeTrack, unlikeTrack, followedArtistIds, followArtist, unfollowArtist } = useLibraryStore()

  const [artistData, setArtistData] = useState<ArtistData | null>(null)
  const [albumData, setAlbumData] = useState<AlbumData | null>(null)

  // Resizable width — drag the left edge.
  const [width, setWidth] = useState(getInitialNpWidth)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  useEffect(() => {
    window.localStorage.setItem(NP_KEY, String(width))
  }, [width])
  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: width }
    setDragging(true)
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startX - e.clientX // dragging left widens the panel
      setWidth(Math.min(Math.max(dragRef.current.startW + delta, NP_MIN), NP_MAX))
    }
    const onUp = () => setDragging(false)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const artistId = currentTrack?.artist.id
  const albumId = currentTrack?.album.id

  // Fetch artist details + related tracks whenever the playing track's artist changes.
  useEffect(() => {
    if (!artistId) return
    let cancelled = false
    Promise.all([artistService.getById(artistId), artistService.getTopTracks(artistId, 8)])
      .then(([artist, related]) => {
        if (!cancelled) setArtistData({ artistId, artist, related })
      })
      .catch(() => {
        if (!cancelled) setArtistData({ artistId, artist: null, related: [] })
      })
    return () => {
      cancelled = true
    }
  }, [artistId])

  // Fetch the album for credits (label / copyright).
  useEffect(() => {
    if (!albumId) return
    let cancelled = false
    albumService
      .getById(albumId)
      .then((album) => !cancelled && setAlbumData({ albumId, album }))
      .catch(() => !cancelled && setAlbumData({ albumId, album: null }))
    return () => {
      cancelled = true
    }
  }, [albumId])

  // Derive from the fetched data so a previous track's artist/album never lingers.
  const artistReady = !!artistData && artistData.artistId === artistId
  const artist = artistData && artistData.artistId === artistId ? artistData.artist : null
  const related = artistData && artistData.artistId === artistId ? artistData.related : []
  const loadingArtist = !!artistId && !artistReady
  const album = albumData && albumData.albumId === albumId ? albumData.album : null
  const heroColor = useDominantColor(currentTrack?.album.coverUrl)
  const panelClass = cn(
    'relative hidden shrink-0 flex-col overflow-hidden rounded-lg bg-surface lg:flex',
    !dragging && 'transition-[width,opacity,transform] duration-300 ease-out',
  )

  // Collapsed → thin sliver with an expand control (does not fully close).
  if (isNowPlayingCollapsed) {
    return (
      <aside className="group/now-playing-rail relative hidden w-4 shrink-0 overflow-hidden rounded-lg bg-surface/0 transition-[width,background-color] duration-300 ease-out hover:w-16 hover:bg-surface/80 lg:flex">
        <button
          onClick={() => setNowPlayingCollapsed(false)}
          className="absolute inset-y-0 left-0 flex w-full flex-col items-center justify-center gap-4 text-secondary opacity-0 transition-all duration-200 hover:text-primary group-hover/now-playing-rail:opacity-100"
          aria-label="Expand now playing"
          title="Expand now playing"
        >
          {currentTrack && (
            <img
              src={currentTrack.album.coverUrl}
              alt={currentTrack.album.title}
              className="h-10 w-10 rounded object-cover opacity-80 shadow-lg"
            />
          )}
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      </aside>
    )
  }

  if (!currentTrack) {
    return (
      <aside style={{ width }} className={panelClass}>
        <div className="flex items-center justify-between p-4">
          <h2 className="text-base font-bold text-primary">Now playing</h2>
          <button
            onClick={() => setNowPlayingCollapsed(true)}
            className="rounded-full p-1 text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
            aria-label="Collapse now playing"
            title="Collapse now playing"
          >
            <ChevronDoubleRightIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="px-4 text-sm text-secondary">
          Play a song to see what's playing, related tracks and artist info here.
        </p>
        <NowPlayingDragHandle onMouseDown={onDragStart} />
      </aside>
    )
  }

  const isLiked = likedTrackIds.has(currentTrack.id)
  const toggleLike = () => (isLiked ? unlikeTrack(currentTrack.id) : likeTrack(currentTrack))

  const relatedTracks = related.filter((t) => t.id !== currentTrack.id).slice(0, 5)
  const upNext = queueIndex >= 0 ? queue.slice(queueIndex + 1) : []

  const isFollowing = artist ? followedArtistIds.has(artist.id) : false
  const toggleFollow = () => {
    if (!artist) return
    if (isFollowing) unfollowArtist(artist.id)
    else followArtist(artist)
  }

  return (
    <aside style={{ width }} className={panelClass}>
      <div className="relative flex-1 overflow-y-auto">
        {/* Dynamic colour hue from the cover */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-80 transition-opacity duration-700"
          style={{
            background: heroColor
              ? `linear-gradient(180deg, ${heroColor}b3 0%, ${heroColor}26 50%, transparent 100%)`
              : undefined,
          }}
        />
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-surface/80 backdrop-blur">
          <Link
            to={`/album/${currentTrack.album.id}`}
            className="text-base font-bold text-primary truncate hover:underline"
          >
            {currentTrack.album.title}
          </Link>
          <button
            onClick={() => setNowPlayingCollapsed(true)}
            className="ml-2 shrink-0 rounded-full p-1 text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
            aria-label="Collapse now playing"
            title="Collapse now playing"
          >
            <ChevronDoubleRightIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Cover + title */}
        <div className="px-4 pb-4">
          <img
            src={currentTrack.album.coverUrl}
            alt={currentTrack.album.title}
            className="w-full aspect-square rounded-lg object-cover shadow-lg"
          />
          <div className="flex items-start justify-between gap-2 mt-4">
            <div className="min-w-0">
              <Link
                to={`/album/${currentTrack.album.id}`}
                className="block text-xl font-bold text-primary truncate hover:underline"
              >
                {currentTrack.title}
              </Link>
              <Link
                to={`/artist/${currentTrack.artist.id}`}
                className="block text-sm text-secondary truncate hover:text-primary hover:underline"
              >
                {currentTrack.artist.name}
              </Link>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={toggleLike} className="mt-1" aria-label={isLiked ? 'Unlike' : 'Like'}>
                {isLiked ? (
                  <HeartSolid className="w-6 h-6 text-accent" />
                ) : (
                  <HeartIcon className="w-6 h-6 text-secondary hover:text-primary transition-colors" />
                )}
              </button>
              <TrackRowMenu track={currentTrack} alwaysVisible />
            </div>
          </div>
        </div>

        {/* Related / recommended */}
        {relatedTracks.length > 0 && (
          <PanelSection title="Recommended" subtitle="Based on this song">
            <div className="flex flex-col gap-1">
              {relatedTracks.map((track) => (
                <TrackCard key={track.id} track={track} queue={related} />
              ))}
            </div>
          </PanelSection>
        )}

        {/* About the artist */}
        {loadingArtist ? (
          <div className="flex justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : (
          artist && (
            <PanelSection title="About the artist">
              <div className="relative rounded-lg overflow-hidden bg-elevated">
                {(artist.headerImageUrl || artist.imageUrl) && (
                  <img
                    src={artist.headerImageUrl ?? artist.imageUrl ?? ''}
                    alt={artist.name}
                    className="w-full h-40 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-1.5">
                    <Link to={`/artist/${artist.id}`} className="font-bold text-primary hover:underline">
                      {artist.name}
                    </Link>
                    {artist.verified && <CheckBadgeIcon className="w-4 h-4 text-accent" />}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-secondary">{formatNumber(artist.monthlyListeners)} monthly listeners</p>
                    <button
                      onClick={toggleFollow}
                      className="text-xs font-semibold rounded-full border border-secondary/60 text-primary px-3 py-1 hover:border-primary transition-colors"
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                  {artist.bio && (
                    <p className="text-sm text-secondary mt-3 line-clamp-4 leading-relaxed">{artist.bio}</p>
                  )}
                </div>
              </div>
            </PanelSection>
          )
        )}

        {/* Credits */}
        <PanelSection title="Credits">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <Link
                  to={`/artist/${currentTrack.artist.id}`}
                  className="block text-sm font-medium text-primary truncate hover:underline"
                >
                  {currentTrack.artist.name}
                </Link>
                <p className="text-xs text-secondary">Main Artist</p>
              </div>
              {artist && (
                <button
                  onClick={toggleFollow}
                  className="text-xs font-semibold rounded-full border border-secondary/60 text-primary px-3 py-1 hover:border-primary transition-colors shrink-0"
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            {album?.label && (
              <div>
                <p className="text-sm font-medium text-primary truncate">{album.label}</p>
                <p className="text-xs text-secondary">Label</p>
              </div>
            )}
            {album?.copyright && <p className="text-xs text-muted leading-relaxed">{album.copyright}</p>}
          </div>
        </PanelSection>

        {/* Next in queue */}
        <PanelSection title="Next in queue">
          {upNext.length > 0 ? (
            <div className="flex flex-col gap-1">
              {upNext.slice(0, 10).map((track, i) => (
                <TrackCard key={`${track.id}-${i}`} track={track} queue={queue} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary">Nothing queued up next.</p>
          )}
        </PanelSection>
      </div>
      <NowPlayingDragHandle onMouseDown={onDragStart} />
    </aside>
  )
}
