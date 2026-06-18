import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MoodTag } from '@/types/mood'
import type { Track } from '@/types/track'
import { moodService } from '@/services/moodService'
import { searchService } from '@/services/searchService'
import { TrackTile } from '@/components/cards/TrackTile'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { moodIcon } from '@/utils/moodIcons'

type MoodRows = Record<string, Track[]>

// Resolve a mood's tracks from the taxonomy, falling back to a catalogue search
// when nothing is tagged yet so the row is never empty for the seeded moods.
async function resolveMoodTracks(mood: MoodTag): Promise<Track[]> {
  const tagged = await moodService.getTracksByMood(mood.slug)
  if (tagged.length > 0) return tagged.slice(0, 10)
  if (mood.searchQuery) {
    try {
      const res = await searchService.search(mood.searchQuery)
      return res.tracks.slice(0, 10)
    } catch {
      return []
    }
  }
  return []
}

export function MoodActivityPage() {
  useDocumentTitle('Moods and activities')
  const [moods, setMoods] = useState<MoodTag[]>([])
  const [rows, setRows] = useState<MoodRows>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const tags = await moodService.getAll()
        if (cancelled) return
        setMoods(tags)

        const results = await Promise.all(
          tags.map(async (mood) => [mood.slug, await resolveMoodTracks(mood)] as const),
        )
        if (!cancelled) {
          setRows(Object.fromEntries(results))
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()

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

  const activities = moods.filter((m) => m.kind === 'activity')
  const feelings = moods.filter((m) => m.kind !== 'activity')

  const renderCards = (list: MoodTag[]) => (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((mood) => {
        const Icon = moodIcon(mood.icon)
        return (
          <Link
            key={mood.slug}
            to={`/moods/${mood.slug}`}
            className="group relative min-h-32 overflow-hidden rounded-md p-4 outline-none transition-transform hover:scale-[1.018] focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ backgroundColor: mood.color }}
          >
            <div className="relative z-10 flex h-full flex-col justify-between">
              <Icon className="h-7 w-7 text-white/85" />
              <span className="block text-2xl font-black text-white">{mood.name}</span>
            </div>
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 transition-transform group-hover:scale-125" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25" />
          </Link>
        )
      })}
    </section>
  )

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-primary">Moods and activities</h1>
        <p className="mt-1 max-w-2xl text-sm text-secondary">
          Browse listening contexts from the catalogue — admin-curated tags, with a search fallback when a tag is still empty.
        </p>
      </div>

      {activities.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-xl font-black text-primary">Activities</h2>
          {renderCards(activities)}
        </div>
      )}

      {feelings.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-xl font-black text-primary">Moods</h2>
          {renderCards(feelings)}
        </div>
      )}

      <div className="space-y-8">
        {moods.map((mood) => {
          const tracks = rows[mood.slug] ?? []
          if (tracks.length === 0) return null

          return (
            <section key={mood.slug}>
              <div className="mb-3 flex items-end justify-between gap-4">
                <h2 className="text-xl font-black text-primary">{mood.name}</h2>
                <Link
                  to={`/moods/${mood.slug}`}
                  className="hidden shrink-0 rounded-full border border-secondary/20 px-3 py-1.5 text-xs font-bold text-secondary transition-colors hover:border-primary/30 hover:text-primary sm:inline-flex"
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
