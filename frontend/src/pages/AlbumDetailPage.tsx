import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PlayIcon, PauseIcon, ClockIcon, CheckCircleIcon, HeartIcon as HeartSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { ArrowDownCircleIcon, PaperAirplaneIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { albumService } from '@/services/albumService'
import { trackService } from '@/services/trackService'
import { artistService } from '@/services/artistService'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useTranslation } from '@/i18n/useTranslation'
import { TrackRow } from '@/components/cards/TrackRow'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { Button } from '@/components/ui/Button'
import { formatMs } from '@/utils/formatTime'
import { useDominantColor } from '@/hooks/useDominantColor'
import { DetailHero } from '@/components/common/DetailHero'
import { ShareToChatModal } from '@/components/chat/ShareToChatModal'
import { AlbumMenu } from '@/components/cards/AlbumMenu'
import { usePageLoading } from '@/hooks/usePageLoading'
import {
  collectionKey,
  getOfflineCollection,
  offlineCollectionToAlbum,
  offlineCollectionTracks,
  saveCollectionOffline,
} from '@/services/offlineAudio'
import { isDesktop } from '@/utils/platform'

export function AlbumDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [album, setAlbum] = useState<Album | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  // Other releases by the same artist (this album filtered out). Hidden when empty.
  const [moreAlbums, setMoreAlbums] = useState<Album[]>([])
  useDocumentTitle(album ? `${album.title} · ${album.artist.name}` : null)
  const isMobile = useIsMobile()
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const loading = !!id && loadedId !== id
  usePageLoading(loading)
  const startContext = usePlayContextGate()
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  // Album buttons derive their play/pause icon from the global player: this album
  // is "active" whenever the current track belongs to it (see usePlaybackContext).
  const { isActiveContext, isPlayingContext } = usePlaybackContext(id ? { type: 'album', id } : null)
  const { savedAlbumIds, saveAlbum, unsaveAlbum } = useLibraryStore()
  const { isAuthenticated, user, offlineMode } = useAuthStore()
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const isPremium = user?.plan === 'premium'
  const [downloading, setDownloading] = useState(false)
  const [shareToChatOpen, setShareToChatOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    const load = async () => {
      if (offlineMode) {
        const offline = getOfflineCollection(collectionKey('album', id))
        if (!active) return
        if (offline) {
          setAlbum(offlineCollectionToAlbum(offline))
          setTracks(offlineCollectionTracks(offline.key))
          setMoreAlbums([])
        } else {
          setAlbum(null)
          setTracks([])
          setMoreAlbums([])
        }
        setLoadedId(id)
        return
      }
      try {
        const [nextAlbum, nextTracks] = await Promise.all([
          albumService.getById(id),
          trackService.getByAlbum(id),
        ])
        const artistAlbums = await artistService.getAlbums(nextAlbum.artist.id).catch(() => [] as Album[])
        if (!active) return
        setAlbum(nextAlbum)
        setTracks(nextTracks)
        setMoreAlbums(artistAlbums.filter((item) => item.id !== id))
      } catch {
        if (!active) return
        // Offline fallback: if this album was downloaded, render it from the
        // saved local data (with cached covers) instead of "not found".
        const offline = getOfflineCollection(collectionKey('album', id))
        if (offline) {
          setAlbum(offlineCollectionToAlbum(offline))
          setTracks(offlineCollectionTracks(offline.key))
          setMoreAlbums([])
        } else {
          setAlbum(null)
          setTracks([])
          setMoreAlbums([])
        }
      } finally {
        if (active) setLoadedId(id)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [id, offlineMode])

  const heroColor = useDominantColor(album?.coverUrl)

  if (loading) return null
  if (!album) return <div className="p-8 text-secondary">{t('detail.albumNotFound')}</div>

  const isSaved = savedAlbumIds.has(album.id)
  const totalDuration = tracks.reduce((acc, t) => acc + t.durationMs, 0)
  const handleDownload = async () => {
    if (!album || !isDesktop()) return
    setDownloading(true)
    try {
      await saveCollectionOffline(
        { kind: 'album', id: album.id, name: album.title, subtitle: album.artist.name, coverUrl: album.coverUrl },
        tracks,
      )
    } finally {
      setDownloading(false)
    }
  }

  const toggleSave = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.saveMusicPrompt'), imageUrl: album.coverUrl })
      return
    }
    if (isSaved) unsaveAlbum(album.id)
    else saveAlbum(album)
  }

  return (
    <div>
      <DetailHero
        heroColor={heroColor}
        coverUrl={album.coverUrl}
        coverAlt={album.title}
        eyebrow={album.type.toUpperCase()}
        title={album.title}
        meta={
          <>
          {/* Stats row */}
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            {(album.ratingCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-sm text-yellow-400 font-semibold">
                <StarSolid className="w-4 h-4" />
                {(album.averageRating ?? 0).toFixed(1)}
                <span className="text-secondary font-normal ml-0.5">({(album.ratingCount ?? 0).toLocaleString()})</span>
              </span>
            )}
            <span className="flex items-center gap-1 text-sm text-secondary">
              <PlayIcon className="w-4 h-4" />
              {t('detail.plays', { n: (album.totalPlays ?? 0).toLocaleString() })}
            </span>
            <span className="flex items-center gap-1 text-sm text-secondary">
              <HeartSolid className="w-4 h-4 text-accent" />
              {t('detail.saves', { n: (album.totalSaves ?? 0).toLocaleString() })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {album.artist.imageUrl && (
              <img src={album.artist.imageUrl} alt={album.artist.name} className="w-6 h-6 rounded-full object-cover" />
            )}
            <Link to={`/artist/${album.artist.id}`} className="font-semibold text-primary hover:underline">
              {album.artist.name}
            </Link>
            <span className="text-secondary">·</span>
            <span className="text-secondary">{album.releaseDate.slice(0, 4)}</span>
            <span className="text-secondary">·</span>
            <span className="text-secondary">
              {t('detail.songsCount', { count: tracks.length, dur: formatMs(totalDuration) })}
            </span>
          </div>
          </>
        }
        actions={
          <>
        <Button
          onClick={() => {
            if (!tracks.length) return
            if (isActiveContext) togglePlayPause()
            else startContext({ type: 'album', id: album.id }, tracks)
          }}
          size="lg"
          className="gap-2"
        >
          {isPlayingContext ? (
            <><PauseIcon className="w-5 h-5" /> {t('player.pause')}</>
          ) : (
            <><PlayIcon className="w-5 h-5" /> {t('common.play')}</>
          )}
        </Button>
        <button
          onClick={toggleSave}
          title={isSaved ? t('detail.removeFromLibrary') : t('detail.saveToLibrary')}
          aria-label={isSaved ? t('detail.removeFromLibrary') : t('detail.saveToLibrary')}
          className={`spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 ${
            isSaved
              ? 'text-accent hover:text-primary'
              : 'text-secondary hover:text-primary'
          }`}
        >
          {isSaved ? <CheckCircleIcon className="liked-heart-pop h-7 w-7 text-accent" /> : <PlusCircleIcon className="h-7 w-7 stroke-[2.4]" />}
          <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">
            {isSaved ? t('detail.removeFromLibrary') : t('detail.saveToLibrary')}
          </span>
        </button>
        {isAuthenticated && (
          <button
            onClick={() => setShareToChatOpen(true)}
            title="Send to a friend in chat"
            aria-label="Send to a friend in chat"
            className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
          >
            <PaperAirplaneIcon className="h-6 w-6 stroke-[2.5]" />
            <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">Send to friend</span>
          </button>
        )}
        {isPremium ? (
          <button
            onClick={handleDownload}
            disabled={downloading || !isDesktop()}
            title={!isDesktop() ? 'Available in the app' : 'Save for offline'}
            aria-label={!isDesktop() ? 'Available in the app' : downloading ? t('common.downloading') : 'Save for offline'}
            className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:text-secondary"
          >
            <ArrowDownCircleIcon className="h-7 w-7 stroke-[2.4]" />
            <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">
              {!isDesktop() ? 'Available in the app' : downloading ? t('common.downloading') : 'Save for offline'}
            </span>
          </button>
        ) : (
          <Link
            to="/premium"
            title={t('detail.downloadPremiumTitle')}
            aria-label={t('detail.downloadPremiumTitle')}
            className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-accent active:scale-95"
          >
            <ArrowDownCircleIcon className="h-7 w-7 stroke-[2.4]" />
            <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">{t('common.download')} - {t('common.premium')}</span>
          </Link>
        )}
        <AlbumMenu
          album={album}
          alwaysVisible
          triggerClassName="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
          triggerIconClassName="h-6 w-6 stroke-[2.7]"
        />
          </>
        }
      />

      <div className="px-4">
        <div
          className="grid items-center gap-4 px-4 py-2 border-b border-elevated/30 mb-2"
          style={{ gridTemplateColumns: isMobile ? '16px 1fr var(--track-actions-width)' : '16px 6fr 3fr var(--track-actions-width)' }}
        >
          <span className="text-xs text-secondary">#</span>
          <span className="text-xs text-secondary uppercase tracking-wider">{t('detail.colTitle')}</span>
          <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">{t('detail.colPlays')}</span>
          <div className="grid grid-cols-[32px_50px_32px] sm:grid-cols-[80px_32px_50px_32px] items-center gap-1.5 sm:gap-2 justify-end w-[114px] sm:w-[194px] ml-auto">
            <span className="hidden sm:block" />
            <span />
            <span className="flex justify-end pr-1">
              <ClockIcon className="w-4 h-4 text-secondary" />
            </span>
            <span />
          </div>
        </div>
        {tracks.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} queue={tracks} showPlayCount context={{ type: 'album', id: album.id }} />
        ))}
      </div>

      {/* ── Genres ───────────────────────────────────────────────── */}
      {album.genres.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 sm:px-6 pt-6">
          {album.genres.map((genre) => (
            <Link
              key={genre}
              to={`/genres/${genre}`}
              className="rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold capitalize text-secondary transition-colors hover:bg-elevated/70 hover:text-primary"
            >
              {genre.replace(/-/g, ' ')}
            </Link>
          ))}
        </div>
      )}

      {/* ── Release info (date · label · copyright) ───────────────── */}
      <div className="px-4 sm:px-6 pt-6 text-xs text-secondary leading-5">
        <p className="text-sm text-primary">
          {new Date(album.releaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        {album.label && <p className="mt-1">{album.label}</p>}
        {album.copyright && <p className="text-muted">{album.copyright}</p>}
      </div>

      {/* ── More by this artist (relevant, never random) ─────────── */}
      {shareToChatOpen && (
        <ShareToChatModal payload={{ kind: 'album', album }} onClose={() => setShareToChatOpen(false)} />
      )}

      {moreAlbums.length > 0 && (
        <section className="px-4 sm:px-6 py-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-primary">{t('album.moreBy', { artist: album.artist.name })}</h2>
            <Link
              to={`/artist/${album.artist.id}`}
              className="text-xs font-semibold uppercase tracking-wider text-secondary transition-colors hover:text-primary"
            >
              {t('album.seeDiscography')}
            </Link>
          </div>
          <HorizontalScroller>
            {moreAlbums.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </HorizontalScroller>
        </section>
      )}
    </div>
  )
}
