import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PlayIcon } from '@heroicons/react/24/solid'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { ShareIcon, MapPinIcon } from '@heroicons/react/24/outline'
import type { Artist, TourDate } from '@/types/artist'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import { artistService } from '@/services/artistService'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { TrackRow } from '@/components/cards/TrackRow'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/common/SectionHeader'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { formatNumber } from '@/utils/formatNumber'
import { shareLink } from '@/utils/share'
import { useTranslation } from '@/i18n/useTranslation'

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
  const playWithGate = usePlaybackGate()
  const { followedArtistIds, followArtist, unfollowArtist } = useLibraryStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)

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
  const toggleFollow = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.followArtistPrompt'), imageUrl: artist.imageUrl })
      return
    }
    if (isFollowing) unfollowArtist(artist.id)
    else followArtist(artist)
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative h-72 sm:h-80 overflow-hidden">
        {artist.headerImageUrl ? (
          <img src={artist.headerImageUrl} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-accent-dim to-page" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-page via-page/40 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3 sm:gap-4 sm:bottom-6 sm:left-6 sm:right-6">
          {artist.imageUrl && (
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className="w-16 h-16 sm:w-24 sm:h-24 rounded-full object-cover shadow-2xl border-2 border-elevated flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {artist.verified && <CheckBadgeIcon className="w-5 h-5 text-accent" />}
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">{t('detail.artistLabel')}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-primary drop-shadow-lg truncate">{artist.name}</h1>
            <p className="text-secondary text-sm mt-1">{t('detail.monthlyListeners', { n: formatNumber(artist.monthlyListeners) })}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 py-4">
        {topTracks.length > 0 && (
          <Button onClick={() => playWithGate(topTracks[0], topTracks)} size="lg" className="gap-2">
            <PlayIcon className="w-5 h-5" /> {t('common.play')}
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

      {/* Popular tracks */}
      {topTracks.length > 0 && (
        <section className="px-4 mb-8">
          <SectionHeader title={t('detail.popular')} />
          {topTracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} queue={topTracks} showPlayCount />
          ))}
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

      {/* Bio */}
      {artist.bio && (
        <section className="px-6 mb-8">
          <SectionHeader title={t('detail.about')} />
          <div className="bg-surface rounded-xl p-6 relative overflow-hidden">
            {artist.headerImageUrl && (
              <img
                src={artist.headerImageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-10"
              />
            )}
            <p className="text-secondary leading-relaxed relative z-10">{artist.bio}</p>
            <p className="text-xs text-muted mt-4 relative z-10">{t('detail.followers', { n: formatNumber(artist.followerCount) })}</p>
          </div>
        </section>
      )}

      {/* On tour */}
      {tourDates.length > 0 && (
        <section className="px-6 mb-8">
          <SectionHeader title={t('detail.onTour')} />
          <div className="flex flex-col gap-2">
            {tourDates.map((d) => {
              const date = new Date(d.eventDate)
              const region = (() => {
                try { return new Intl.DisplayNames(undefined, { type: 'region' }).of(d.country) ?? d.country }
                catch { return d.country }
              })()
              return (
                <div key={d.id} className="flex items-center gap-4 rounded-lg bg-surface px-4 py-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-elevated text-center leading-none">
                    <span className="text-[10px] font-bold uppercase text-secondary">
                      {date.toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-lg font-black text-primary">{date.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-primary">{d.city}, {region}</p>
                    <p className="truncate text-xs text-secondary">
                      <MapPinIcon className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
                      {d.venue}
                    </p>
                  </div>
                  {d.ticketUrl && (
                    <a
                      href={d.ticketUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full border border-secondary/50 px-4 py-1.5 text-xs font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95"
                    >
                      {t('detail.tickets')}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
