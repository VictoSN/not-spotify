import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Bars3Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  MusicalNoteIcon,
  QueueListIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { TrackCard } from '@/components/cards/TrackCard'
import { useAuthStore } from '@/stores/authStore'
import { usePlayerStore } from '@/stores/playerStore'
import { cn } from '@/utils/cn'

export function QueuePage() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const history = usePlayerStore((s) => s.history)
  const reorderQueue = usePlayerStore((s) => s.reorderQueue)
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue)
  const isPremium = useAuthStore((s) => s.user?.capabilities?.unlimitedPlayback !== false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const upNext = queueIndex >= 0 ? queue.slice(queueIndex + 1) : queue
  const recent = [...history].reverse().slice(0, 12)
  const hasQueueState = Boolean(currentTrack || upNext.length || recent.length)

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
            {currentTrack && (
              <QueueSection title="Now playing">
                <TrackCard track={currentTrack} queue={queue.length ? queue : [currentTrack]} />
              </QueueSection>
            )}

            <QueueSection
              title="Next up"
              aside={upNext.length > 0 && !isPremium ? 'Premium queue editing' : undefined}
            >
              {upNext.length > 0 ? (
                <div role="list" aria-label="Up next tracks" className="grid gap-1">
                  {upNext.map((track, upNextIndex) => {
                    const absoluteIndex = queueIndex + 1 + upNextIndex
                    return (
                      <QueueTrackRow
                        key={`${track.id}-${absoluteIndex}`}
                        track={track}
                        queue={queue}
                        absoluteIndex={absoluteIndex}
                        upNextIndex={upNextIndex}
                        total={upNext.length}
                        canEdit={isPremium}
                        isDragTarget={dragOverIndex === absoluteIndex}
                        onMove={move}
                        onRemove={() => removeFromQueue(absoluteIndex)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', String(absoluteIndex))
                        }}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                          setDragOverIndex(absoluteIndex)
                        }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={(event) => handleDrop(event, absoluteIndex)}
                        onDragEnd={() => setDragOverIndex(null)}
                      />
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-lg bg-surface/60 px-4 py-5 text-sm text-secondary">Nothing queued up next.</p>
              )}
            </QueueSection>

            {recent.length > 0 && (
              <QueueSection title="Recently played">
                <div role="list" aria-label="Recently played tracks" className="grid gap-1">
                  {recent.map((track, index) => (
                    <div key={`${track.id}-${index}`} role="listitem">
                      <TrackCard track={track} queue={[track]} />
                    </div>
                  ))}
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
  title: string
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

function QueueTrackRow({
  track,
  queue,
  absoluteIndex,
  upNextIndex,
  total,
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
  absoluteIndex: number
  upNextIndex: number
  total: number
  canEdit: boolean
  isDragTarget: boolean
  onMove: (fromIndex: number, toIndex: number) => void
  onRemove: () => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}) {
  const canMoveUp = canEdit && upNextIndex > 0
  const canMoveDown = canEdit && upNextIndex < total - 1

  return (
    <div
      role="listitem"
      draggable={canEdit}
      onDragStart={canEdit ? onDragStart : undefined}
      onDragOver={canEdit ? onDragOver : undefined}
      onDragLeave={canEdit ? onDragLeave : undefined}
      onDrop={canEdit ? onDrop : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] items-center gap-2 rounded-lg transition-colors sm:grid-cols-[minmax(0,1fr)_112px]',
        canEdit && 'cursor-grab active:cursor-grabbing',
        isDragTarget && 'bg-elevated/60 ring-1 ring-accent/60',
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {canEdit && <Bars3Icon className="ml-1 hidden h-4 w-4 shrink-0 text-secondary/50 sm:block" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <TrackCard track={track} queue={queue} />
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center justify-end gap-1 px-2 pb-2 sm:px-0 sm:pb-0 sm:pr-2">
          <QueueIconButton
            label={`Move ${track.title} up`}
            title="Move up"
            disabled={!canMoveUp}
            onClick={() => onMove(absoluteIndex, absoluteIndex - 1)}
          >
            <ChevronUpIcon className="h-4 w-4" />
          </QueueIconButton>
          <QueueIconButton
            label={`Move ${track.title} down`}
            title="Move down"
            disabled={!canMoveDown}
            onClick={() => onMove(absoluteIndex, absoluteIndex + 1)}
          >
            <ChevronDownIcon className="h-4 w-4" />
          </QueueIconButton>
          <QueueIconButton label={`Remove ${track.title} from queue`} title="Remove from queue" onClick={onRemove}>
            <XMarkIcon className="h-4 w-4" />
          </QueueIconButton>
        </div>
      )}
    </div>
  )
}

function QueueIconButton({
  label,
  title,
  disabled,
  onClick,
  children,
}: {
  label: string
  title: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-elevated hover:text-primary disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary"
    >
      {children}
    </button>
  )
}
