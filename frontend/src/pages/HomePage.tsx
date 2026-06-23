import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PlayIcon } from '@heroicons/react/24/solid'
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
import { useHueStore } from '@/stores/hueStore'
import { useDominantColor, getDominantColor } from '@/hooks/useDominantColor'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { SectionHeader } from '@/components/common/SectionHeader'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { VerifiedArtistName } from '@/components/common/VerifiedArtistName'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { TrackTile } from '@/components/cards/TrackTile'
import { MixTile } from '@/components/cards/MixTile'
import { Spinner } from '@/components/ui/Spinner'
import type { DailyMix } from '@/services/trackService'
import { useTranslation } from '@/i18n/useTranslation'

const PREVIEW_LIMIT = 10

export function HomePage() {
  const { t } = useTranslation()
  useDocumentTitle(t('topbar.home'))
  const { user, isAuthenticated } = useAuthStore()
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const playWithGate = usePlaybackGate()
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
  // Hovering a card tints the hue toward that cover; otherwise follow the playing track.
  const heroColor = hoverColor ?? baseColor

  useEffect(() => () => setHoverColor(null), [setHoverColor])

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

  const quickPicks = savedPlaylists.slice(0, 6)

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
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60 transition-colors duration-500"
        style={{
          backgroundColor: heroColor ?? 'transparent',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))',
        }}
      />

      <div className="relative px-6 py-6">
        {isAuthenticated && (
          <h1 className="text-3xl font-bold text-primary mb-6">
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
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
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
        {isAuthenticated && quickPicks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {quickPicks.map((p) => {
              const tracks = p.tracks?.map((pt) => pt.track) ?? []
              return (
                <Link
                  key={p.id}
                  to={`/playlist/${p.id}`}
                  onMouseEnter={() => {
                    if (p.coverUrl) getDominantColor(p.coverUrl).then((c) => c && setHoverColor(c))
                  }}
                  onMouseLeave={() => setHoverColor(null)}
                  className="relative flex items-center gap-3 bg-elevated/40 hover:bg-elevated rounded-md overflow-hidden group transition-colors"
                >
                  <div className="w-14 h-14 shrink-0 bg-surface flex items-center justify-center overflow-hidden">
                    {p.coverUrl ? (
                      <img src={p.coverUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <MusicalNoteIcon className="w-6 h-6 text-secondary" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-primary truncate pr-2 flex-1">{p.name}</span>
                  {tracks.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        playWithGate(tracks[0], tracks)
                      }}
                      className="mr-3 w-10 h-10 shrink-0 rounded-full bg-accent flex items-center justify-center opacity-100 translate-y-0 md:opacity-0 md:translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0 hover:scale-105 active:scale-95 transition-all shadow-lg"
                      aria-label={t('home.playPlaylist', { name: p.name })}
                    >
                      <PlayIcon className="w-5 h-5 text-white ml-0.5" />
                    </button>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Daily Mixes — genre-based, personalised mixes */}
        {dailyMixes.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.madeForYou')} />
            <HorizontalScroller>
              {dailyMixes.map((mix) => (
                <MixTile key={mix.id} mix={mix} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* For You Today — personalised, auth only */}
        {isAuthenticated && forYou.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.forYouToday')} />
            <HorizontalScroller>
              {forYou.map((track) => (
                <TrackTile key={track.id} track={track} queue={forYou} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Recents — auth only, hidden until the user has played something */}
        {isAuthenticated && recents.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.recentlyPlayed')} />
            <HorizontalScroller>
              {recents.map((track) => (
                <TrackTile key={track.id} track={track} queue={recents} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Trending now */}
        {trending.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.trendingNow')} href="/charts" />
            <HorizontalScroller>
              {trending.map((track) => (
                <TrackTile key={track.id} track={track} queue={trending} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Most Liked */}
        {mostLiked.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.mostLiked')} />
            <HorizontalScroller>
              {mostLiked.map((track) => (
                <TrackTile key={track.id} track={track} queue={mostLiked} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Popular in the listener's country */}
        {popularInCountry.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.popularInCountry', { country: countryName })} />
            <HorizontalScroller>
              {popularInCountry.map((track) => (
                <TrackTile key={track.id} track={track} queue={popularInCountry} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Recommended playlists */}
        {recommendedPlaylists.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.recommendedPlaylists')} href="/playlists" />
            <HorizontalScroller>
              {recommendedPlaylists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* New Music */}
        {newMusic.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.newMusic')} />
            <HorizontalScroller>
              {newMusic.map((track) => (
                <TrackTile key={track.id} track={track} queue={newMusic} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Popular artists */}
        {popularArtists.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.popularArtists')} href="/popular-artists" />
            <HorizontalScroller>
              {popularArtists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* New releases */}
        {newReleases.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              title={isAuthenticated ? t('home.section.newReleases') : t('home.section.popularAlbums')}
              href="/new-releases"
            />
            <HorizontalScroller>
              {newReleases.slice(0, PREVIEW_LIMIT).map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Podcasts */}
        {podcasts.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.podcasts')} href="/podcasts" />
            <HorizontalScroller>
              {podcasts.map((p) => (
                <Link
                  key={p.id}
                  to={`/podcasts/${p.id}`}
                  className="group w-40 shrink-0 rounded-lg bg-surface p-4 transition-colors hover:bg-elevated"
                >
                  <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-elevated">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                    ) : (
                      <MicrophoneIcon className="h-10 w-10 text-secondary/60" />
                    )}
                  </div>
                  <div className="truncate font-bold text-primary">{p.title}</div>
                  <div className="truncate text-sm text-secondary">{p.author}</div>
                </Link>
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Music videos */}
        {musicVideos.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('home.section.musicVideos')} href="/videos" />
            <HorizontalScroller>
              {musicVideos.map((v) => (
                <Link key={v.id} to={`/videos/${v.id}`} className="group w-64 shrink-0 rounded-lg bg-surface p-2 transition-colors hover:bg-elevated">
                  <div className="relative mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-md bg-elevated">
                    {v.thumbnailUrl
                      ? <img src={v.thumbnailUrl} alt={v.title} className="h-full w-full object-cover" />
                      : <FilmIcon className="h-8 w-8 text-secondary/60" />}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-page">
                        <PlayIcon className="h-5 w-5 translate-x-[1px]" />
                      </span>
                    </div>
                  </div>
                  <div className="truncate px-1 font-semibold text-primary">{v.title}</div>
                  <div className="px-1 text-sm text-secondary">
                    <VerifiedArtistName name={v.artist.name} verified={v.artist.verified} iconClassName="h-3.5 w-3.5" />
                  </div>
                </Link>
              ))}
            </HorizontalScroller>
          </section>
        )}
      </div>
    </div>
  )
}
