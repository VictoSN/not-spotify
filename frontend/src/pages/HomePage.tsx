import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import type { Playlist } from '@/types/playlist'
import type { Album } from '@/types/album'
import type { Artist } from '@/types/artist'
import { trackService } from '@/services/trackService'
import { playlistService } from '@/services/playlistService'
import { albumService } from '@/services/albumService'
import { artistService } from '@/services/artistService'
import { podcastService } from '@/services/podcastService'
import type { PodcastSummary } from '@/types/podcast'
import { videoService } from '@/services/videoService'
import type { MusicVideo } from '@/types/musicVideo'
import { MicrophoneIcon, FilmIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/stores/authStore'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useDragStore } from '@/stores/dragStore'
import { useHueStore } from '@/stores/hueStore'
import { useDominantColor, getDominantColor, hueHeaderBackground } from '@/hooks/useDominantColor'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { SectionHeader } from '@/components/common/SectionHeader'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { NowPlayingBars } from '@/components/common/NowPlayingBars'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { PlaylistRowMenu, type PlaylistRowMenuHandle } from '@/components/cards/PlaylistRowMenu'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { TrackTile } from '@/components/cards/TrackTile'
import { MixTile } from '@/components/cards/MixTile'
import { PodcastMenu, type PodcastMenuHandle } from '@/components/cards/PodcastMenu'
import { VideoMenu, type VideoMenuHandle } from '@/components/cards/VideoMenu'
import { openMenuAtPointer } from '@/utils/contextMenu'
import { getPinnedKeys, PINNED_EVENT } from '@/utils/pinnedLibrary'
import {
  PODCAST_DND_MIME,
  VIDEO_DND_MIME,
  setPodcastDragImage,
  setVideoDragImage,
} from '@/utils/trackDnd'
import { Spinner } from '@/components/ui/Spinner'
import type { DailyMix } from '@/services/trackService'
import { useTranslation } from '@/i18n/useTranslation'
import { cn } from '@/utils/cn'

const PREVIEW_LIMIT = 10
const HOME_CONTENT_GUTTER = 'px-4 sm:px-6 lg:px-8 2xl:px-10'

export type HomeFilter = 'all' | 'music' | 'podcasts' | 'videos'

export function getHomeFilterVisibility(filter: HomeFilter) {
  return {
    showMusic: filter === 'all' || filter === 'music',
    showPodcasts: filter === 'all' || filter === 'podcasts',
    showVideos: filter === 'all' || filter === 'videos',
  }
}

export function HomePage() {
  const { t } = useTranslation()
  useDocumentTitle(t('topbar.home'))
  const { user, isAuthenticated } = useAuthStore()
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const savedPlaylists = useLibraryStore((s) => s.savedPlaylists)
  const [trending, setTrending] = useState<Track[]>([])
  const [mostLiked, setMostLiked] = useState<Track[]>([])
  const [forYou, setForYou] = useState<Track[]>([])
  const [newMusic, setNewMusic] = useState<Track[]>([])
  const [recommendedPlaylists, setRecommendedPlaylists] = useState<Playlist[]>([])
  const [newReleases, setNewReleases] = useState<Album[]>([])
  const [recents, setRecents] = useState<Track[]>([])
  const [popularArtists, setPopularArtists] = useState<Artist[]>([])
  const [popularInCountry, setPopularInCountry] = useState<Track[]>([])
  const [dailyMixes, setDailyMixes] = useState<DailyMix[]>([])
  const [pinnedKeys, setPinnedKeys] = useState(getPinnedKeys)
  const [podcasts, setPodcasts] = useState<PodcastSummary[]>([])
  const [musicVideos, setMusicVideos] = useState<MusicVideo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        // Wave 1: above-the-fold content (3 requests)
        const [fy, tr, rc] = await Promise.all([
          trackService.getForYou(PREVIEW_LIMIT),
          trackService.getTrending(PREVIEW_LIMIT),
          isAuthenticated
            ? trackService.getRecents(PREVIEW_LIMIT).catch(() => [] as Track[])
            : Promise.resolve([] as Track[]),
        ])
        if (cancelled) return
        setForYou(fy)
        setTrending(tr)
        setRecents(rc)
        setLoading(false)

        // Wave 2: secondary sections (staggered after paint)
        const [ml, nm, rp, nr, pa, dm, pic, pods, mv] = await Promise.all([
          trackService.getMostLiked(PREVIEW_LIMIT),
          trackService.getNewMusic(PREVIEW_LIMIT),
          playlistService.getRecommended(PREVIEW_LIMIT),
          albumService.getNewReleases(PREVIEW_LIMIT),
          artistService.getPopular(PREVIEW_LIMIT),
          trackService.getDailyMixes(4).catch(() => [] as DailyMix[]),
          trackService.getPopularInCountry(user?.country, PREVIEW_LIMIT).catch(() => [] as Track[]),
          podcastService.getAll().catch(() => [] as PodcastSummary[]),
          videoService.list().catch(() => [] as MusicVideo[]),
        ])
        if (cancelled) return
        setMostLiked(ml)
        setNewMusic(nm)
        setRecommendedPlaylists(rp)
        setNewReleases(nr)
        setPopularArtists(pa)
        setDailyMixes(dm)
        setPopularInCountry(pic)
        setPodcasts(pods)
        setMusicVideos(mv)
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isAuthenticated])

  // Cover-derived hue for the top of the page (reflects what's playing, else a featured cover).
  const heroSeed =
    currentTrack?.album.coverUrl ??
    forYou[0]?.album.coverUrl ??
    trending[0]?.album.coverUrl ??
    savedPlaylists.find((p) => p.coverUrl)?.coverUrl ??
    null
  const baseColor = useDominantColor(heroSeed)
  const hoverColor = useHueStore((s) => s.hoverColor)
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  const lastCoverColor = useHueStore((s) => s.lastCoverColor)
  // Whether the main content area is scrolled past the hero (set by AppShell);
  // drives the Home filter bar's locked-hue background — the global header is unaffected.
  const headerScrolled = useHueStore((s) => s.headerScrolled)
  // Hovering a card tints the hue toward that cover; otherwise follow the playing track.
  // Neutral grey used only while the cursor rests on a card that has no cover
  // image (or as the ultimate fallback when nothing at all provides a hue).
  const DEFAULT_HERO = 'hsl(0 0% 33%)'
  // hoverColor is the card currently under the cursor (may be DEFAULT_HERO for
  // no-cover cards). lastCoverColor remembers the last card that had an actual
  // cover, so the tint sticks after the cursor leaves. baseColor comes from the
  // playing track / featured items.
  const heroColor = hoverColor ?? lastCoverColor ?? baseColor ?? DEFAULT_HERO

  useEffect(() => () => setHoverColor(null), [setHoverColor])

  useEffect(() => {
    const syncPinned = () => setPinnedKeys(getPinnedKeys())
    window.addEventListener(PINNED_EVENT, syncPinned)
    window.addEventListener('storage', syncPinned)
    return () => {
      window.removeEventListener(PINNED_EVENT, syncPinned)
      window.removeEventListener('storage', syncPinned)
    }
  }, [])

  // Home's own filter ("All / Music / Podcasts") — lives in the page content, not
  // the global header. 'music' hides podcasts; 'podcasts' shows only podcasts.
  const [homeFilter, setHomeFilter] = useState<HomeFilter>('all')
  const { showMusic, showPodcasts, showVideos } = getHomeFilterVisibility(homeFilter)
  const pinnedOrder = new Map(pinnedKeys.map((key, index) => [key, index]))
  const orderedDailyMixes = [...dailyMixes].sort((left, right) => {
    const leftOrder = pinnedOrder.get(`mix-${left.id}`)
    const rightOrder = pinnedOrder.get(`mix-${right.id}`)
    if (leftOrder == null && rightOrder == null) return 0
    if (leftOrder == null) return 1
    if (rightOrder == null) return -1
    return leftOrder - rightOrder
  })

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('home.greeting.morning')
    if (h < 18) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const quickPicks = savedPlaylists.slice(0, 8)
  // At the top the bar is transparent so it blends seamlessly into the hero hue
  // gradient (no separate brown strip). Once scrolled it becomes a solid header
  // that mirrors the hero hue at the SAME ratio (via hueHeaderBackground), driven
  // by the SAME colour the hero uses (`heroColor`, incl. the hovered-card tint),
  // so it reads as the same hue rather than a separate browner strip.
  const homeHeaderBackground = headerScrolled ? hueHeaderBackground(heroColor) : 'transparent'

  // ISO alpha-2 → display name (e.g. "US" → "United States"); falls back to the code.
  const countryCode = (user?.country || 'US').toUpperCase()
  let countryName = countryCode
  try {
    countryName = new Intl.DisplayNames(undefined, { type: 'region' }).of(countryCode) || countryCode
  } catch {
    /* Intl.DisplayNames unsupported — keep the raw code */
  }

  return (
    <div className="relative">
      {/* Dynamic colour hue — smoothly crossfades to the hovered card's colour */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60 transition-[background-color] duration-700 ease-in-out motion-reduce:transition-none"
        style={{
          backgroundColor: heroColor,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))',
        }}
      />

      {/* Home filter bar — a Home-page-only sticky header (All / Music / Podcasts).
          It locks to the top of the content scroll area and adopts the page hue once
          scrolled. This is intentionally separate from the global app header, which
          must stay visually independent. The scroll container bleeds content the full
          width (see `.ns-bleed-scroll`), so this bar already spans edge-to-edge under
          the overlay scrollbar — no gutter-covering hack needed. */}
      <div
        className="sticky top-0 z-30 transition-colors duration-300 ease-out motion-reduce:transition-none"
        style={{
          backgroundColor: homeHeaderBackground,
          // Blur only once scrolled — at the top a blurred transparent bar would
          // smear the gradient into a faint visible strip.
          backdropFilter: headerScrolled ? 'blur(18px)' : 'none',
          WebkitBackdropFilter: headerScrolled ? 'blur(18px)' : 'none',
        }}
      >
        <div
          data-testid="home-filter-content"
          className={cn('flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide', HOME_CONTENT_GUTTER)}
        >
          {([
            { key: 'all', label: t('home.filter.all') },
            { key: 'music', label: t('home.filter.music') },
            { key: 'podcasts', label: t('home.filter.podcasts') },
            { key: 'videos', label: t('home.filter.musicVideos') },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setHomeFilter(f.key)}
              className={cn(
                'flex h-8 shrink-0 items-center rounded-full px-3 py-1 text-sm font-normal text-primary backdrop-blur-sm transition-all active:scale-95',
                homeFilter === f.key
                  ? 'bg-primary/20'
                  : 'bg-primary/10 hover:bg-primary/20',
              )}
              aria-pressed={homeFilter === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div
        data-testid="home-main-content"
        className={cn('relative pb-6', HOME_CONTENT_GUTTER)}
      >
        {isAuthenticated && (
          <h1 className="text-3xl font-bold text-primary mb-6 mt-2">
            {getGreeting()}
            {user ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
        )}

        {/* Guest promo banner */}
        {!isAuthenticated && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface ring-1 ring-accent/40 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl shrink-0">🎉</span>
              <div className="min-w-0">
                <p className="text-sm font-black text-primary">{t('home.promo.title')}</p>
                <p className="mt-0.5 text-xs text-secondary">
                  {t('home.promo.useCode')}{' '}
                  <strong className="font-black text-accent">5OFF</strong>
                  {' '}{t('home.promo.atCheckout')}
                </p>
              </div>
            </div>
            <Link
              to="/premium"
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-black transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
            >
              <SparklesIcon className="h-4 w-4" />
              {t('home.promo.seePlans')}
            </Link>
          </div>
        )}

          {/* Free-plan nudge + promo combined */}
          {isAuthenticated && user?.capabilities?.unlimitedPlayback === false && (
            <div className="mb-8 overflow-hidden rounded-xl bg-surface ring-1 ring-accent/30">
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-primary">{t('home.freePlan.title')}</p>
                  <p className="mt-0.5 text-xs text-secondary">{t('home.freePlan.sub')}</p>
                </div>
                <Link
                  to="/premium"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-black text-page transition-all hover:scale-105 active:scale-95"
                >
                  {t('home.freePlan.cta')}
                </Link>
              </div>
              <div className="flex items-center gap-2.5 border-t border-elevated/30 bg-elevated/20 px-5 py-2.5">
                <span className="text-base shrink-0">🎉</span>
                <p className="text-xs text-secondary">
                  {t('home.freePlan.offerPrefix')}{' '}
                <strong className="font-black text-accent">5OFF</strong>
                {' '}{t('home.promo.atCheckoutShort')}{' '}
                <span className="text-muted">{t('home.freePlan.expires')}</span>
              </p>
            </div>
          </div>
        )}

        {/* Quick access — the same library shown in the sidebar */}
        {showMusic && isAuthenticated && quickPicks.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickPicks.map((playlist) => (
              <HomeQuickPlaylist key={playlist.id} playlist={playlist} />
            ))}
          </div>
        )}

        {/* Daily Mixes — genre-based, personalised mixes */}
        {showMusic && dailyMixes.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.madeForYou')} variant="home" />
            <HorizontalScroller bleedRight>
              {orderedDailyMixes.map((mix) => (
                <MixTile key={mix.id} mix={mix} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* For You Today — personalised, auth only */}
        {showMusic && isAuthenticated && forYou.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.forYouToday')} variant="home" />
            <HorizontalScroller bleedRight>
              {forYou.map((track) => (
                <TrackTile key={track.id} track={track} queue={forYou} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Recents — auth only, hidden until the user has played something */}
        {showMusic && isAuthenticated && recents.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.recentlyPlayed')} variant="home" />
            <HorizontalScroller bleedRight>
              {recents.map((track) => (
                <TrackTile key={track.id} track={track} queue={recents} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Trending now */}
        {showMusic && trending.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.trendingNow')} href="/charts" variant="home" />
            <HorizontalScroller bleedRight>
              {trending.map((track) => (
                <TrackTile key={track.id} track={track} queue={trending} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Most Liked */}
        {showMusic && mostLiked.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.mostLiked')} variant="home" />
            <HorizontalScroller bleedRight>
              {mostLiked.map((track) => (
                <TrackTile key={track.id} track={track} queue={mostLiked} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Popular in the listener's country */}
        {showMusic && popularInCountry.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.popularInCountry', { country: countryName })} variant="home" />
            <HorizontalScroller bleedRight>
              {popularInCountry.map((track) => (
                <TrackTile key={track.id} track={track} queue={popularInCountry} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Recommended playlists */}
        {showMusic && recommendedPlaylists.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.recommendedPlaylists')} href="/playlists" variant="home" />
            <HorizontalScroller bleedRight>
              {recommendedPlaylists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* New Music */}
        {showMusic && newMusic.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.newMusic')} variant="home" />
            <HorizontalScroller bleedRight>
              {newMusic.map((track) => (
                <TrackTile key={track.id} track={track} queue={newMusic} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Popular artists */}
        {showMusic && popularArtists.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.popularArtists')} href="/popular-artists" variant="home" />
            <HorizontalScroller bleedRight>
              {popularArtists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* New releases */}
        {showMusic && newReleases.length > 0 && (
          <section className="mb-6">
            <SectionHeader
              title={isAuthenticated ? t('home.section.newReleases') : t('home.section.popularAlbums')}
              href="/new-releases"
              variant="home"
            />
            <HorizontalScroller bleedRight>
              {newReleases.slice(0, PREVIEW_LIMIT).map((album) => (
                <AlbumCard key={album.id} album={album} flush />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Podcasts */}
        {showPodcasts && podcasts.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.podcasts')} href="/podcasts" variant="home" />
            <HorizontalScroller bleedRight>
              {podcasts.map((p) => (
                <HomePodcastTile key={p.id} podcast={p} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Music videos */}
        {showVideos && musicVideos.length > 0 && (
          <section className="mb-6">
            <SectionHeader title={t('home.section.musicVideos')} href="/videos" variant="home" />
            <HorizontalScroller bleedRight>
              {musicVideos.map((v) => (
                <HomeVideoTile key={v.id} video={v} queue={musicVideos} />
              ))}
            </HorizontalScroller>
          </section>
        )}
      </div>
    </div>
  )
}

export function HomeQuickPlaylist({ playlist }: { playlist: Playlist }) {
  const { t } = useTranslation()
  const menuRef = useRef<PlaylistRowMenuHandle>(null)
  const startContext = usePlayContextGate()
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const { isActiveContext, isPlayingContext } = usePlaybackContext({ type: 'playlist', id: playlist.id })
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  const setLastCoverColor = useHueStore((s) => s.setLastCoverColor)
  // Neutral grey for cards without cover art — avoids the hero snapping to blue
  // or the default when hovering an empty-cover playlist.
  const NO_COVER_HUE = 'hsl(0 0% 33%)'

  const handlePlay = async (event: React.MouseEvent) => {
    event.preventDefault()
    if (isActiveContext) {
      togglePlayPause()
      return
    }
    // If the store already has tracks (e.g. after visiting the detail page) use
    // them directly; otherwise fetch the full playlist.
    const stored = playlist.tracks?.map((item) => item.track)
    if (stored && stored.length > 0) {
      startContext({ type: 'playlist', id: playlist.id }, stored)
      return
    }
    const full = await playlistService.getById(playlist.id)
    const resolved = full.tracks.map((item) => item.track)
    if (resolved.length > 0) startContext({ type: 'playlist', id: playlist.id }, resolved)
  }

  return (
    <div
      className="group relative"
      onContextMenu={(event) => openMenuAtPointer(event, menuRef)}
    >
      <Link
        to={`/playlist/${playlist.id}`}
        onMouseEnter={() => {
          if (playlist.coverUrl) {
            getDominantColor(playlist.coverUrl).then((color) => {
              if (color) {
                setHoverColor(color)
                setLastCoverColor(color)
              }
            })
          } else {
            setHoverColor(NO_COVER_HUE)
          }
        }}
        onMouseLeave={() => setHoverColor(null)}
        className="relative flex items-center gap-4 overflow-hidden rounded-md bg-primary/10 backdrop-blur-sm transition-colors hover:bg-primary/20"
      >
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden bg-surface">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <MusicalNoteIcon className="h-7 w-7 text-secondary" />
          )}
        </div>
        <span className="flex-1 truncate pr-2 text-base font-semibold text-primary">{playlist.name}</span>
        <div className="relative mr-3 h-12 w-12 shrink-0">
          {isActiveContext && (
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center opacity-100 transition-opacity duration-150 md:flex md:group-hover:opacity-0">
              <NowPlayingBars playing={isPlayingContext} className="h-5" />
            </span>
          )}
          <button
            type="button"
            onClick={handlePlay}
            className="absolute inset-0 flex h-12 w-12 translate-y-0 items-center justify-center rounded-full bg-accent shadow-lg transition-all hover:scale-105 active:scale-95 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
            aria-label={isPlayingContext ? `Pause ${playlist.name}` : t('home.playPlaylist', { name: playlist.name })}
          >
            {isPlayingContext ? (
              <PauseIcon className="h-6 w-6 text-white" />
            ) : (
              <PlayIcon className="ml-0.5 h-6 w-6 text-white" />
            )}
          </button>
        </div>
      </Link>
      <PlaylistRowMenu ref={menuRef} playlist={playlist} />
    </div>
  )
}

export function HomePodcastTile({ podcast: p }: { podcast: PodcastSummary }) {
  const menuRef = useRef<PodcastMenuHandle>(null)
  const setDraggedPodcast = useDragStore((s) => s.setDraggedPodcast)
  return (
    <div
      className="group relative w-40 shrink-0"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData(PODCAST_DND_MIME, p.id)
        e.dataTransfer.setData('text/plain', `${p.title} - ${p.author}`)
        setPodcastDragImage(e, p)
        setDraggedPodcast(p)
        e.currentTarget.style.opacity = '0.4'
      }}
      onDragEnd={(e) => {
        setDraggedPodcast(null)
        e.currentTarget.style.opacity = ''
      }}
      onContextMenu={(e) => openMenuAtPointer(e, menuRef)}
    >
      <Link to={`/podcasts/${p.id}`} draggable={false} className="block rounded-lg transition-colors">
        <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-elevated">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.title} draggable={false} className="h-full w-full object-cover" />
          ) : (
            <MicrophoneIcon className="h-10 w-10 text-secondary/60" />
          )}
        </div>
        <div className="truncate font-normal text-primary">{p.title}</div>
        <div className="truncate text-sm text-secondary">{p.author}</div>
      </Link>
      <div className="absolute right-2 top-2">
        <PodcastMenu
          ref={menuRef}
          podcast={p}
          triggerClassName="rounded-full bg-black/60 p-1.5 backdrop-blur-sm"
        />
      </div>
    </div>
  )
}

export function HomeVideoTile({ video: v, queue }: { video: MusicVideo; queue: MusicVideo[] }) {
  const menuRef = useRef<VideoMenuHandle>(null)
  const setDraggedVideo = useDragStore((s) => s.setDraggedVideo)
  return (
    <div
      className="group relative w-64 shrink-0"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData(VIDEO_DND_MIME, v.id)
        e.dataTransfer.setData('text/plain', `${v.title} - ${v.artist.name}`)
        setVideoDragImage(e, v)
        setDraggedVideo(v)
        e.currentTarget.style.opacity = '0.4'
      }}
      onDragEnd={(e) => {
        setDraggedVideo(null)
        e.currentTarget.style.opacity = ''
      }}
      onContextMenu={(e) => openMenuAtPointer(e, menuRef)}
    >
      <Link to={`/videos/${v.id}`} state={{ videoQueue: queue }} draggable={false} className="block rounded-lg transition-colors">
        <div className="relative mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-md bg-elevated">
          {v.thumbnailUrl
            ? <img src={v.thumbnailUrl} alt={v.title} draggable={false} className="h-full w-full object-cover" />
            : <FilmIcon className="h-8 w-8 text-secondary/60" />}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-page">
              <PlayIcon className="h-5 w-5 translate-x-[1px]" />
            </span>
          </div>
        </div>
        <div className="truncate px-1 font-normal text-primary">{v.title}</div>
        <div className="truncate px-1 text-sm text-secondary">{v.artist.name}</div>
      </Link>
      <div className="absolute right-2 top-2">
        <VideoMenu
          ref={menuRef}
          video={v}
          triggerClassName="rounded-full bg-black/60 p-1.5 backdrop-blur-sm"
        />
      </div>
    </div>
  )
}
