import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronDoubleRightIcon,
  Bars3Icon,
  ArrowsPointingOutIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { CollapseIcon } from '@/components/common/CollapseIcon'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import type { Artist, TourDate } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import type { MusicVideo } from '@/types/musicVideo'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { artistService } from '@/services/artistService'
import { albumService } from '@/services/albumService'
import { videoService } from '@/services/videoService'
import { TrackCard } from '@/components/cards/TrackCard'
import { TrackRowMenu } from '@/components/cards/TrackRowMenu'
import { ArtistBioDialog } from '@/components/common/ArtistBioDialog'
import { NowPlayingLyrics } from '@/components/player/NowPlayingLyrics'
import { Spinner } from '@/components/ui/Spinner'
import { formatNumber } from '@/utils/formatNumber'
import { useDominantColor, withAlpha } from '@/hooks/useDominantColor'
import { useTranslation } from '@/i18n/useTranslation'
import { cn } from '@/utils/cn'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'

const NP_KEY = 'ns-nowplaying-width'
const NP_DEFAULT = 320
const NP_MIN = 280
const NP_MAX = 460
const NP_WIDE_THRESHOLD = NP_MAX - 8

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
      className="group absolute top-0 left-0 h-full w-2 cursor-grab active:cursor-grabbing z-20 flex justify-center"
      aria-hidden="true"
    >
      <div className="w-px h-full bg-transparent group-hover:bg-secondary/60 transition-colors" />
    </div>
  )
}

function DiagonalExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path
        d="M16.6 5.6h2.2v2.2M18.8 5.6l-4.5 4.5M7.4 18.4H5.2v-2.2M5.2 18.4l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DiagonalCollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path
        d="M18.6 5.4l-4.4 4.4M14.2 7.6v2.2h2.2M5.4 18.6l4.4-4.4M7.6 14.2h2.2v2.2"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
type VideoData = { trackId: string; video: MusicVideo | null }
type ArtistVideosData = { artistId: string; videos: MusicVideo[] }
type TourData = { artistId: string; dates: TourDate[] }

export function NowPlayingPanel() {
  const { t } = useTranslation()
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const reorderQueue = usePlayerStore((s) => s.reorderQueue)
  const isNowPlayingCollapsed = usePlayerStore((s) => s.isNowPlayingCollapsed)
  const setNowPlayingCollapsed = usePlayerStore((s) => s.setNowPlayingCollapsed)
  const isNowPlayingExpanded = usePlayerStore((s) => s.isNowPlayingExpanded)
  const setNowPlayingExpanded = usePlayerStore((s) => s.setNowPlayingExpanded)
  const isPremium = useAuthStore((s) => s.user?.capabilities?.unlimitedPlayback !== false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const { likedTrackIds, likeTrack, unlikeTrack, followedArtistIds, followArtist, unfollowArtist } = useLibraryStore()

  const [artistData, setArtistData] = useState<ArtistData | null>(null)
  const [albumData, setAlbumData] = useState<AlbumData | null>(null)
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [artistVideosData, setArtistVideosData] = useState<ArtistVideosData | null>(null)
  const [tourData, setTourData] = useState<TourData | null>(null)
  const [artistBioOpen, setArtistBioOpen] = useState(false)
  const [videoHover, setVideoHover] = useState(false)
  const [expandedScroll, setExpandedScroll] = useState(0)
  const panelRef = useRef<HTMLElement | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const creditsRef = useRef<HTMLDivElement | null>(null)

  // Resizable width — drag the left edge.
  const [width, setWidth] = useState(getInitialNpWidth)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  useEffect(() => {
    window.localStorage.setItem(NP_KEY, String(width))
  }, [width])
  const onDragStart = (e: React.MouseEvent) => {
    if (isNowPlayingExpanded) return
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
  const isWide = isNowPlayingExpanded || width >= NP_WIDE_THRESHOLD
  const toggleWide = () => {
    if (isNowPlayingExpanded) {
      setNowPlayingExpanded(false)
      setWidth(NP_DEFAULT)
    } else {
      setNowPlayingExpanded(true)
    }
  }
  const scrollToCredits = () => creditsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const artistId = currentTrack?.artist.id
  const albumId = currentTrack?.album.id

  useEffect(() => {
    setArtistBioOpen(false)
  }, [artistId])

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

  useEffect(() => {
    if (!artistId) {
      setArtistVideosData(null)
      setTourData(null)
      return
    }
    let cancelled = false

    videoService
      .list()
      .then((videos) => {
        if (!cancelled) {
          setArtistVideosData({
            artistId,
            videos: videos.filter((item) => item.artist.id === artistId),
          })
        }
      })
      .catch(() => {
        if (!cancelled) setArtistVideosData({ artistId, videos: [] })
      })

    artistService
      .getTourDates(artistId)
      .then((dates) => {
        if (!cancelled) setTourData({ artistId, dates })
      })
      .catch(() => {
        if (!cancelled) setTourData({ artistId, dates: [] })
      })

    return () => {
      cancelled = true
    }
  }, [artistId])

  // Fetch any music video associated with the playing track.
  const trackId = currentTrack?.id
  useEffect(() => {
    if (!trackId) {
      setVideoData(null)
      return
    }
    let cancelled = false
    videoService
      .getByTrackId(trackId)
      .then((video) => !cancelled && setVideoData({ trackId, video }))
      .catch(() => !cancelled && setVideoData({ trackId, video: null }))
    return () => {
      cancelled = true
    }
  }, [trackId])

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
  const video = videoData && videoData.trackId === trackId ? videoData.video : null
  const artistVideos = artistVideosData && artistVideosData.artistId === artistId ? artistVideosData.videos : []
  const tourDates = tourData && tourData.artistId === artistId ? tourData.dates : []
  const heroColor = useDominantColor(currentTrack?.album.coverUrl)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  useEffect(() => {
    if (!currentTrack && isNowPlayingExpanded) setNowPlayingExpanded(false)
  }, [currentTrack, isNowPlayingExpanded, setNowPlayingExpanded])

  useEffect(() => {
    if (!isNowPlayingExpanded) setExpandedScroll(0)
  }, [isNowPlayingExpanded])

  // Mirror audio play/pause onto the silent MV preview at the top of the panel.
  useEffect(() => {
    const el = videoElRef.current
    if (!el || !video) return
    if (isPlaying) el.play().catch(() => { /* autoplay can be blocked; the user can hover/click to start */ })
    else el.pause()
  }, [isPlaying, video])
  const panelClass = cn(
    'relative hidden flex-col overflow-hidden rounded-lg bg-surface lg:flex',
    isNowPlayingExpanded ? 'min-w-0' : 'shrink-0',
    !dragging && 'transition-[width,flex-basis,flex-grow,opacity,transform] duration-300 ease-out',
  )
  const panelStyle: React.CSSProperties = isNowPlayingExpanded
    ? { flexBasis: 0, flexGrow: 1, width: 'auto' }
    : { flexBasis: width, flexGrow: 0, width }

  // Collapsed → thin sliver with an expand control (does not fully close).
  if (isNowPlayingCollapsed) {
    return (
      <aside className="group/now-playing-rail relative hidden w-4 shrink-0 overflow-hidden rounded-lg bg-surface/0 transition-[width,background-color] duration-300 ease-out hover:w-16 hover:bg-surface/80 lg:flex">
        <button
          onClick={() => setNowPlayingCollapsed(false)}
          className="absolute inset-y-0 left-0 flex w-full flex-col items-center justify-center gap-4 text-secondary opacity-0 transition-all duration-200 hover:text-primary group-hover/now-playing-rail:opacity-100"
          aria-label={t('np.expand')}
          title={t('np.expand')}
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
      <aside ref={panelRef} style={panelStyle} className={panelClass}>
        <div className="flex items-center justify-between p-4">
          <h2 className="text-base font-bold text-primary">{t('np.title')}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleWide}
              className="rounded-full p-1.5 text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
              aria-label={isWide ? t('np.shrinkPanel') : t('np.expandPanel')}
              title={isWide ? t('np.shrinkPanel') : t('np.expandPanel')}
            >
              {isWide ? <DiagonalCollapseIcon /> : <DiagonalExpandIcon />}
            </button>
            <button
              onClick={() => setNowPlayingCollapsed(true)}
              className="rounded-full p-1 text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
              aria-label={t('np.collapse')}
              title={t('np.collapse')}
            >
              <CollapseIcon />
            </button>
          </div>
        </div>
        <p className="px-4 text-sm text-secondary">
          {t('np.empty')}
        </p>
        <NowPlayingDragHandle onMouseDown={onDragStart} />
      </aside>
    )
  }

  const isLiked = likedTrackIds.has(currentTrack.id)
  const toggleLike = () => (isLiked ? unlikeTrack(currentTrack.id) : likeTrack(currentTrack))
  const shareCurrentTrack = async () => {
    const result = await shareLink(`/track/${currentTrack.id}`, {
      title: currentTrack.title,
      text: `${currentTrack.title} · ${currentTrack.artist.name}`,
    })
    if (result === 'copied') notify.success('Link copied to clipboard')
    else if (result === 'failed') notify.error("Couldn't copy link")
  }

  const relatedTracks = related.filter((t) => t.id !== currentTrack.id).slice(0, 5)
  const upNext = queueIndex >= 0 ? queue.slice(queueIndex + 1) : []

  const isFollowing = artist ? followedArtistIds.has(artist.id) : false
  const artistAvatarUrl = artist?.imageUrl ?? currentTrack.artist.imageUrl
  const openArtistBio = () => {
    if (artist) setArtistBioOpen(true)
  }
  const handleArtistBioKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openArtistBio()
  }
  const toggleFollow = () => {
    if (!artist) return
    if (isFollowing) unfollowArtist(artist.id)
    else followArtist(artist)
  }

  if (isNowPlayingExpanded) {
    const heroProgress = Math.min(expandedScroll / 420, 1)
    const heroOpacity = Math.max(0, 1 - heroProgress * 1.35)
    const expandedVideos = artistVideos.filter((item) => item.id !== video?.id).slice(0, 8)
    const fallbackMediaTracks = expandedVideos.length === 0 ? relatedTracks.slice(0, 8) : []

    return (
      <aside ref={panelRef} style={panelStyle} className={panelClass}>
        {artist && (
          <ArtistBioDialog artist={artist} open={artistBioOpen} onClose={() => setArtistBioOpen(false)} />
        )}
        <div
          onScroll={(event) => setExpandedScroll(event.currentTarget.scrollTop)}
          className="relative flex-1 overflow-y-auto overflow-x-hidden bg-[#121212] [scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[78vh]"
            style={{
              background: heroColor
                ? `linear-gradient(180deg, ${withAlpha(heroColor, 0.9)} 0%, ${withAlpha(heroColor, 0.48)} 44%, rgba(18,18,18,0.96) 100%)`
                : 'linear-gradient(180deg, #24364a 0%, #182432 48%, #121212 100%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 hidden aspect-square h-[60vh] -translate-x-1/2 bg-cover bg-center opacity-20 blur-[1px] lg:block"
            style={{ backgroundImage: `url(${currentTrack.album.coverUrl})` }}
          />

          <div
            className="sticky top-0 z-30 flex items-center justify-between gap-5 px-5 py-4 transition-colors duration-200"
            style={{ backgroundColor: `rgba(18,18,18,${Math.min(0.82, heroProgress * 0.95)})` }}
          >
            <Link
              to={`/album/${currentTrack.album.id}`}
              className="min-w-0 truncate text-base font-bold text-primary hover:underline"
            >
              {currentTrack.album.title}
            </Link>

            <div className="flex shrink-0 items-center gap-3 text-secondary">
              <Link
                to={`/artist/${currentTrack.artist.id}`}
                className="spotify-tooltip-anchor relative flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110 hover:text-primary active:scale-95"
                aria-label={currentTrack.artist.name}
              >
                {artistAvatarUrl ? (
                  <img src={artistAvatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-elevated text-[10px] font-bold text-primary">
                    {currentTrack.artist.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">{currentTrack.artist.name}</span>
              </Link>
              <span className="h-5 w-px bg-secondary/25" aria-hidden="true" />
              <TrackRowMenu
                track={currentTrack}
                alwaysVisible
                onViewCredits={scrollToCredits}
                triggerClassName="flex h-8 w-8 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:bg-white/10 hover:text-primary active:scale-95"
                triggerIconClassName="h-6 w-6 stroke-[2.8] text-secondary hover:text-primary"
              />
              <button
                onClick={toggleWide}
                className="rounded-full p-1.5 text-secondary transition-all hover:scale-110 hover:bg-white/10 hover:text-primary active:scale-95"
                aria-label={t('np.shrinkPanel')}
                title={t('np.shrinkPanel')}
              >
                <DiagonalCollapseIcon />
              </button>
            </div>
          </div>

          <section className="relative z-10 flex min-h-[calc(100vh-13rem)] items-center justify-center px-8 pb-20 pt-6">
            <div
              className="w-[min(35rem,57vh,46vw)] max-w-full transition-[opacity,transform] duration-150 ease-out"
              style={{
                opacity: heroOpacity,
                transform: `translateY(${-heroProgress * 110}px) scale(${1 - heroProgress * 0.08})`,
              }}
            >
              <img
                src={currentTrack.album.coverUrl}
                alt={currentTrack.album.title}
                className="aspect-square w-full rounded-lg object-cover shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              />
            </div>
          </section>

          <div className="relative z-20 -mt-12 pb-20">
            <div className="mx-auto max-w-[72rem] px-6 xl:px-0">
              {(expandedVideos.length > 0 || fallbackMediaTracks.length > 0) && (
                <section>
                  <h3 className="mb-4 text-2xl font-black text-primary">
                    {expandedVideos.length > 0 ? t('np.relatedVideos') : t('np.recommended')}
                  </h3>
                  <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-3 scrollbar-hide">
                    {expandedVideos.map((item) => (
                      <Link key={item.id} to={`/videos/${item.id}`} className="group w-64 shrink-0">
                        <div className="aspect-video overflow-hidden rounded bg-elevated">
                          <img
                            src={item.thumbnailUrl ?? currentTrack.album.coverUrl}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <p className="mt-3 truncate text-sm font-bold text-primary group-hover:underline">{item.title}</p>
                        <p className="mt-1 truncate text-sm text-secondary">{item.artist.name}</p>
                      </Link>
                    ))}
                    {fallbackMediaTracks.map((track) => (
                      <Link key={track.id} to={`/track/${track.id}`} className="group w-64 shrink-0">
                        <div className="aspect-video overflow-hidden rounded bg-elevated">
                          <img
                            src={track.album.coverUrl}
                            alt={track.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <p className="mt-3 truncate text-sm font-bold text-primary group-hover:underline">{track.title}</p>
                        <p className="mt-1 truncate text-sm text-secondary">{track.artist.name}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,1fr)]">
                <div className="space-y-4">
                  {loadingArtist ? (
                    <div className="flex min-h-80 items-center justify-center rounded-xl bg-elevated">
                      <Spinner size="md" />
                    </div>
                  ) : artist && (
                    <section
                      role="button"
                      tabIndex={0}
                      onClick={openArtistBio}
                      onKeyDown={handleArtistBioKeyDown}
                      className="relative min-h-[26rem] cursor-pointer overflow-hidden rounded-xl bg-elevated outline-none transition-transform hover:scale-[1.004] focus-visible:ring-2 focus-visible:ring-accent/70"
                      aria-label={t('artist.bio.open', { name: artist.name })}
                    >
                      {(artist.headerImageUrl || artist.imageUrl) && (
                        <img
                          src={artist.headerImageUrl ?? artist.imageUrl ?? ''}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-75 grayscale"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
                      <div className="relative z-10 flex min-h-[26rem] flex-col justify-between p-6">
                        <h3 className="text-2xl font-black text-white">{t('np.aboutArtist')}</h3>
                        <div>
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <Link
                                to={`/artist/${artist.id}`}
                                onClick={(event) => event.stopPropagation()}
                                className="flex min-w-0 items-center gap-1.5 text-lg font-black text-white hover:underline"
                              >
                                <span className="truncate">{artist.name}</span>
                                {artist.verified && <CheckBadgeIcon className="h-4 w-4 shrink-0 text-accent" />}
                              </Link>
                              <p className="mt-2 text-sm font-bold text-white">
                                {t('np.monthlyListeners', { n: formatNumber(artist.monthlyListeners) })}
                              </p>
                            </div>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleFollow()
                              }}
                              className="shrink-0 rounded-full border border-white/80 px-4 py-2 text-xs font-black text-white transition-colors hover:border-white hover:bg-white/10"
                            >
                              {isFollowing ? t('np.following') : t('np.follow')}
                            </button>
                          </div>
                          {artist.bio && (
                            <p className="mt-5 line-clamp-3 max-w-2xl text-sm font-semibold leading-relaxed text-white">
                              {artist.bio}
                            </p>
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {upNext.length > 0 && (
                    <section className="rounded-xl bg-elevated p-6">
                      <div className="mb-5 flex items-center justify-between gap-4">
                        <h3 className="text-2xl font-black text-primary">{t('np.nextInQueue')}</h3>
                        <Link to="/queue" className="text-xs font-bold text-secondary transition-colors hover:text-primary">
                          {t('np.openQueue')}
                        </Link>
                      </div>
                      {upNext.slice(0, 3).map((track) => (
                        <Link key={track.id} to={`/track/${track.id}`} className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-white/5">
                          <img src={track.album.coverUrl} alt="" className="h-12 w-12 rounded object-cover" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-primary">{track.title}</p>
                            <p className="mt-0.5 truncate text-sm text-secondary">{track.artist.name}</p>
                          </div>
                        </Link>
                      ))}
                    </section>
                  )}
                </div>

                <div className="space-y-4">
                  <section ref={creditsRef} className="scroll-mt-20 rounded-xl bg-elevated p-6">
                    <div className="mb-6 flex items-center justify-between gap-4">
                      <h3 className="text-2xl font-black text-primary">{t('np.credits')}</h3>
                      <button className="text-xs font-bold text-secondary transition-colors hover:text-primary">
                        {t('common.showAll')}
                      </button>
                    </div>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <Link to={`/artist/${currentTrack.artist.id}`} className="block truncate text-base font-bold text-primary hover:underline">
                            {currentTrack.artist.name}
                          </Link>
                          <p className="mt-1 text-sm font-semibold text-secondary">{t('np.mainArtist')}</p>
                        </div>
                        {artist && (
                          <button
                            onClick={toggleFollow}
                            className="shrink-0 rounded-full border border-secondary/60 px-4 py-2 text-xs font-black text-primary transition-colors hover:border-primary"
                          >
                            {isFollowing ? t('artist.following') : t('artist.follow')}
                          </button>
                        )}
                      </div>
                      {album?.label && (
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold text-primary">{album.label}</p>
                            <p className="mt-1 text-sm font-semibold text-secondary">{t('np.label')}</p>
                          </div>
                          <ArrowTopRightOnSquareIcon className="mt-1 h-5 w-5 shrink-0 text-secondary" />
                        </div>
                      )}
                      {album?.copyright && <p className="text-xs font-semibold leading-relaxed text-muted">{album.copyright}</p>}
                    </div>
                  </section>

                  {tourDates.length > 0 && artist && (
                    <section className="rounded-xl bg-elevated p-6">
                      <div className="mb-5 flex items-center justify-between gap-4">
                        <h3 className="text-2xl font-black text-primary">{t('detail.onTour')}</h3>
                        <Link to={`/artist/${artist.id}/events`} className="text-xs font-bold text-secondary transition-colors hover:text-primary">
                          {t('common.showAll')}
                        </Link>
                      </div>
                      <div className="space-y-3">
                        {tourDates.slice(0, 2).map((dateItem) => {
                          const date = new Date(dateItem.eventDate)
                          return (
                            <Link
                              key={dateItem.id}
                              to={`/artist/${artist.id}/events/${dateItem.id}`}
                              className="flex items-center gap-4 rounded-md p-2 transition-colors hover:bg-white/5"
                            >
                              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded bg-black text-center leading-none">
                                <span className="text-[10px] font-black uppercase text-secondary">
                                  {date.toLocaleDateString(undefined, { month: 'short' })}
                                </span>
                                <span className="mt-1 text-2xl font-black text-primary">{date.getDate()}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-base font-bold text-primary">{dateItem.city}</p>
                                <p className="mt-1 truncate text-sm font-semibold text-secondary">{artist.name}</p>
                                <p className="mt-1 truncate text-sm font-semibold text-secondary">
                                  {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {dateItem.venue}
                                </p>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside ref={panelRef} style={panelStyle} className={panelClass}>
      {artist && (
        <ArtistBioDialog artist={artist} open={artistBioOpen} onClose={() => setArtistBioOpen(false)} />
      )}
      <div className="relative flex-1 overflow-y-auto">
        {/* Dynamic colour hue from the cover */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute transition-opacity duration-700',
            isNowPlayingExpanded ? 'inset-0 opacity-80' : 'inset-x-0 top-0 h-80',
          )}
          style={{
            background: heroColor
              ? `linear-gradient(180deg, ${withAlpha(heroColor, 0.7)} 0%, ${withAlpha(heroColor, 0.15)} 50%, transparent 100%)`
              : undefined,
          }}
        />
        {/* Header */}
        <div className={cn(
          'group/np-header sticky top-0 z-20 flex items-center justify-between gap-2 p-4',
          isNowPlayingExpanded ? 'bg-transparent' : 'bg-surface/80 backdrop-blur',
        )}>
          <div className="relative flex min-w-0 flex-1 items-center">
            {!isNowPlayingExpanded && (
              <button
                onClick={() => setNowPlayingCollapsed(true)}
                className="spotify-tooltip-anchor absolute left-0 z-10 -translate-x-1 rounded-full p-1 text-secondary opacity-0 transition-all duration-200 hover:scale-110 hover:bg-elevated hover:text-primary group-hover/np-header:translate-x-0 group-hover/np-header:opacity-100 group-focus-within/np-header:translate-x-0 group-focus-within/np-header:opacity-100 active:scale-95"
                aria-label={t('np.collapse')}
                title={t('np.collapse')}
              >
                <CollapseIcon />
                <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-left">{t('np.collapse')}</span>
              </button>
            )}
            <Link
              to={`/album/${currentTrack.album.id}`}
              className={cn(
                'min-w-0 truncate pl-0 text-base font-bold text-primary transition-all duration-200 hover:underline',
                !isNowPlayingExpanded && 'group-hover/np-header:pl-7 group-focus-within/np-header:pl-7',
              )}
            >
              {currentTrack.album.title}
            </Link>
          </div>
          <div className={cn(
            'flex shrink-0 items-center gap-2 transition-opacity duration-200',
            isNowPlayingExpanded ? 'opacity-100' : 'opacity-0 group-hover/np-header:opacity-100 group-focus-within/np-header:opacity-100',
          )}>
            {isNowPlayingExpanded && (
              <Link
                to={`/artist/${currentTrack.artist.id}`}
                className="spotify-tooltip-anchor relative flex h-8 w-8 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
                aria-label={currentTrack.artist.name}
              >
                {artistAvatarUrl ? (
                  <img
                    src={artistAvatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-elevated text-[10px] font-bold text-primary">
                    {currentTrack.artist.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">{currentTrack.artist.name}</span>
              </Link>
            )}
            {isNowPlayingExpanded && <span className="h-5 w-px bg-secondary/25" aria-hidden="true" />}
            <TrackRowMenu
              track={currentTrack}
              alwaysVisible
              onViewCredits={scrollToCredits}
              triggerClassName="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
              triggerIconClassName="h-5 w-5 stroke-[2.4] text-secondary hover:text-primary"
            />
            <button
              onClick={toggleWide}
              className="rounded-full p-1.5 text-secondary transition-all hover:scale-110 hover:bg-elevated hover:text-primary active:scale-95"
              aria-label={isWide ? t('np.shrinkPanel') : t('np.expandPanel')}
              title={isWide ? t('np.shrinkPanel') : t('np.expandPanel')}
            >
              {isWide ? <DiagonalCollapseIcon /> : <DiagonalExpandIcon />}
            </button>
          </div>
        </div>

        {/* MV preview blends edge-to-edge with the panel; no rounding/shadow. */}
        {video && (
          <div
            onMouseEnter={() => setVideoHover(true)}
            onMouseLeave={() => setVideoHover(false)}
            className="group relative w-full aspect-square overflow-hidden"
          >
            <video
              ref={videoElRef}
              src={video.videoUrl}
              poster={video.thumbnailUrl ?? currentTrack.album.coverUrl}
              muted
              loop
              playsInline
              preload="metadata"
              className={cn(
                'h-full w-full object-cover transition-[filter] duration-300',
                videoHover ? 'brightness-110' : 'brightness-50',
              )}
            />
            <Link
              to={`/videos/${video.id}`}
              title="Open music video"
              aria-label="Open music video"
              className="absolute top-2 right-10 rounded-full bg-black/55 p-1.5 text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/75"
            >
              <ArrowsPointingOutIcon className="h-4 w-4" />
            </Link>
            <button
              onClick={() => usePlayerStore.getState().skipNext()}
              title="Next"
              aria-label="Next"
              className="absolute top-2 right-2 rounded-full bg-black/55 p-1.5 text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/75"
            >
              <ChevronDoubleRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Cover (skipped when an MV is shown above) + title. */}
        <div className={cn(
          'group/np-album px-4 pb-4',
          isNowPlayingExpanded && 'flex min-h-[calc(100vh-13rem)] flex-col items-center justify-center px-8 pb-12 pt-16',
        )}>
          {!video && (
            <Link
              to={`/album/${currentTrack.album.id}`}
              className={cn(
                'block overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
                isNowPlayingExpanded ? 'w-[min(36rem,58vh,62vw)] max-w-full' : 'w-full',
              )}
              aria-label={`Open ${currentTrack.album.title}`}
            >
              <img
                src={currentTrack.album.coverUrl}
                alt={currentTrack.album.title}
                className="aspect-square w-full rounded-lg object-cover shadow-lg transition-transform duration-200 group-hover/np-album:scale-[1.015]"
              />
            </Link>
          )}
          <div className={cn(
            'flex items-start justify-between gap-2',
            video ? 'mt-3' : 'mt-4',
            isNowPlayingExpanded && 'w-[min(36rem,58vh,62vw)] max-w-full',
          )}>
            <div className="min-w-0">
              <Link
                to={`/album/${currentTrack.album.id}`}
                className={cn(
                  'block truncate text-xl font-bold text-primary hover:underline',
                  video && 'hover:text-primary',
                )}
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
              <button
                type="button"
                onClick={shareCurrentTrack}
                className="spotify-tooltip-anchor relative mt-1 rounded-full p-1 text-secondary opacity-0 transition-all duration-200 hover:scale-110 hover:bg-elevated hover:text-primary group-hover/np-album:opacity-100 group-focus-within/np-album:opacity-100 active:scale-95"
                aria-label={`Share ${currentTrack.title}`}
              >
                <ShareIcon className="h-5 w-5 stroke-[2.1]" />
                <span className="spotify-tooltip spotify-tooltip-bottom spotify-tooltip-center">Share</span>
              </button>
              <button onClick={toggleLike} className="mt-1" aria-label={isLiked ? t('player.unlike') : t('player.like')}>
                <AnimatedLikeIcon liked={isLiked} className="w-6 h-6" heartClassName="w-6 h-6 text-secondary hover:text-primary" />
              </button>
            </div>
          </div>
        </div>

        {/* Lyrics (karaoke-synced when the track has timed lyrics) */}
        <NowPlayingLyrics track={currentTrack} accentColor={heroColor} />

        {/* Related / recommended */}
        {relatedTracks.length > 0 && (
          <PanelSection title={t('np.recommended')} subtitle={t('np.recommendedSub')}>
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
            <PanelSection title={t('np.aboutArtist')}>
              <div
                role="button"
                tabIndex={0}
                onClick={openArtistBio}
                onKeyDown={handleArtistBioKeyDown}
                className="relative cursor-pointer overflow-hidden rounded-lg bg-elevated outline-none transition-colors hover:bg-elevated/80 focus-visible:ring-2 focus-visible:ring-accent/70"
                aria-label={t('artist.bio.open', { name: artist.name })}
              >
                {(artist.headerImageUrl || artist.imageUrl) && (
                  <img
                    src={artist.headerImageUrl ?? artist.imageUrl ?? ''}
                    alt={artist.name}
                    className="w-full h-40 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/artist/${artist.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="font-bold text-primary hover:underline"
                    >
                      {artist.name}
                    </Link>
                    {artist.verified && <CheckBadgeIcon className="w-4 h-4 text-accent" />}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-secondary">{t('np.monthlyListeners', { n: formatNumber(artist.monthlyListeners) })}</p>
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleFollow()
                      }}
                      className="text-xs font-semibold rounded-full border border-secondary/60 text-primary px-3 py-1 hover:border-primary transition-colors"
                    >
                      {isFollowing ? t('np.following') : t('np.follow')}
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

        {/* On tour */}
        {tourDates.length > 0 && artistId && (
          <section className="px-4 pb-4">
            <div className="rounded-lg bg-elevated p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-primary">{t('detail.onTour')}</h3>
                <Link
                  to={`/artist/${artistId}/events`}
                  className="shrink-0 text-sm font-black text-secondary transition-colors hover:text-primary"
                >
                  {t('common.showAll')}
                </Link>
              </div>
              <div className="space-y-4">
                {tourDates.slice(0, 2).map((dateItem) => {
                  const date = new Date(dateItem.eventDate)
                  const artistName = artist?.name ?? currentTrack.artist.name
                  return (
                    <Link
                      key={dateItem.id}
                      to={`/artist/${artistId}/events/${dateItem.id}`}
                      className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 rounded-md transition-colors hover:bg-white/5"
                    >
                      <div className="flex h-14 w-14 flex-col items-center justify-center rounded bg-black/65 text-center leading-none">
                        <span className="text-[10px] font-black text-primary">
                          {date.toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <span className="mt-1 text-2xl font-black text-primary">{date.getDate()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-primary">{dateItem.city}</p>
                        <p className="mt-0.5 truncate text-sm font-bold text-secondary">{artistName}</p>
                        <p className="mt-0.5 truncate text-sm font-bold text-secondary">
                          {date.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
                          {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} - {dateItem.venue}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* Credits */}
        <div ref={creditsRef} className="scroll-mt-16">
          <PanelSection title={t('np.credits')}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <Link
                    to={`/artist/${currentTrack.artist.id}`}
                    className="block text-sm font-medium text-primary truncate hover:underline"
                  >
                    {currentTrack.artist.name}
                  </Link>
                  <p className="text-xs text-secondary">{t('np.mainArtist')}</p>
                </div>
                {artist && (
                  <button
                    onClick={toggleFollow}
                    className="text-xs font-semibold rounded-full border border-secondary/60 text-primary px-3 py-1 hover:border-primary transition-colors shrink-0"
                  >
                    {isFollowing ? t('artist.following') : t('artist.follow')}
                  </button>
                )}
              </div>
              {album?.label && (
                <div>
                  <p className="text-sm font-medium text-primary truncate">{album.label}</p>
                  <p className="text-xs text-secondary">{t('np.label')}</p>
                </div>
              )}
              {album?.copyright && <p className="text-xs text-muted leading-relaxed">{album.copyright}</p>}
            </div>
          </PanelSection>
        </div>

        {/* Next in queue */}
        <PanelSection title={t('np.nextInQueue')}>
          {upNext.length > 0 ? (
            <div className="flex flex-col gap-1">
              {upNext.slice(0, 10).map((track, upNextIdx) => {
                const absoluteIdx = queueIndex + 1 + upNextIdx
                return (
                  <div
                    key={`${track.id}-${upNextIdx}`}
                    draggable={isPremium}
                    onDragStart={isPremium ? (e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', String(absoluteIdx))
                    } : undefined}
                    onDragOver={isPremium ? (e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDragOverIndex(absoluteIdx)
                    } : undefined}
                    onDragLeave={isPremium ? () => setDragOverIndex(null) : undefined}
                    onDrop={isPremium ? (e) => {
                      e.preventDefault()
                      const from = Number(e.dataTransfer.getData('text/plain'))
                      if (!isNaN(from) && from !== absoluteIdx) reorderQueue(from, absoluteIdx)
                      setDragOverIndex(null)
                    } : undefined}
                    onDragEnd={isPremium ? () => setDragOverIndex(null) : undefined}
                    className={cn(
                      'flex items-center gap-1 rounded transition-colors',
                      isPremium && 'cursor-grab active:cursor-grabbing',
                      dragOverIndex === absoluteIdx && 'ring-1 ring-accent/60 bg-elevated/60',
                    )}
                  >
                    {isPremium && (
                      <Bars3Icon className="w-4 h-4 shrink-0 text-secondary/40 ml-1" aria-hidden />
                    )}
                    <div className="flex-1 min-w-0">
                      <TrackCard track={track} queue={queue} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-secondary">{t('np.queueEmpty')}</p>
          )}
        </PanelSection>
      </div>
      {!isNowPlayingExpanded && <NowPlayingDragHandle onMouseDown={onDragStart} />}
    </aside>
  )
}
