import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PlayIcon, ClockIcon, HeartIcon as HeartSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { HeartIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { albumService } from '@/services/albumService'
import { trackService } from '@/services/trackService'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useTranslation } from '@/i18n/useTranslation'
import { TrackRow } from '@/components/cards/TrackRow'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatMs } from '@/utils/formatTime'
import { useDominantColor, withAlpha } from '@/hooks/useDominantColor'

export function AlbumDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [album, setAlbum] = useState<Album | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  useDocumentTitle(album ? `${album.title} · ${album.artist.name}` : null)
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const playWithGate = usePlaybackGate()
  const { savedAlbumIds, saveAlbum, unsaveAlbum } = useLibraryStore()
  const { isAuthenticated, user } = useAuthStore()
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const isPremium = user?.plan === 'premium'
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([albumService.getById(id), trackService.getByAlbum(id)]).then(([a, t]) => {
      setAlbum(a)
      setTracks(t)
      setLoading(false)
    })
  }, [id])

  const heroColor = useDominantColor(album?.coverUrl)

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  if (!album) return <div className="p-8 text-secondary">{t('detail.albumNotFound')}</div>

  const isSaved = savedAlbumIds.has(album.id)
  const totalDuration = tracks.reduce((acc, t) => acc + t.durationMs, 0)
  const handleDownload = async () => {
    if (!album) return
    setDownloading(true)
    try {
      await albumService.downloadZip(album.id, album.title)
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
      <div
        className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 p-4 sm:p-6 pb-4 bg-gradient-to-b from-accent-dim/40 to-transparent"
        style={{
          background: heroColor
            ? `linear-gradient(to bottom, ${withAlpha(heroColor, 0.7)} 0%, ${withAlpha(heroColor, 0.2)} 60%, transparent 100%)`
            : undefined,
        }}
      >
        <img
          src={album.coverUrl}
          alt={album.title}
          className="w-36 h-36 sm:w-44 sm:h-44 md:w-56 md:h-56 rounded-md shadow-2xl flex-shrink-0 object-cover self-center sm:self-auto"
        />
        <div className="min-w-0 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">{album.type.toUpperCase()}</Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mb-2 break-words">{album.title}</h1>
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
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 flex-wrap">
        <Button onClick={() => tracks.length && playWithGate(tracks[0], tracks)} size="lg" className="gap-2">
          <PlayIcon className="w-5 h-5" /> {t('common.play')}
        </Button>
        <button
          onClick={toggleSave}
          title={isSaved ? t('detail.removeFromLibrary') : t('detail.saveToLibrary')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
            isSaved
              ? 'border-accent text-accent hover:border-red-400 hover:text-red-400'
              : 'border-elevated/60 text-secondary hover:border-primary hover:text-primary'
          }`}
        >
          {isSaved ? <HeartSolid className="w-5 h-5" /> : <HeartIcon className="w-5 h-5" />}
          {isSaved ? t('common.saved') : t('detail.saveToLibrary')}
        </button>
        {isPremium ? (
          <button
            onClick={handleDownload}
            disabled={downloading}
            title={t('detail.downloadAlbum')}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-elevated/60 text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            {downloading ? t('common.downloading') : t('common.download')}
          </button>
        ) : (
          <Link
            to="/premium"
            title={t('detail.downloadPremiumTitle')}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-elevated/60 text-secondary hover:border-accent hover:text-accent transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            {t('common.download')}
            <span className="text-[10px] font-bold uppercase tracking-wide bg-accent/20 text-accent px-1.5 py-0.5 rounded">{t('common.premium')}</span>
          </Link>
        )}
      </div>

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
          <TrackRow key={track.id} track={track} index={i} queue={tracks} showPlayCount />
        ))}
      </div>
    </div>
  )
}
