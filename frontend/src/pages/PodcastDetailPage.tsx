import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MicrophoneIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { CheckCircleIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import type { Episode, Podcast, PodcastSummary } from '@/types/podcast'
import { episodeToTrack } from '@/types/podcast'
import { podcastService } from '@/services/podcastService'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatMs, timeAgo } from '@/utils/formatTime'
import { EpisodeMenu, type EpisodeMenuHandle } from '@/components/cards/EpisodeMenu'
import { openMenuAtPointer } from '@/utils/contextMenu'
import type { Track } from '@/types/track'
import { notify } from '@/utils/toast'

export function PodcastDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [podcast, setPodcast] = useState<Podcast | null>(null)
  const [loading, setLoading] = useState(true)

  const play = usePlayerStore((s) => s.play)

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const savedPodcastIds = useLibraryStore((s) => s.savedPodcastIds)
  const savePodcast = useLibraryStore((s) => s.savePodcast)
  const unsavePodcast = useLibraryStore((s) => s.unsavePodcast)
  const isSaved = podcast ? savedPodcastIds.has(podcast.id) : false

  useDocumentTitle(podcast ? podcast.title : 'Podcast')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    podcastService
      .getById(id)
      .then((p) => { if (!cancelled) setPodcast(p) })
      .catch(() => { if (!cancelled) setPodcast(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const queue = useMemo(
    () => (podcast ? podcast.episodes.map((ep) => episodeToTrack(ep, podcast)) : []),
    [podcast],
  )

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  if (!podcast) return <div className="p-8 text-secondary">Podcast not found.</div>

  const toggleSave = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Save podcasts with a free account', imageUrl: podcast.imageUrl })
      return
    }
    if (isSaved) {
      unsavePodcast(podcast.id)
      notify.success('Removed from Your Library')
    } else {
      const summary: PodcastSummary = {
        id: podcast.id,
        title: podcast.title,
        author: podcast.author,
        description: podcast.description,
        category: podcast.category,
        imageUrl: podcast.imageUrl,
        episodeCount: podcast.episodes.length,
        createdAt: podcast.createdAt,
      }
      savePodcast(summary)
      notify.success('Saved to Your Library')
    }
  }

  return (
    <div>
      <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-8 sm:flex-row sm:items-end">
        <div className="flex h-44 w-44 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-elevated shadow-xl">
          {podcast.imageUrl ? (
            <img src={podcast.imageUrl} alt={podcast.title} className="h-full w-full object-cover" />
          ) : (
            <MicrophoneIcon className="h-16 w-16 text-secondary/60" />
          )}
        </div>
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-secondary">Podcast</p>
          <h1 className="mt-1 text-3xl font-black text-primary sm:text-4xl">{podcast.title}</h1>
          <p className="mt-2 text-sm font-semibold text-primary">{podcast.author}</p>
          {podcast.description && (
            <p className="mt-2 max-w-2xl text-sm text-secondary">{podcast.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 pb-2">
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={isSaved}
          className="inline-flex items-center gap-2 rounded-full border border-secondary/40 px-4 py-2 text-sm font-bold text-primary transition-colors hover:border-primary"
        >
          {isSaved ? (
            <CheckCircleIcon className="h-5 w-5 text-accent" />
          ) : (
            <PlusCircleIcon className="h-5 w-5" />
          )}
          {isSaved ? 'In Your Library' : 'Save'}
        </button>
      </div>

      <div className="px-6 py-4">
        <h2 className="mb-3 text-xl font-bold text-primary">
          {podcast.episodes.length} {podcast.episodes.length === 1 ? 'episode' : 'episodes'}
        </h2>
        <ul className="divide-y divide-elevated/40">
          {podcast.episodes.map((ep, i) => (
            <EpisodeRow key={ep.id} episode={ep} podcast={podcast} index={i} queue={queue} onPlay={play} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function EpisodeRow({
  episode: ep,
  podcast,
  index,
  queue,
  onPlay,
}: {
  episode: Episode
  podcast: Podcast
  index: number
  queue: Track[]
  onPlay: (track: Track, queue: Track[]) => void
}) {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const menuRef = useRef<EpisodeMenuHandle>(null)
  const isCurrent = currentTrack?.id === ep.id
  const isThisPlaying = isCurrent && isPlaying

  return (
    <li
      className="group flex items-start gap-4 py-4"
      onContextMenu={(e) => openMenuAtPointer(e, menuRef)}
    >
      <button
        type="button"
        onClick={() => (isCurrent ? togglePlayPause() : onPlay(episodeToTrack(ep, podcast), queue))}
        aria-label={isThisPlaying ? `Pause ${ep.title}` : `Play ${ep.title}`}
        className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-page transition-transform hover:scale-105"
      >
        {isThisPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5 translate-x-[1px]" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`font-semibold ${isCurrent ? 'text-accent' : 'text-primary'}`}>
          {ep.title}
        </div>
        {ep.description && (
          <p className="mt-1 line-clamp-2 text-sm text-secondary">{ep.description}</p>
        )}
        <div className="mt-1 text-xs text-secondary">
          {timeAgo(ep.publishedAt)} · {formatMs(ep.durationMs)}
        </div>
      </div>
      <div className="flex items-center gap-2 self-center">
        <EpisodeMenu ref={menuRef} episode={ep} podcast={podcast} queue={queue} />
        <span className="hidden w-6 text-right text-sm text-secondary sm:block">{index + 1}</span>
      </div>
    </li>
  )
}
