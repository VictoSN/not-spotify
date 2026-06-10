import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  PlayIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { HeartIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { trackService } from '@/services/trackService'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useDominantColor } from '@/hooks/useDominantColor'
import { Spinner } from '@/components/ui/Spinner'
import { LyricsView } from '@/components/player/LyricsView'
import { TrackRowMenu } from '@/components/cards/TrackRowMenu'
import { Avatar } from '@/components/ui/Avatar'
import { formatMs } from '@/utils/formatTime'
import { formatNumber } from '@/utils/formatNumber'

export function TrackDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [track, setTrack] = useState<Track | null>(null)
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useDocumentTitle(track ? `${track.title} · ${track.artist.name}` : null)

  const heroColor = useDominantColor(track?.album.coverUrl)
  const playWithGate = usePlaybackGate()
  const { likedTrackIds, likeTrack, unlikeTrack } = useLibraryStore()
  const { isAuthenticated, user } = useAuthStore()
  const isPremium = user?.plan === 'premium'
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const [downloading, setDownloading] = useState(false)

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
      })
      .catch(() => setLoadError(true))
      .finally(() => {
        setLoading(false)
        setLyricsLoading(false)
      })
  }, [id])

  const handlePlay = () => {
    if (track) playWithGate(track, [track])
  }

  const toggleLike = () => {
    if (!track) return
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Like songs with a free account', imageUrl: track.album.coverUrl })
      return
    }
    if (isLiked) unlikeTrack(track.id)
    else likeTrack(track)
  }

  const handleDownload = async () => {
    if (!track || !isPremium) return
    setDownloading(true)
    try {
      const a = document.createElement('a')
      a.href = track.audioUrl
      a.download = `${track.title}.mp3`
      a.click()
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
    return <div className="p-8 text-secondary">Song not found.</div>
  }

  const releaseYear = track.album.releaseDate.slice(0, 4)

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 p-4 sm:p-6 pb-4 bg-gradient-to-b from-accent-dim/40 to-transparent"
        style={{
          background: heroColor
            ? `linear-gradient(to bottom, ${heroColor}b3 0%, ${heroColor}33 60%, transparent 100%)`
            : undefined,
        }}
      >
        {/* Cover */}
        <img
          src={track.album.coverUrl}
          alt={track.album.title}
          className="w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-md shadow-2xl flex-shrink-0 object-cover self-center sm:self-auto"
        />

        {/* Meta */}
        <div className="min-w-0 pb-2">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Song</p>
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
            <span className="text-secondary">{formatNumber(track.playCount)} plays</span>
          </div>
        </div>
      </div>

      {/* ── Action bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 sm:px-6 py-4">
        {/* Play */}
        <button
          onClick={handlePlay}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-accent hover:bg-accent/80 active:scale-95 transition-all shadow-lg"
          aria-label="Play"
        >
          <PlayIcon className="w-6 h-6 text-white ml-0.5" />
        </button>

        {/* Like */}
        <button
          onClick={toggleLike}
          className="flex items-center justify-center w-10 h-10 rounded-full text-secondary hover:text-primary transition-colors"
          aria-label={isLiked ? 'Unlike' : 'Like'}
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
            aria-label="Download"
          >
            <ArrowDownTrayIcon className="w-6 h-6" />
          </button>
        )}

        {/* More options menu */}
        <TrackRowMenu track={track} alwaysVisible />
      </div>

      {/* ── Body: Lyrics + Artist card ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 px-4 sm:px-6 py-4 pb-12">
        {/* Left: Lyrics */}
        <section>
          <h2 className="text-2xl font-bold text-primary mb-4">Lyrics</h2>
          <LyricsView lyrics={lyrics} loading={lyricsLoading} />
        </section>

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
                Artist
              </p>
              <p className="font-bold text-primary group-hover:underline truncate">
                {track.artist.name}
              </p>
            </div>
          </Link>
        </aside>
      </div>
    </div>
  )
}
