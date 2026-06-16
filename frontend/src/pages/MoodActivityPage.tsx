import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BoltIcon,
  BriefcaseIcon,
  CloudIcon,
  FireIcon,
  HeartIcon,
  HomeIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
} from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { searchService } from '@/services/searchService'
import { TrackTile } from '@/components/cards/TrackTile'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/utils/cn'

const moods = [
  {
    slug: 'focus',
    name: 'Focus',
    copy: 'Steady tracks for deep work.',
    query: 'focus instrumental',
    color: '#2563eb',
    icon: BriefcaseIcon,
  },
  {
    slug: 'workout',
    name: 'Workout',
    copy: 'High-energy music for movement.',
    query: 'workout energy',
    color: '#dc2626',
    icon: BoltIcon,
  },
  {
    slug: 'chill',
    name: 'Chill',
    copy: 'Low-pressure listening for winding down.',
    query: 'chill',
    color: '#0891b2',
    icon: CloudIcon,
  },
  {
    slug: 'party',
    name: 'Party',
    copy: 'Upfront songs for a louder room.',
    query: 'party dance',
    color: '#9333ea',
    icon: SparklesIcon,
  },
  {
    slug: 'sleep',
    name: 'Sleep',
    copy: 'Softer picks for late-night listening.',
    query: 'sleep ambient',
    color: '#334155',
    icon: MoonIcon,
  },
  {
    slug: 'love',
    name: 'Love',
    copy: 'Warm songs and slower moments.',
    query: 'love',
    color: '#db2777',
    icon: HeartIcon,
  },
  {
    slug: 'morning',
    name: 'Morning',
    copy: 'Bright starts without a hard launch.',
    query: 'morning',
    color: '#ca8a04',
    icon: SunIcon,
  },
  {
    slug: 'at-home',
    name: 'At Home',
    copy: 'Comfortable music for staying in.',
    query: 'home acoustic',
    color: '#16a34a',
    icon: HomeIcon,
  },
  {
    slug: 'hype',
    name: 'Hype',
    copy: 'Fast, bold tracks for momentum.',
    query: 'hype hip hop rock',
    color: '#ea580c',
    icon: FireIcon,
  },
] as const

type MoodSlug = (typeof moods)[number]['slug']
type MoodRows = Partial<Record<MoodSlug, Track[]>>

export function MoodActivityPage() {
  useDocumentTitle('Moods and activities')
  const [rows, setRows] = useState<MoodRows>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(async () => {
      try {
        const results = await Promise.all(
          moods.map(async (mood) => {
            const res = await searchService.search(mood.query)
            return [mood.slug, res.tracks.slice(0, 10)] as const
          }),
        )
        if (!cancelled) {
          setRows(Object.fromEntries(results) as MoodRows)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-primary">Moods and activities</h1>
        <p className="mt-1 max-w-2xl text-sm text-secondary">
          Browse listening contexts built from the existing catalog: no new tagging table required.
        </p>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {moods.map(({ slug, name, copy, query, color, icon: Icon }) => (
          <Link
            key={slug}
            to={`/search?q=${encodeURIComponent(query)}`}
            className="group relative min-h-36 overflow-hidden rounded-md p-4 outline-none transition-transform hover:scale-[1.018] focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ backgroundColor: color }}
          >
            <div className="relative z-10 flex h-full flex-col justify-between">
              <Icon className="h-7 w-7 text-white/85" />
              <span>
                <span className="block text-2xl font-black text-white">{name}</span>
                <span className="mt-1 block max-w-[15rem] text-sm font-medium text-white/75">{copy}</span>
              </span>
            </div>
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 transition-transform group-hover:scale-125" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25" />
          </Link>
        ))}
      </section>

      <div className="space-y-8">
        {moods.map((mood) => {
          const tracks = rows[mood.slug] ?? []
          if (tracks.length === 0) return null

          return (
            <section key={mood.slug}>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-primary">{mood.name}</h2>
                  <p className="text-sm text-secondary">{mood.copy}</p>
                </div>
                <Link
                  to={`/search?q=${encodeURIComponent(mood.query)}`}
                  className={cn(
                    'hidden shrink-0 rounded-full border border-secondary/20 px-3 py-1.5 text-xs font-bold text-secondary transition-colors hover:border-primary/30 hover:text-primary sm:inline-flex',
                  )}
                >
                  See more
                </Link>
              </div>
              <HorizontalScroller>
                {tracks.map((track) => (
                  <TrackTile key={track.id} track={track} queue={tracks} />
                ))}
              </HorizontalScroller>
            </section>
          )
        })}
      </div>
    </div>
  )
}
