import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MicrophoneIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import type { Podcast } from '@/types/podcast'
import { episodeToTrack } from '@/types/podcast'
import { podcastService } from '@/services/podcastService'
import { usePlayerStore } from '@/stores/playerStore'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatMs, timeAgo } from '@/utils/formatTime'

export function PodcastDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [podcast, setPodcast] = useState<Podcast | null>(null)
  const [loading, setLoading] = useState(true)

  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const play = usePlayerStore((s) => s.play)
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)

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

      <div className="px-6 py-4">
        <h2 className="mb-3 text-xl font-bold text-primary">
          {podcast.episodes.length} {podcast.episodes.length === 1 ? 'episode' : 'episodes'}
        </h2>
        <ul className="divide-y divide-elevated/40">
          {podcast.episodes.map((ep, i) => {
            const isCurrent = currentTrack?.id === ep.id
            const isThisPlaying = isCurrent && isPlaying
            return (
              <li key={ep.id} className="flex items-start gap-4 py-4">
                <button
                  type="button"
                  onClick={() => (isCurrent ? togglePlayPause() : play(episodeToTrack(ep, podcast), queue))}
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
                <span className="hidden w-6 text-right text-sm text-secondary sm:block">{i + 1}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
