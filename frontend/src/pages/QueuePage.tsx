import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Bars3Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  MusicalNoteIcon,
  QueueListIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { TrackCard } from '@/components/cards/TrackCard'
import { NowPlayingBars } from '@/components/common/NowPlayingBars'
import { useAuthStore } from '@/stores/authStore'
import { usePlayerStore } from '@/stores/playerStore'
import { cn } from '@/utils/cn'

export function QueuePage() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const recommendedIds = usePlayerStore((s) => s.recommendedIds)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const reorderQueue = usePlayerStore((s) => s.reorderQueue)
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue)
  const isPremium = useAuthStore((s) => s.user?.capabilities?.unlimitedPlayback !== false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Already-played tracks from THIS queue, in play order (oldest first; the most
  // recent sits just above "Now playing").
  const played = queueIndex > 0 ? queue.slice(0, queueIndex) : []
  const upNext = queueIndex >= 0 ? queue.slice(queueIndex + 1) : queue
  // Up next splits at the first autoplay/radio recommendation: everything before is
  // the album/playlist the user started, everything after is the radio continuation.
  const radioOffset = upNext.findIndex((t) => recommendedIds.has(t.id))
  const explicitNext = radioOffset === -1 ? upNext : upNext.slice(0, radioOffset)
  const radioNext = radioOffset === -1 ? [] : upNext.slice(radioOffset)
  const radioSeed = radioNext.length > 0 ? queue[queueIndex + 1 + radioOffset - 1] : null

  const hasQueueState = Boolean(currentTrack || upNext.length || played.length)

  const move = (fromIndex: number, toIndex: number) => {
    if (!isPremium || toIndex <= queueIndex || fromIndex === toIndex) return
    reorderQueue(fromIndex, toIndex)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>, toIndex: number) => {
    event.preventDefault()
    const fromIndex = Number(event.dataTransfer.getData('text/plain'))
    if (!Number.isNaN(fromIndex)) move(fromIndex, toIndex)
    setDragOverIndex(null)
  }

  const editableRow = (track: Track, absoluteIndex: number) => (
    <QueueRow
      key={`${track.id}-${absoluteIndex}`}
      track={track}
      queue={queue}
      absoluteIndex={absoluteIndex}
      canEdit={isPremium}
      isDragTarget={dragOverIndex === absoluteIndex}
      onMove={move}
      onRemove={() => removeFromQueue(absoluteIndex)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(absoluteIndex))
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverIndex(absoluteIndex)
      }}
      onDragLeave={() => setDragOverIndex(null)}
      onDrop={(e) => handleDrop(e, absoluteIndex)}
      onDragEnd={() => setDragOverIndex(null)}
    />
  )

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 flex items-center gap-3">
          <QueueListIcon className="h-8 w-8 text-accent" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold text-primary">Queue</h1>
            <p className="text-sm text-secondary">Now playing and up next</p>
          </div>
        </div>

        {!hasQueueState ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-secondary/15 bg-surface/50 px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-elevated text-secondary">
              <MusicalNoteIcon className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold text-primary">Your queue is empty</h2>
            <p className="mt-2 max-w-sm text-sm text-secondary">Start a song or add tracks from any song menu.</p>
            <Link
              to="/search"
              className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-accent-dark"
            >
              Find music
            </Link>
          </div>
        ) : (
          <div className="grid gap-8">
            {played.length > 0 && (
              <QueueSection title="Previously played">
                <div role="list" aria-label="Previously played tracks" className="grid gap-1">
                  {played.map((track, i) => (
                    <QueueRow key={`played-${track.id}-${i}`} track={track} queue={queue} dimmed />
                  ))}
                </div>
              </QueueSection>
            )}

            {currentTrack && (
              <QueueSection title="Now playing">
                <QueueRow
                  track={currentTrack}
                  queue={queue.length ? queue : [currentTrack]}
                  trailing={<NowPlayingBars className="h-3.5" playing={isPlaying} />}
                />
              </QueueSection>
            )}

            {explicitNext.length > 0 && (
              <QueueSection title="Up next" aside={!isPremium ? 'Premium queue editing' : undefined}>
                <div role="list" aria-label="Up next tracks" className="grid gap-1">
                  {explicitNext.map((track, i) => editableRow(track, queueIndex + 1 + i))}
                </div>
              </QueueSection>
            )}

            {radioNext.length > 0 && (
              <QueueSection
                title={
                  <span className="inline-flex items-center gap-1.5">
                    <SparklesIcon className="h-5 w-5 text-accent" aria-hidden="true" />
                    Radio
                    {radioSeed && (
                      <span className="text-base font-normal text-secondary">· based on {radioSeed.title}</span>
                    )}
                  </span>
                }
              >
                <div role="list" aria-label="Radio tracks" className="grid gap-1">
                  {radioNext.map((track, i) => editableRow(track, queueIndex + 1 + explicitNext.length + i))}
                </div>
              </QueueSection>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function QueueSection({
  title,
  aside,
  children,
}: {
  title: React.ReactNode
  aside?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex min-h-7 items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-primary">{title}</h2>
        {aside && <span className="text-xs font-semibold text-secondary">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

function QueueRow({
  track,
  queue,
  dimmed,
  trailing,
  absoluteIndex,
  canEdit,
  isDragTarget,
  onMove,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  track: Track
  queue: Track[]
  dimmed?: boolean
  trailing?: React.ReactNode
  absoluteIndex?: number
  canEdit?: boolean
  isDragTarget?: boolean
  onMove?: (fromIndex: number, toIndex: number) => void
  onRemove?: () => void
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void
  onDragLeave?: () => void
  onDrop?: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd?: () => void
}) {
  const editable = Boolean(canEdit && absoluteIndex != null)

  return (
    <div
      role="listitem"
      draggable={editable}
      onDragStart={editable ? onDragStart : undefined}
      onDragOver={editable ? onDragOver : undefined}
      onDragLeave={editable ? onDragLeave : undefined}
      onDrop={editable ? onDrop : undefined}
      onDragEnd={editable ? onDragEnd : undefined}
      className={cn(
        'group flex items-center gap-1 rounded-md transition-colors',
        dimmed && 'opacity-60',
        editable && 'cursor-grab active:cursor-grabbing',
        isDragTarget && 'bg-elevated/60 ring-1 ring-accent/60',
      )}
    >
      {/* Fixed-width handle gutter — kept on every row so all covers line up; the
          drag handle only appears on editable rows, sitting to the left of the cover. */}
      <div className="flex w-5 shrink-0 justify-center">
        {editable && <Bars3Icon className="h-4 w-4 text-secondary/40" aria-hidden="true" />}
      </div>

      <div className="min-w-0 flex-1">
        <TrackCard track={track} queue={queue} />
      </div>

      {/* Fixed-width action gutter, present on every row so the duration / like / menu
          column inside TrackCard lines up across all sections. Per-row controls (the
          equalizer, or the move/remove buttons) sit here, to the right of the duration. */}
      <div className="flex w-[104px] shrink-0 items-center justify-end gap-1 pr-1">
        {trailing}
        {editable && (
          <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <QueueIconButton
              label={`Move ${track.title} up`}
              onClick={() => absoluteIndex != null && onMove?.(absoluteIndex, absoluteIndex - 1)}
            >
              <ChevronUpIcon className="h-4 w-4" />
            </QueueIconButton>
            <QueueIconButton
              label={`Move ${track.title} down`}
              onClick={() => absoluteIndex != null && onMove?.(absoluteIndex, absoluteIndex + 1)}
            >
              <ChevronDownIcon className="h-4 w-4" />
            </QueueIconButton>
            <QueueIconButton label={`Remove ${track.title} from queue`} onClick={() => onRemove?.()}>
              <XMarkIcon className="h-4 w-4" />
            </QueueIconButton>
          </div>
        )}
      </div>
    </div>
  )
}

function QueueIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-elevated hover:text-primary"
    >
      {children}
    </button>
  )
}
