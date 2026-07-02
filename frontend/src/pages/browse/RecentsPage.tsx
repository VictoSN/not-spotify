import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDownIcon, MusicalNoteIcon } from '@heroicons/react/24/outline'
import { HeartIcon } from '@heroicons/react/24/solid'
import { meService, type PlayHistoryContext, type PlayHistoryItem } from '@/services/meService'
import { useAuthStore } from '@/stores/authStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { COLLECTION_PAGE_CLASS } from '@/components/common/CollectionPage'
import { cn } from '@/utils/cn'

/** All plays of one context (playlist/album/…) within one calendar day. */
interface RecentGroup {
  key: string
  context: PlayHistoryContext | null
  /** Newest first, same order the API returns. */
  plays: PlayHistoryItem[]
}

interface DaySection {
  key: string
  label: string
  groups: RecentGroup[]
}

function dayLabelOf(date: Date, now: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Buckets the flat play history into day sections, and within each day merges
 * plays of the same context into a single row ("27 songs played • Playlist").
 * Context-less plays (track cards, search, queue…) share one anonymous bucket
 * per day. Input is newest-first, so sections and rows inherit recency order.
 */
function groupHistory(history: PlayHistoryItem[]): DaySection[] {
  const now = new Date()
  const sections: DaySection[] = []
  const sectionByKey = new Map<string, DaySection>()
  const groupByKey = new Map<string, RecentGroup>()

  for (const item of history) {
    const playedAt = new Date(item.playedAt)
    if (Number.isNaN(playedAt.getTime())) continue
    const dayKey = `${playedAt.getFullYear()}-${playedAt.getMonth()}-${playedAt.getDate()}`
    let section = sectionByKey.get(dayKey)
    if (!section) {
      section = { key: dayKey, label: dayLabelOf(playedAt, now), groups: [] }
      sectionByKey.set(dayKey, section)
      sections.push(section)
    }
    const contextKey = item.context ? `${item.context.type}:${item.context.id}` : 'standalone'
    const groupKey = `${dayKey}|${contextKey}`
    let group = groupByKey.get(groupKey)
    if (!group) {
      group = { key: groupKey, context: item.context, plays: [] }
      groupByKey.set(groupKey, group)
      section.groups.push(group)
    }
    group.plays.push(item)
  }
  return sections
}

function songsPlayedLabel(count: number): string {
  return count === 1 ? '1 song played' : `${count} songs played`
}

/** Spotify leads playlists with the play count and albums with "Album • Artist". */
function subtitleFor(context: PlayHistoryContext, count: number): string {
  const played = songsPlayedLabel(count)
  switch (context.type) {
    case 'playlist':
      return context.ownerName ? `${played} • Playlist • ${context.ownerName}` : `${played} • Playlist`
    case 'liked':
      return `${played} • Playlist`
    case 'album':
      return context.ownerName ? `Album • ${context.ownerName} • ${played}` : `Album • ${played}`
    case 'artist':
      return `Artist • ${played}`
    case 'mix':
      return `Mix • ${played}`
  }
}

function hrefFor(context: PlayHistoryContext): string {
  switch (context.type) {
    case 'playlist':
      return `/playlist/${context.id}`
    case 'album':
      return `/album/${context.id}`
    case 'artist':
      return `/artist/${context.id}`
    case 'mix':
      return `/mix/${context.id}`
    case 'liked':
      return '/library?tab=liked'
  }
}

function formatPlayedTime(playedAt: string): string {
  const date = new Date(playedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function ExplicitBadge() {
  return (
    <span
      aria-label="Explicit"
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] bg-secondary text-[10px] font-bold leading-none text-page"
    >
      E
    </span>
  )
}

/** 56px artwork: gradient heart for Liked Songs, round for artists, else cover art. */
function GroupArt({ group }: { group: RecentGroup }) {
  if (group.context?.type === 'liked') {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-purple-600 to-indigo-300">
        <HeartIcon className="h-6 w-6 text-white" />
      </div>
    )
  }
  // `||` (not `??`) so empty-string cover urls fall through too.
  const cover = group.context?.imageUrl || group.plays[0]?.track.album.coverUrl || null
  const rounding = group.context?.type === 'artist' ? 'rounded-full' : 'rounded-sm'
  if (!cover) {
    return (
      <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center bg-elevated text-secondary', rounding)}>
        <MusicalNoteIcon className="h-6 w-6" />
      </div>
    )
  }
  return (
    <img
      src={cover}
      alt={group.context?.name ?? group.plays[0]?.track.title ?? ''}
      loading="lazy"
      className={cn('h-14 w-14 shrink-0 object-cover', rounding)}
    />
  )
}

function RecentGroupRow({ group }: { group: RecentGroup }) {
  const [expanded, setExpanded] = useState(false)
  const play = usePlayerStore((s) => s.play)

  const count = group.plays.length
  const title = group.context?.name ?? songsPlayedLabel(count)
  const subtitle = group.context ? subtitleFor(group.context, count) : null
  const href = group.context ? hrefFor(group.context) : null

  // Queue for plays started from an expanded row: this session's distinct tracks.
  const sessionTracks = useMemo(() => {
    const byId = new Map(group.plays.map((p) => [p.track.id, p.track]))
    return [...byId.values()]
  }, [group.plays])

  const heading = (
    <>
      <GroupArt group={group} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-primary">{title}</p>
        {subtitle && (
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-secondary">
            {group.context?.type === 'album' && group.context.isExplicit && <ExplicitBadge />}
            <span className="truncate">{subtitle}</span>
          </p>
        )}
      </div>
    </>
  )

  return (
    <div className="-mx-2">
      <div className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-elevated/60">
        {href ? (
          <Link to={href} className="flex min-w-0 flex-1 items-center gap-3">
            {heading}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{heading}</div>
        )}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `Hide songs played from ${title}` : `Show songs played from ${title}`}
          onClick={() => setExpanded((v) => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary hover:text-primary"
        >
          <ChevronDownIcon className={cn('h-5 w-5 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>
      {expanded && (
        <ul className="mb-2 ml-[4.25rem] mr-2">
          {group.plays.map((item, index) => (
            <li key={`${item.track.id}-${item.playedAt}-${index}`}>
              <button
                type="button"
                onClick={() => play(item.track, sessionTracks)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-elevated/60"
              >
                {item.track.album.coverUrl ? (
                  <img
                    src={item.track.album.coverUrl}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-elevated text-secondary">
                    <MusicalNoteIcon className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-primary">{item.track.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-secondary">
                    {item.track.explicit && <ExplicitBadge />}
                    <span className="truncate">{item.track.artist.name}</span>
                  </span>
                </span>
                <span className="shrink-0 text-xs text-secondary">{formatPlayedTime(item.playedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RecentsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading recently played"
      className={cn(COLLECTION_PAGE_CLASS, 'min-h-[calc(100vh-6rem)] animate-pulse motion-reduce:animate-none')}
    >
      <div className="mt-2 h-7 w-28 rounded bg-elevated" />
      <div className="mt-6 space-y-4" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-sm bg-elevated" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-2/5 rounded bg-primary/15" />
              <div className="mt-2 h-2.5 w-1/4 rounded bg-primary/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RecentsPage() {
  useDocumentTitle('Recently played')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // null = not fetched yet (drives the skeleton); [] = fetched but empty.
  const [history, setHistory] = useState<PlayHistoryItem[] | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    meService.getHistory(300)
      .then((rows) => { if (!cancelled) setHistory(rows) })
      .catch(() => { if (!cancelled) setHistory([]) })
    return () => { cancelled = true }
  }, [isAuthenticated])

  const sections = useMemo(() => groupHistory(history ?? []), [history])

  if (isAuthenticated && history === null) return <RecentsSkeleton />

  return (
    <div className={COLLECTION_PAGE_CLASS}>
      <h1 className="sr-only">Recently played</h1>
      {!isAuthenticated ? (
        <p className="text-secondary">
          <Link to="/login" className="text-primary underline">Log in</Link> to see what you&apos;ve been listening to.
        </p>
      ) : sections.length === 0 ? (
        <p className="text-secondary">No recent plays yet. Hit play on something!</p>
      ) : (
        <div data-testid="recently-played-sections">
          {sections.map((section) => (
            <section key={section.key} aria-label={section.label} className="mb-8">
              <h2 className="mb-4 mt-2 text-2xl font-bold text-primary">{section.label}</h2>
              <div className="flex flex-col">
                {section.groups.map((group) => (
                  <RecentGroupRow key={group.key} group={group} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
