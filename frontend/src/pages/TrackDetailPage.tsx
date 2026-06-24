import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  PlayIcon,
  ArrowDownTrayIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { HeartIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import { trackService } from '@/services/trackService'
import { artistService } from '@/services/artistService'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useDominantColor, heroGradient } from '@/hooks/useDominantColor'
import { useTranslation } from '@/i18n/useTranslation'
import { Spinner } from '@/components/ui/Spinner'
import { LyricsView } from '@/components/player/LyricsView'
import { TrackRowMenu, type TrackRowMenuHandle } from '@/components/cards/TrackRowMenu'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { CommentSection } from '@/components/comments/CommentSection'
import { SectionHeader } from '@/components/common/SectionHeader'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { Avatar } from '@/components/ui/Avatar'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'
import { notify } from '@/utils/toast'
import { usePlayerStore } from '@/stores/playerStore'
import { useDragStore } from '@/stores/dragStore'
import { TRACK_DND_MIME, setTrackDragImage } from '@/utils/trackDnd'
import { openMenuAtPointer } from '@/utils/contextMenu'

export function TrackDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [track, setTrack] = useState<Track | null>(null)
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [syncedLyrics, setSyncedLyrics] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // Same-artist recommendations shown under the lyrics. Kept relevant (never random):
  // the artist's own popular tracks and releases. Sections hide themselves when empty.
  const [artistTracks, setArtistTracks] = useState<Track[]>([])
  const [artistAlbums, setArtistAlbums] = useState<Album[]>([])

  useDocumentTitle(track ? `${track.title} · ${track.artist.name}` : null)

  const heroColor = useDominantColor(track?.album.coverUrl)
  const playWithGate = usePlaybackGate()
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()
  const { isAuthenticated, user } = useAuthStore()
  const isPremium = user?.plan === 'premium'
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const [downloading, setDownloading] = useState(false)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const seek = usePlayerStore((s) => s.seek)

  const isLiked = track ? likedTrackIds.has(track.id) : false

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLyricsLoading(true)
    setLoadError(false)

    // Fetch track info and lyrics in parallel
    Promise.all([
      trackService.getById(id),
      trackService.getLyrics(id),
    ])
      .then(([t, lyricsRes]) => {
        setTrack(t)
        setLyrics(lyricsRes.lyrics)
        setSyncedLyrics(lyricsRes.syncedLyrics)
      })
      .catch(() => setLoadError(true))
      .finally(() => {
        setLoading(false)
        setLyricsLoading(false)
      })
  }, [id])

  // Once the track is known, pull the artist's popular tracks (minus this one) and
  // releases for the recommendation rows. Independent of the main load — failures
  // just leave the rows empty rather than breaking the page.
  const artistId = track?.artist.id
  useEffect(() => {
    if (!artistId) return
    let active = true
    artistService
      .getTopTracks(artistId, 6)
      .then((tracks) => {
        if (active) setArtistTracks(tracks.filter((tr) => tr.id !== id).slice(0, 5))
      })
      .catch(() => active && setArtistTracks([]))
    artistService
      .getAlbums(artistId)
      .then((albums) => active && setArtistAlbums(albums))
      .catch(() => active && setArtistAlbums([]))
    return () => {
      active = false
    }
  }, [artistId, id])

  const handlePlay = () => {
    if (track) playWithGate(track, [track])
  }

  const handleSeek = (seconds: number) => {
    if (!track) return
    if (currentTrack?.id !== track.id) playWithGate(track, [track])
    seek(seconds)
  }

  const toggleLike = () => {
    if (!track) return
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.likeSongsPrompt'), imageUrl: track.album.coverUrl })
      return
    }
    if (isLiked) unlikeTrack(track.id)
    else likeTrack(track)
  }

  const handleCopyEmbed = async () => {
    if (!track) return
    const src = `${window.location.origin}/embed/track/${track.id}`
    const code = `<iframe src="${src}" width="100%" height="152" frameborder="0" loading="lazy" title="${track.title} — ${track.artist.name}" style="border-radius:12px"></iframe>`
    try {
      await navigator.clipboard.writeText(code)
      notify.success(t('detail.embedCopied'))
    } catch {
      notify.error(t('detail.embedCopyError'))
    }
  }

  const handleDownload = async () => {
    if (!track || !isPremium) return
    setDownloading(true)
    try {
      await trackService.download(track.id, track.title)
      notify.success(t('detail.downloadStarted'))
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('detail.downloadError'))
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (loadError || !track) {
    return <div className="p-8 text-secondary">{t('detail.songNotFound')}</div>
  }

  const releaseYear = track.album.releaseDate.slice(0, 4)

  return (
    <div>
      {/* ── Hero + actions: fuller colour block behind the cover, fading below ── */}
      <div style={{ background: heroGradient(heroColor) }}>
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 p-4 sm:p-6 pb-4">
        {/* Cover */}
        <img
          src={track.album.coverUrl}
          alt={track.album.title}
          className="w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-md shadow-2xl flex-shrink-0 object-cover self-center sm:self-auto"
        />

        {/* Meta */}
        <div className="min-w-0 pb-2">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">{t('detail.song')}</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mb-3 break-words">
            {track.title}
            {track.explicit && (
              <span className="ml-2 text-xs font-semibold bg-elevated px-1.5 py-0.5 rounded text-secondary align-middle">
                E
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {track.artist.imageUrl && (
              <img
                src={track.artist.imageUrl}
                alt={track.artist.name}
                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
              />
            )}
            <Link
              to={`/artist/${track.artist.id}`}
              className="font-semibold text-primary hover:underline"
            >
              {track.artist.name}
            </Link>
            <span className="text-secondary">·</span>
            <Link
              to={`/album/${track.album.id}`}
              className="text-secondary hover:text-primary hover:underline"
            >
              {track.album.title}
            </Link>
            <span className="text-secondary">·</span>
            <span className="text-secondary">{releaseYear}</span>
            <span className="text-secondary">·</span>
            <span className="text-secondary">{formatMs(track.durationMs)}</span>
            <span className="text-secondary">·</span>
            <span className="text-secondary">{t('detail.plays', { n: formatNumber(track.playCount) })}</span>
          </div>
        </div>
      </div>

      {/* ── Action bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 sm:px-6 py-4">
        {/* Play */}
        <button
          onClick={handlePlay}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-accent hover:bg-accent/80 active:scale-95 transition-all shadow-lg"
          aria-label={t('common.play')}
        >
          <PlayIcon className="w-6 h-6 text-white ml-0.5" />
        </button>

        {/* Like */}
        <button
          onClick={toggleLike}
          className="flex items-center justify-center w-10 h-10 rounded-full text-secondary hover:text-primary transition-colors"
          aria-label={isLiked ? t('player.unlike') : t('player.like')}
        >
          {isLiked ? (
            <HeartSolid className="w-7 h-7 text-accent" />
          ) : (
            <HeartIcon className="w-7 h-7" />
          )}
        </button>

        {/* Download (premium only) */}
        {isPremium && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center justify-center w-10 h-10 rounded-full text-secondary hover:text-primary transition-colors disabled:opacity-50"
            aria-label={t('common.download')}
          >
            <ArrowDownTrayIcon className="w-6 h-6" />
          </button>
        )}

        {/* Copy embed code */}
        <button
          onClick={handleCopyEmbed}
          className="flex items-center justify-center w-10 h-10 rounded-full text-secondary hover:text-primary transition-colors"
          aria-label={t('detail.embed')}
          title={t('detail.embed')}
        >
          <CodeBracketIcon className="w-6 h-6" />
        </button>

        {/* More options menu — hide its Download item; the toolbar above already has one. */}
        <TrackRowMenu track={track} alwaysVisible hideDownload />
      </div>
      </div>

      {/* ── Body: Lyrics + Artist card ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 px-4 sm:px-6 py-4">
        {/* Left: Lyrics (folded behind "Show more" when long) */}
        <div>
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">{t('detail.lyrics')}</h2>
            {/* Static on purpose — the karaoke view lives behind the player bar's mic button */}
            <LyricsView lyrics={lyrics} syncedLyrics={syncedLyrics} loading={lyricsLoading} collapsible />
          </section>
        </div>

        {/* Right: Artist card */}
        <aside>
          <Link
            to={`/artist/${track.artist.id}`}
            className="flex items-center gap-4 p-4 rounded-lg bg-elevated hover:bg-elevated/70 transition-colors group"
          >
            <Avatar
              src={track.artist.imageUrl}
              alt={track.artist.name}
              size="lg"
              round
              className="flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs text-secondary uppercase tracking-wider font-semibold mb-0.5">
                {t('detail.artistLabel')}
              </p>
              <p className="font-bold text-primary group-hover:underline truncate">
                {track.artist.name}
              </p>
            </div>
          </Link>
        </aside>
      </div>

      {/* ── More from this artist (relevant, never random) ───────── */}
      {artistTracks.length > 0 && (
        <section className="px-4 py-4 sm:px-6">
          <div className="mb-5">
            <p className="mb-2 text-sm font-bold leading-4 text-secondary">Popular Tracks by</p>
            <Link
              to={`/artist/${track.artist.id}`}
              className="inline-block max-w-full truncate text-2xl font-black leading-7 text-primary hover:underline"
            >
              {track.artist.name}
            </Link>
          </div>
          <div>
            {artistTracks.map((tr, i) => (
              <PopularArtistTrackRow key={tr.id} track={tr} index={i} queue={artistTracks} />
            ))}
          </div>
          <Link
            to={`/artist/${track.artist.id}`}
            className="mt-4 inline-block px-3 text-sm font-bold text-secondary transition-colors hover:text-primary"
          >
            See more
          </Link>
        </section>
      )}

      {artistAlbums.length > 0 && (
        <section className="px-4 sm:px-6 py-4">
          <SectionHeader
            title={t('detail.popularReleasesBy', { artist: track.artist.name })}
            href={`/artist/${track.artist.id}`}
          />
          <HorizontalScroller>
            {artistAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </HorizontalScroller>
        </section>
      )}

      {/* ── Comments ─────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-4 pb-12">
        <CommentSection
          trackId={track.id}
          trackTitle={track.title}
          durationMs={track.durationMs}
          waveform={track.waveform}
          onSeek={handleSeek}
        />
      </div>
    </div>
  )
}

function PopularArtistTrackRow({
  track,
  index,
  queue,
}: {
  track: Track
  index: number
  queue: Track[]
}) {
  const playWithGate = usePlaybackGate()
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const setDraggedTrack = useDragStore((s) => s.setDraggedTrack)
  const menuTriggerRef = useRef<TrackRowMenuHandle>(null)
  const isLiked = likedTrackIds.has(track.id)

  const play = () => playWithGate(track, queue)

  const toggleLike = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Like songs with a free account', imageUrl: track.album.coverUrl })
      return
    }
    if (isLiked) void unlikeTrack(track.id)
    else void likeTrack(track)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={play}
      onContextMenu={(event) => openMenuAtPointer(event, menuTriggerRef)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          play()
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copy'
        event.dataTransfer.setData(TRACK_DND_MIME, track.id)
        event.dataTransfer.setData('text/plain', `${track.title} - ${track.artist.name}`)
        setTrackDragImage(event, track)
        setDraggedTrack(track)
        event.currentTarget.style.opacity = '0.4'
      }}
      onDragEnd={(event) => {
        setDraggedTrack(null)
        event.currentTarget.style.opacity = ''
      }}
      className="group grid h-14 cursor-pointer grid-cols-[32px_48px_minmax(0,1fr)_52px] items-center gap-3 rounded px-3 transition-colors hover:bg-white/[0.08] focus-visible:bg-white/[0.08] focus-visible:outline-none md:grid-cols-[36px_48px_minmax(0,1fr)_minmax(120px,0.48fr)_40px_52px_32px]"
    >
      <div className="flex items-center justify-center text-sm font-semibold text-secondary">
        <span className="group-hover:hidden">{index + 1}</span>
        <PlayIcon className="hidden h-4 w-4 text-primary group-hover:block" />
      </div>

      <img
        src={track.album.coverUrl}
        alt=""
        draggable={false}
        className="h-12 w-12 rounded-sm object-cover shadow-md"
      />

      <div className="min-w-0">
        <Link
          to={`/track/${track.id}`}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          className="block truncate text-base font-bold leading-5 text-primary hover:underline"
        >
          {track.title}
        </Link>
        <Link
          to={`/artist/${track.artist.id}`}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          className="mt-0.5 block truncate text-sm font-semibold leading-5 text-secondary transition-colors hover:text-primary hover:underline"
        >
          {track.artist.name}
        </Link>
      </div>

      <span className="hidden truncate text-sm font-semibold text-secondary md:block">
        {formatNumber(track.playCount)}
      </span>

      <button
        type="button"
        onClick={toggleLike}
        aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
        className={`hidden justify-self-center transition-opacity md:block ${
          isLiked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {isLiked ? (
          <CheckCircleIcon className="h-5 w-5 text-accent" />
        ) : (
          <HeartIcon className="h-5 w-5 text-secondary transition-colors hover:text-primary" />
        )}
      </button>

      <span className="justify-self-end text-sm font-semibold text-secondary">
        {formatMs(track.durationMs)}
      </span>

      <div
        className="hidden justify-self-end md:block"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <TrackRowMenu
          track={track}
          ref={menuTriggerRef}
          triggerClassName="rounded-full p-1 text-secondary hover:text-primary"
          triggerIconClassName="h-5 w-5"
        />
      </div>
    </div>
  )
}
