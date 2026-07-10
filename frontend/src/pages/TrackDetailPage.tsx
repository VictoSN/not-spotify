import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowDownCircleIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import { trackService } from '@/services/trackService'
import { artistService } from '@/services/artistService'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { useDominantColor } from '@/hooks/useDominantColor'
import { DetailHero } from '@/components/common/DetailHero'
import { useTranslation } from '@/i18n/useTranslation'
import { Button } from '@/components/ui/Button'
import { LyricsView } from '@/components/player/LyricsView'
import { TrackRowMenu } from '@/components/cards/TrackRowMenu'
import { TrackRow } from '@/components/cards/TrackRow'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { CommentSection } from '@/components/comments/CommentSection'
import { SectionHeader } from '@/components/common/SectionHeader'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { Avatar } from '@/components/ui/Avatar'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'
import { notify } from '@/utils/toast'
import { usePlayerStore } from '@/stores/playerStore'
import { usePageLoading } from '@/hooks/usePageLoading'
import { saveTrackOffline } from '@/services/offlineAudio'
import { isDesktop } from '@/utils/platform'

export function TrackDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [track, setTrack] = useState<Track | null>(null)
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [syncedLyrics, setSyncedLyrics] = useState<string | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const loading = !!id && loadedId !== id
  usePageLoading(loading)
  const [loadError, setLoadError] = useState(false)
  // Same-artist recommendations shown under the lyrics. Kept relevant (never random):
  // the artist's own popular tracks and releases. Sections hide themselves when empty.
  const [artistTracks, setArtistTracks] = useState<Track[]>([])
  const [artistAlbums, setArtistAlbums] = useState<Album[]>([])

  useDocumentTitle(track ? `${track.title} · ${track.artist.name}` : null)

  const heroColor = useDominantColor(track?.album.coverUrl)
  const playWithGate = usePlaybackGate()
  const { likedTrackIds, likeTrack, unlikeTrack, savedPlaylists } = useLibraryStore()
  const { isAuthenticated, user } = useAuthStore()
  const isPremium = user?.plan === 'premium'
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const [downloading, setDownloading] = useState(false)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const pause = usePlayerStore((s) => s.pause)
  const resume = usePlayerStore((s) => s.resume)
  const seek = usePlayerStore((s) => s.seek)
  const isCurrentTrack = !!track && currentTrack?.id === track.id
  const isThisTrackPlaying = isCurrentTrack && isPlaying

  const isLiked = track ? likedTrackIds.has(track.id) : false
  const isSavedToPlaylist = track
    ? savedPlaylists.some((playlist) =>
        playlist.isOwner && (playlist.tracks ?? []).some((item) => item.track.id === track.id),
      )
    : false

  useEffect(() => {
    if (!id) return
    let active = true
    setLoadError(false)

    const load = async () => {
      try {
        const [nextTrack, lyricsResult] = await Promise.all([
          trackService.getById(id),
          trackService.getLyrics(id),
        ])
        const [nextArtistTracks, nextArtistAlbums] = await Promise.all([
          artistService.getTopTracks(nextTrack.artist.id, 6).catch(() => [] as Track[]),
          artistService.getAlbums(nextTrack.artist.id).catch(() => [] as Album[]),
        ])
        if (!active) return
        setTrack(nextTrack)
        setLyrics(lyricsResult.lyrics)
        setSyncedLyrics(lyricsResult.syncedLyrics)
        setArtistTracks(nextArtistTracks.filter((item) => item.id !== id).slice(0, 5))
        setArtistAlbums(nextArtistAlbums)
      } catch {
        if (!active) return
        setTrack(null)
        setLyrics(null)
        setSyncedLyrics(null)
        setArtistTracks([])
        setArtistAlbums([])
        setLoadError(true)
      } finally {
        if (active) setLoadedId(id)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [id])

  const handlePlay = () => {
    if (!track) return
    if (isCurrentTrack) {
      if (isPlaying) pause()
      else resume()
    } else {
      playWithGate(track, [track])
    }
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
    if (!track || !isPremium || !isDesktop()) return
    setDownloading(true)
    try {
      await saveTrackOffline(track)
      notify.success(`Saved “${track.title}” for offline`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('detail.downloadError'))
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return null

  if (loadError || !track) {
    return <div className="p-8 text-secondary">{t('detail.songNotFound')}</div>
  }

  const releaseYear = track.album.releaseDate.slice(0, 4)

  return (
    <div>
      <DetailHero
        heroColor={heroColor}
        coverUrl={track.album.coverUrl}
        coverAlt={track.album.title}
        eyebrow={t('detail.song')}
        title={
          <>
            {track.title}
            {track.explicit && (
              <span className="ml-2 text-xs font-semibold bg-elevated px-1.5 py-0.5 rounded text-secondary align-middle">
                E
              </span>
            )}
          </>
        }
        meta={
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
        }
        actions={
          <>
        {/* Play */}
        <Button onClick={handlePlay} size="lg" className="gap-2">
          {isThisTrackPlaying ? (
            <><PauseIcon className="w-5 h-5" /> {t('player.pause')}</>
          ) : (
            <><PlayIcon className="w-5 h-5" /> {t('common.play')}</>
          )}
        </Button>

        {/* Like */}
        <button
          onClick={toggleLike}
          title={isLiked ? t('player.unlike') : t('player.like')}
          className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
          aria-label={isLiked ? t('player.unlike') : t('player.like')}
        >
          <AnimatedLikeIcon liked={isLiked} className="w-7 h-7" heartClassName="w-7 h-7" />
          <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">
            {isLiked ? t('player.unlike') : t('player.like')}
          </span>
        </button>

        <TrackRowMenu
          track={track}
          alwaysVisible
          hideDownload
          openAddSubmenuOnTrigger
          triggerTitle="Add to playlist"
          triggerClassName="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
          triggerContent={
            <>
              {isSavedToPlaylist ? (
                <CheckCircleIcon className="liked-heart-pop h-7 w-7 text-accent" />
              ) : (
                <PlusCircleIcon className="h-7 w-7 stroke-[2.4]" />
              )}
              <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">Add to playlist</span>
            </>
          }
        />

        {/* Download (premium only) */}
        {isPremium && (
          <button
            onClick={handleDownload}
            disabled={downloading || !isDesktop()}
            title={!isDesktop() ? 'Available in the app' : 'Save for offline'}
            className="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:text-secondary"
            aria-label={!isDesktop() ? 'Available in the app' : 'Save for offline'}
          >
            <ArrowDownCircleIcon className="h-6 w-6 stroke-[2.5]" />
            <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">{!isDesktop() ? 'Available in the app' : 'Save for offline'}</span>
          </button>
        )}

        {/* More options menu: Copy embed lives here; Download stays in the toolbar above. */}
        <TrackRowMenu
          track={track}
          alwaysVisible
          hideDownload
          onCopyEmbed={handleCopyEmbed}
          triggerTitle="More options"
          triggerClassName="spotify-tooltip-anchor relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-all hover:scale-110 hover:text-primary active:scale-95"
          triggerIconClassName="h-6 w-6 stroke-[2.7]"
        />
          </>
        }
      />

      {/* ── Body: Lyrics + Artist card ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 px-4 sm:px-6 py-4">
        {/* Left: Lyrics (folded behind "Show more" when long) */}
        <div className="-mx-2 sm:mx-0">
          <section>
            <h2 className="mb-4 text-2xl font-bold text-primary">{t('detail.lyrics')}</h2>
            {/* Static on purpose — the karaoke view lives behind the player bar's mic button */}
            <LyricsView lyrics={lyrics} syncedLyrics={syncedLyrics} collapsible />
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
              <TrackRow key={tr.id} track={tr} index={i} queue={artistTracks} showPlayCount />
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

