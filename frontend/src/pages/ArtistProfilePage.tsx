import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { ShareIcon } from '@heroicons/react/24/outline'
import type { Artist, TourDate } from '@/types/artist'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import { artistService } from '@/services/artistService'
import { trackService } from '@/services/trackService'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { ArtistBadgesDialog } from '@/components/common/ArtistBadgesDialog'
import { ArtistBioDialog } from '@/components/common/ArtistBioDialog'
import { SectionHeader } from '@/components/common/SectionHeader'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { NowPlayingBars } from '@/components/common/NowPlayingBars'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/formatNumber'
import { formatMs } from '@/utils/formatTime'
import { shareLink } from '@/utils/share'
import { useTranslation } from '@/i18n/useTranslation'
import { artworkSectionGradient, useDominantColor, withAlpha } from '@/hooks/useDominantColor'

export function ArtistProfilePage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [artist, setArtist] = useState<Artist | null>(null)
  useDocumentTitle(artist?.name ?? null)
  const [topTracks, setTopTracks] = useState<Track[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [related, setRelated] = useState<Artist[]>([])
  const [tourDates, setTourDates] = useState<TourDate[]>([])
  const [loading, setLoading] = useState(true)
  const [shareCopied, setShareCopied] = useState(false)
  const [badgesOpen, setBadgesOpen] = useState(false)
  const [bioOpen, setBioOpen] = useState(false)
  const startContext = usePlayContextGate()
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentContextType = usePlayerStore((s) => s.currentContextType)
  const currentContextId = usePlayerStore((s) => s.currentContextId)
  // The artist button reacts ONLY when this artist is the explicit context —
  // never just because the current track happens to be by them.
  const { isActiveContext: artistActive, isPlayingContext: artistPlaying } =
    usePlaybackContext(id ? { type: 'artist', id } : null)
  const { followedArtistIds, followArtist, unfollowArtist } = useLibraryStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  // The page tint must match the artwork currently driving the hero:
  // banner takes priority, with the profile picture used only as its fallback.
  const heroColorSource = artist?.headerImageUrl
    ? artist.headerImageUrl
    : artist?.imageUrl
  const derivedHeroHue = useDominantColor(heroColorSource, { resetOnChange: true })

  useEffect(() => {
    if (!id) return
    Promise.all([artistService.getById(id), artistService.getTopTracks(id, 5), artistService.getAlbums(id)]).then(
      ([a, t, al]) => {
        setArtist(a)
        setTopTracks(t)
        setAlbums(al)
        setLoading(false)
      },
    )
    // Related artists + tour dates load independently — never block the page.
    artistService.getRelated(id, 8).then(setRelated).catch(() => setRelated([]))
    artistService.getTourDates(id).then(setTourDates).catch(() => setTourDates([]))
  }, [id])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  if (!artist) return <div className="p-8 text-secondary">{t('detail.artistNotFound')}</div>

  const isFollowing = followedArtistIds.has(artist.id)
  const heroHue = derivedHeroHue ?? 'hsl(210 7% 24%)'
  const artistPick = albums[0] ?? null
  const toggleFollow = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.followArtistPrompt'), imageUrl: artist.imageUrl })
      return
    }
    if (isFollowing) unfollowArtist(artist.id)
    else followArtist(artist)
  }

  const playTrackThroughAlbum = async (track: Track) => {
    const isSameTrack = currentTrack?.id === track.id
    const isSameAlbumContext = currentContextType === 'album' && currentContextId === track.album.id
    if (isSameTrack && isSameAlbumContext) {
      togglePlayPause()
      return
    }

    try {
      const albumTracks = await trackService.getByAlbum(track.album.id)
      const queue = albumTracks.length > 0 ? albumTracks : [track]
      const startIndex = Math.max(queue.findIndex((queuedTrack) => queuedTrack.id === track.id), 0)
      startContext({ type: 'album', id: track.album.id }, queue, startIndex)
    } catch {
      startContext({ type: 'album', id: track.album.id }, [track], 0)
    }
  }

  return (
    <div>
      <ArtistBadgesDialog open={badgesOpen} onClose={() => setBadgesOpen(false)} />
      <ArtistBioDialog artist={artist} open={bioOpen} onClose={() => setBioOpen(false)} />

      {/* Hero */}
      <div
        className={
          artist.headerImageUrl
            ? 'relative h-72 w-full overflow-hidden sm:h-auto sm:aspect-[3/1]'
            : 'relative h-72 w-full overflow-hidden sm:h-auto sm:aspect-[4/1]'
        }
        style={!artist.headerImageUrl ? {
          background: `linear-gradient(120deg, ${heroHue} 0%, ${withAlpha(heroHue, 0.78)} 52%, ${withAlpha(heroHue, 0.46)} 100%)`,
        } : undefined}
      >
        {artist.headerImageUrl ? (
          <img src={artist.headerImageUrl} alt={artist.name} className="w-full h-full object-cover" />
        ) : null}
        {artist.headerImageUrl && <div className="artwork-banner-scrim absolute inset-0" />}
        <div
          className={
            artist.headerImageUrl
              ? 'absolute bottom-5 left-5 right-5 flex items-end sm:bottom-7 sm:left-7 sm:right-7'
              : 'absolute inset-0 flex items-center gap-5 px-5 sm:gap-7 sm:px-7 lg:gap-10'
          }
        >
          {!artist.headerImageUrl && (
            <Avatar
              src={artist.imageUrl}
              alt={artist.name}
              size="xl"
              round
              className="h-32 w-32 text-4xl shadow-2xl ring-1 ring-white/10 sm:h-44 sm:w-44 sm:text-5xl lg:h-52 lg:w-52 lg:text-6xl"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className={`flex min-w-0 items-center gap-2 font-black leading-none text-white drop-shadow-xl sm:gap-3 ${
              artist.headerImageUrl
                ? 'text-5xl sm:text-7xl lg:text-8xl'
                : 'text-4xl sm:text-6xl lg:text-7xl'
            }`}>
              <span className="min-w-0 truncate">{artist.name}</span>
              {artist.verified && (
                <button
                  type="button"
                  onClick={() => setBadgesOpen(true)}
                  className="flex shrink-0 items-center justify-center rounded-full text-accent transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-95"
                  aria-label={t('artist.badges.open')}
                  title={t('artist.verified')}
                >
                  <CheckBadgeIcon className="h-7 w-7 sm:h-9 sm:w-9 lg:h-10 lg:w-10" />
                </button>
              )}
            </h1>
            <p className="mt-4 text-sm font-semibold text-white drop-shadow-md">
              {t('detail.monthlyListeners', { n: formatNumber(artist.monthlyListeners) })}
            </p>
          </div>
        </div>
      </div>

      <div style={{
        background: artworkSectionGradient(heroHue),
      }}>
        {/* Actions */}
        <div className="mx-auto flex max-w-[1360px] items-center gap-4 px-5 py-6 md:px-8">
        {topTracks.length > 0 && (
          <Button
            onClick={() => {
              if (artistActive) togglePlayPause()
              else startContext({ type: 'artist', id: artist.id }, topTracks)
            }}
            size="lg"
            className="gap-2"
          >
            {artistPlaying ? (
              <><PauseIcon className="w-5 h-5" /> {t('player.pause')}</>
            ) : (
              <><PlayIcon className="w-5 h-5" /> {t('common.play')}</>
            )}
          </Button>
        )}
        <Button variant={isFollowing ? 'outline' : 'secondary'} onClick={toggleFollow}>
          {isFollowing ? t('common.following') : t('common.follow')}
        </Button>
        <button
          onClick={async () => {
            const r = await shareLink(`/artist/${artist.id}`, { title: artist.name, text: t('detail.shareArtistText', { name: artist.name }) })
            if (r === 'copied') { setShareCopied(true); setTimeout(() => setShareCopied(false), 1500) }
          }}
          title={t('detail.shareArtist')}
          className="flex items-center gap-2 text-sm font-semibold text-secondary transition-all hover:scale-105 hover:text-primary active:scale-95"
        >
          <ShareIcon className="w-5 h-5" />
          {shareCopied ? t('common.linkCopied') : t('common.share')}
        </button>
        </div>

        {(topTracks.length > 0 || artistPick) && (
          <section className="mx-auto mb-8 grid max-w-[1360px] gap-10 px-5 md:px-8 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)] lg:items-start xl:gap-14">
            {topTracks.length > 0 && (
              <div className="min-w-0">
                <SectionHeader title={t('detail.popular')} />
                <div className="space-y-1">
                  {topTracks.map((track, i) => (
                    <ArtistPopularTrackRow
                      key={track.id}
                      track={track}
                      index={i}
                      active={
                        currentTrack?.id === track.id &&
                        currentContextType === 'album' &&
                        currentContextId === track.album.id
                      }
                      playing={
                        currentTrack?.id === track.id &&
                        currentContextType === 'album' &&
                        currentContextId === track.album.id &&
                        isPlaying
                      }
                      // Playing a song here uses the album+track method: the song's
                      // album button reacts, the artist button does not.
                      onPlay={() => void playTrackThroughAlbum(track)}
                    />
                  ))}
                </div>
              </div>
            )}

            {artistPick && (
              <aside className="hidden min-w-0 pt-1 lg:block">
                <h2 className="mb-4 text-xl font-bold text-primary">Artist pick</h2>
                <Link
                  to={`/album/${artistPick.id}`}
                  className="group flex max-w-[460px] items-center gap-4 rounded-md p-2 transition-colors hover:bg-white/5"
                >
                  <img
                    src={artistPick.coverUrl}
                    alt={artistPick.title}
                    className="h-24 w-24 shrink-0 rounded object-cover shadow-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
                      <Avatar src={artist.imageUrl} alt={artist.name} size="sm" round className="!h-5 !w-5 text-[10px]" />
                      <span className="truncate">{artist.name} recommends</span>
                    </span>
                    <span className="block line-clamp-2 text-sm font-black text-primary group-hover:underline">
                      {artistPick.title}
                    </span>
                    <span className="mt-1 block text-sm font-semibold capitalize text-secondary">{artistPick.type}</span>
                  </span>
                </Link>
              </aside>
            )}
          </section>
        )}

        {/* Albums */}
        {albums.length > 0 && (
          <section className="px-6 mb-8">
            <SectionHeader title={t('detail.discography')} />
            <HorizontalScroller>
              {albums.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Fans also like */}
        {related.length > 0 && (
          <section className="px-6 mb-8">
            <SectionHeader title={t('detail.fansAlsoLike')} />
            <HorizontalScroller>
              {related.map((a) => (
                <ArtistCard key={a.id} artist={a} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* On tour */}
        {tourDates.length > 0 && (
          <section className="px-6 mb-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-primary">{t('detail.onTour')}</h2>
              <Link
                to={`/artist/${artist.id}/events`}
                className="text-xs font-semibold text-secondary transition-colors hover:text-primary"
              >
                View all upcoming concerts ({tourDates.length})
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
              {tourDates.slice(0, 9).map((d) => {
                const date = new Date(d.eventDate)
                const region = (() => {
                  try { return new Intl.DisplayNames(undefined, { type: 'region' }).of(d.country) ?? d.country }
                  catch { return d.country }
                })()
                return (
                  <Link
                    key={d.id}
                    to={`/artist/${artist.id}/events/${d.id}`}
                    className="flex min-w-0 items-center gap-4 rounded-md p-1 transition-colors hover:bg-white/5"
                  >
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded bg-elevated text-center leading-none">
                      <span className="text-xs font-bold text-secondary">
                        {date.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                      <span className="mt-1 text-2xl font-black text-primary">{date.getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-primary">{d.city}</p>
                      <p className="mt-1 truncate text-xs text-secondary">{artist.name}{region ? ` · ${region}` : ''}</p>
                      <p className="mt-1 truncate text-xs text-secondary">
                        {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {d.venue}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Bio */}
        {artist.bio && (
          <section className="px-6 mb-8">
            <SectionHeader title={t('detail.about')} />
            <button
              type="button"
              onClick={() => setBioOpen(true)}
              className="relative block w-full overflow-hidden rounded-xl bg-surface p-6 text-left transition-colors hover:bg-elevated/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
              aria-label={t('artist.bio.open', { name: artist.name })}
            >
              {artist.headerImageUrl && (
                <img
                  src={artist.headerImageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-10"
                />
              )}
              <p className="text-secondary leading-relaxed relative z-10">{artist.bio}</p>
              <p className="text-xs text-muted mt-4 relative z-10">{t('detail.followers', { n: formatNumber(artist.followerCount) })}</p>
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

function ArtistPopularTrackRow({
  track,
  index,
  active = false,
  playing = false,
  onPlay,
}: {
  track: Track
  index: number
  active?: boolean
  playing?: boolean
  onPlay: () => void
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const likedTrackIds = useLibraryStore((s) => s.likedTrackIds)
  const likeTrack = useLibraryStore((s) => s.likeTrack)
  const unlikeTrack = useLibraryStore((s) => s.unlikeTrack)
  const isLiked = likedTrackIds.has(track.id)

  const toggleLike = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Like songs with a free account', imageUrl: track.album.coverUrl })
      return
    }
    if (isLiked) unlikeTrack(track.id)
    else likeTrack(track)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPlay()
        }
      }}
      className="group grid min-h-[52px] cursor-pointer grid-cols-[24px_40px_minmax(0,1fr)_28px_44px] items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-white/[0.07] md:grid-cols-[24px_40px_minmax(0,1fr)_104px_28px_44px]"
    >
      <div className="flex h-8 w-6 items-center justify-center text-sm text-secondary">
        {/* Currently-playing row shows the animated equalizer; others show their rank.
            Hovering always swaps to a play/pause control. */}
        {active && playing ? (
          <>
            <NowPlayingBars className="group-hover:hidden" />
            <PauseIcon className="hidden h-4 w-4 text-primary group-hover:block" />
          </>
        ) : (
          <>
            <span className={cn('group-hover:hidden', active && 'text-accent')}>{index + 1}</span>
            <PlayIcon className="hidden h-4 w-4 text-primary group-hover:block" />
          </>
        )}
      </div>

      <img src={track.album.coverUrl} alt="" className="h-10 w-10 rounded object-cover shadow-md" />

      {/* Title only — the artist name is redundant on the artist's own page (Spotify style). */}
      <Link
        to={`/track/${track.id}`}
        onClick={(event) => event.stopPropagation()}
        className={cn('min-w-0 truncate text-sm font-normal hover:underline', active ? 'text-accent' : 'text-primary')}
      >
        {track.title}
      </Link>

      <span className="hidden justify-self-end text-sm font-normal text-secondary md:block">
        {formatNumber(track.playCount)}
      </span>

      <button
        type="button"
        onClick={toggleLike}
        aria-label={isLiked ? `Remove ${track.title} from Liked Songs` : `Save ${track.title} to Liked Songs`}
        className={cn(
          'flex items-center justify-center transition-opacity',
          isLiked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        <AnimatedLikeIcon liked={isLiked} className="h-4 w-4" heartClassName="h-4 w-4 text-secondary hover:text-primary" />
      </button>

      <span className="justify-self-end text-sm font-normal text-secondary">
        {formatMs(track.durationMs)}
      </span>
    </div>
  )
}
