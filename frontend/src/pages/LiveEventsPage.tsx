import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import type { LiveEvent } from '@/types/artist'
import type { Track } from '@/types/track'
import { artistService } from '@/services/artistService'
import { useAuthStore } from '@/stores/authStore'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { cn } from '@/utils/cn'

type DateFilter = 'all' | 'weekend' | 'next-weekend' | 'custom'

interface LocationOption {
  city: string
  country: string
  label: string
  count: number
}

const LOCATION_KEY = 'not-spotify:live-events-location'
const CONCERT_COLLECTION_KEY = 'not-spotify:concerts-near-you-saved'
const VENUE_COLORS = ['#ef8fb1', '#ffa52f', '#22ceb2', '#c69688', '#dfb476', '#28cbb1', '#f46f82']

/* Filter chips — shared pill styling with the hover/press motion the reference uses. */
const CHIP =
  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]'
const CHIP_OUTLINED = cn(CHIP, 'border border-white/40 hover:border-white')
const CHIP_FILLED = cn(CHIP, 'bg-white/10 hover:bg-white/20')
const CHIP_ACTIVE = cn(CHIP, 'bg-white text-black hover:bg-white')

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

/** Friday→Sunday of the current (offset 0) or next (offset 1) weekend, from today. */
function weekendRange(weekOffset: number) {
  const today = startOfDay(new Date())
  const day = today.getDay()
  const daysToFriday = day === 6 ? -1 : day === 0 ? -2 : (5 - day + 7) % 7
  const start = new Date(today)
  start.setDate(today.getDate() + daysToFriday + weekOffset * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 3)
  return { start, end }
}

function eventMatchesDate(event: LiveEvent, filter: DateFilter, customDate: string) {
  if (filter === 'all') return true
  const value = new Date(event.eventDate)
  if (filter === 'custom') return Boolean(customDate) && value.toISOString().slice(0, 10) === customDate
  const range = weekendRange(filter === 'next-weekend' ? 1 : 0)
  return value >= range.start && value < range.end
}

function eventImage(event: LiveEvent) {
  return event.artist.imageUrl ?? event.artist.headerImageUrl
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isoFor(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Leading blanks + day numbers for a month, laid out on a Sunday-first grid. */
function monthCells(year: number, month: number) {
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array.from({ length: startWeekday }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)
  return cells
}

function addMonths(cursor: { year: number; month: number }, delta: number) {
  const next = new Date(cursor.year, cursor.month + delta, 1)
  return { year: next.getFullYear(), month: next.getMonth() }
}

/** One month grid in the date picker. */
function CalendarMonth({
  year,
  month,
  today,
  selectedIso,
  onSelect,
}: {
  year: number
  month: number
  today: Date
  selectedIso: string
  onSelect: (iso: string) => void
}) {
  const cells = monthCells(year, month)
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="w-[280px] shrink-0">
      <div className="mb-3 text-center text-sm font-bold text-white">{monthLabel}</div>
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-[11px] font-semibold text-white/45">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} />
          const iso = isoFor(year, month, day)
          const date = new Date(year, month, day)
          const isPast = date < today
          const isToday = date.getTime() === today.getTime()
          const isSelected = iso === selectedIso
          return (
            <div key={iso} className="flex justify-center">
              <button
                type="button"
                disabled={isPast}
                onClick={() => onSelect(iso)}
                aria-pressed={isSelected}
                aria-label={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  isPast && 'cursor-default text-white/25',
                  !isPast && !isSelected && 'text-white hover:bg-white/10',
                  isToday && !isSelected && 'ring-1 ring-inset ring-white/60',
                  isSelected && 'bg-[#1ed760] font-bold text-black hover:bg-[#1ed760]',
                )}
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Spotify-style two-month date picker modal. Mounted only while open (see the
 * caller) so the visible months re-anchor on the selection each time it opens.
 */
function EventDatePicker({
  onClose,
  customDate,
  dateFilter,
  onSelectDate,
  onSelectWeekend,
  onClear,
}: {
  onClose: () => void
  customDate: string
  dateFilter: DateFilter
  onSelectDate: (iso: string) => void
  onSelectWeekend: (which: 'weekend' | 'next-weekend') => void
  onClear: () => void
}) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [cursor, setCursor] = useState(() => {
    const base = customDate ? new Date(`${customDate}T00:00:00`) : today
    return { year: base.getFullYear(), month: base.getMonth() }
  })

  // Escape closes, matching the location popover's dismiss behaviour.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const secondMonth = addMonths(cursor, 1)
  const canGoPrev = cursor.year > today.getFullYear() || (cursor.year === today.getFullYear() && cursor.month > today.getMonth())

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="What dates are you looking for?"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="animate-pop-in w-full max-w-[640px] rounded-xl bg-[#1c1433] p-6 shadow-2xl">
        <div className="relative mb-5 flex items-center justify-center">
          <h2 className="text-base font-bold text-white">What dates are you looking for?</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close date picker"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => onSelectWeekend('weekend')}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 hover:scale-[1.03]',
              dateFilter === 'weekend' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20',
            )}
          >
            This weekend
          </button>
          <button
            type="button"
            onClick={() => onSelectWeekend('next-weekend')}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 hover:scale-[1.03]',
              dateFilter === 'next-weekend' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20',
            )}
          >
            Next weekend
          </button>
        </div>

        <div className="mb-5 border-t border-white/10" />

        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8">
          <button
            type="button"
            onClick={() => canGoPrev && setCursor((c) => addMonths(c, -1))}
            disabled={!canGoPrev}
            className={cn(
              'absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10',
              !canGoPrev && 'cursor-default text-white/25 hover:bg-transparent',
            )}
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <CalendarMonth year={cursor.year} month={cursor.month} today={today} selectedIso={customDate} onSelect={onSelectDate} />
          <CalendarMonth year={secondMonth.year} month={secondMonth.month} today={today} selectedIso={customDate} onSelect={onSelectDate} />
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-6">
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-bold text-white/80 transition-colors hover:text-white"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#1ed760] px-8 py-2.5 text-sm font-bold text-black transition-all duration-200 hover:scale-105 hover:bg-[#3be477] active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function EventCard({ event, groupSize, groupEnd }: { event: LiveEvent; groupSize?: number; groupEnd?: string }) {
  const date = new Date(event.eventDate)
  const image = eventImage(event)
  const grouped = (groupSize ?? 1) > 1 && groupEnd
  return (
    <Link to={`/artist/${event.artist.id}/events/${event.id}`} className="group w-40 shrink-0 sm:w-44">
      <div className="relative aspect-square overflow-hidden rounded-md bg-elevated shadow-lg transition-shadow duration-300 group-hover:shadow-2xl">
        {image ? (
          <img src={image} alt={event.artist.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-900 text-5xl font-black text-white">
            {event.artist.name.slice(0, 1)}
          </div>
        )}
        <div className="absolute left-2 top-2 min-w-12 rounded bg-black/75 px-2 py-1.5 text-center text-white backdrop-blur-sm">
          <span className="block text-[11px] font-bold leading-none">{date.toLocaleDateString(undefined, { month: 'short' })}</span>
          <span className="mt-1 block text-lg font-black leading-none">{date.getDate()}</span>
        </div>
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
      </div>
      <p className="mt-2 truncate text-sm font-bold text-primary">{event.artist.name}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-4 text-secondary">
        {grouped ? `${shortDate(event.eventDate)}–${shortDate(groupEnd)} • ${groupSize} events` : `${event.venue}, ${event.city}`}
      </p>
    </Link>
  )
}

function EventSection({ eyebrow, title, events }: { eyebrow?: string; title: string; events: LiveEvent[] }) {
  if (events.length === 0) return null
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="mb-1 text-xs text-secondary">{eyebrow}</p>}
          <h2 className="text-2xl font-black text-primary">{title}</h2>
        </div>
        <a href="#all-events" className="text-xs font-bold text-secondary transition-colors hover:text-primary hover:underline">Show all</a>
      </div>
      <HorizontalScroller bleedRight>
        {events.map((event) => <EventCard key={event.id} event={event} />)}
      </HorizontalScroller>
    </section>
  )
}

function VenueSection({ events }: { events: LiveEvent[] }) {
  const venues = useMemo(() => {
    const grouped = new Map<string, LiveEvent[]>()
    for (const event of events) {
      const key = `${event.venue}|${event.city}`
      grouped.set(key, [...(grouped.get(key) ?? []), event])
    }
    return [...grouped.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
  }, [events])
  if (venues.length === 0) return null

  return (
    <section className="mb-14">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-black text-primary">Venues we think you’ll like</h2>
          <span className="rounded bg-elevated px-2 py-1 text-[10px] font-bold text-primary">Beta</span>
        </div>
        <a href="#all-events" className="text-xs font-bold text-secondary transition-colors hover:text-primary hover:underline">Show all</a>
      </div>
      <HorizontalScroller bleedRight>
        {venues.map(([key, venueEvents], index) => {
          const first = venueEvents[0]
          const artists = [...new Map(venueEvents.map((event) => [event.artist.id, event.artist])).values()]
          return (
            <Link key={key} to={`/artist/${first.artist.id}/events/${first.id}`} className="group w-44 shrink-0">
              <div className="relative aspect-square overflow-hidden rounded-md p-3 text-black transition-transform duration-200 group-hover:scale-[1.02]" style={{ backgroundColor: VENUE_COLORS[index % VENUE_COLORS.length] }}>
                <span className="absolute right-3 top-2 text-[9px] font-black tracking-[0.18em]">VENUE</span>
                <div className="mt-4 flex h-24 items-center justify-center -space-x-5">
                  {artists.slice(0, 3).map((artist) => artist.imageUrl ? (
                    <img key={artist.id} src={artist.imageUrl} alt="" className="h-20 w-20 rounded-full border-2 border-black/15 object-cover" />
                  ) : (
                    <div key={artist.id} className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-black/15 bg-black/15 text-2xl font-black">
                      {artist.name.slice(0, 1)}
                    </div>
                  ))}
                </div>
                <p className="absolute inset-x-3 bottom-3 line-clamp-2 text-base font-black leading-tight">{first.venue}</p>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-4 text-secondary">
                {artists.slice(0, 3).map((artist) => artist.name).join(', ')}{artists.length > 3 ? ' and more' : ''}
              </p>
            </Link>
          )
        })}
      </HorizontalScroller>
    </section>
  )
}

function ConcertsNearYou({ events }: { events: LiveEvent[] }) {
  const play = usePlaybackGate()
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const pause = usePlayerStore((state) => state.pause)
  const resume = usePlayerStore((state) => state.resume)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(() => localStorage.getItem(CONCERT_COLLECTION_KEY) === 'true')
  const active = tracks.some((track) => track.id === currentTrack?.id)

  const handlePlay = async () => {
    if (active) {
      if (isPlaying) pause()
      else resume()
      return
    }
    setLoading(true)
    try {
      const artistIds = [...new Set(events.map((event) => event.artist.id))].slice(0, 6)
      const lists = await Promise.all(artistIds.map((id) => artistService.getTopTracks(id, 4).catch(() => [])))
      const unique = [...new Map(lists.flat().map((track) => [track.id, track])).values()]
      setTracks(unique)
      if (unique.length > 0) play(unique[0], unique)
    } finally {
      setLoading(false)
    }
  }

  const toggleSaved = () => {
    const next = !saved
    setSaved(next)
    localStorage.setItem(CONCERT_COLLECTION_KEY, String(next))
  }

  return (
    <section className="mb-14">
      <p className="mb-1 text-xs text-secondary">Updates every Wednesday, personalized for you.</p>
      <h2 className="mb-5 text-2xl font-black text-primary">Stream it now, enjoy it live</h2>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative h-52 w-52 shrink-0 overflow-hidden rounded-md bg-[#4f36c8] shadow-xl">
          <div className="absolute -left-14 top-8 h-28 w-72 rotate-[-18deg] bg-cyan-300/75 blur-xl" />
          <div className="absolute -right-14 top-24 h-24 w-72 rotate-[20deg] bg-fuchsia-400/65 blur-xl" />
          <div className="absolute inset-x-5 bottom-5 text-2xl font-black leading-none text-white">Concerts<br />Near You</div>
        </div>
        <div>
          <p className="text-sm text-secondary">Playlist</p>
          <h3 className="mt-1 text-2xl font-black text-primary">Concerts Near You</h3>
          <p className="mt-2 text-sm text-secondary">Find artists touring near you, for you.</p>
          <p className="mt-1 text-sm text-secondary">Updates whenever the event feed refreshes.</p>
          <div className="mt-4 flex items-center gap-4">
            <button type="button" onClick={() => void handlePlay()} disabled={loading || events.length === 0} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-page transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50" aria-label={active && isPlaying ? 'Pause Concerts Near You' : 'Play Concerts Near You'}>
              {active && isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
            </button>
            <button type="button" onClick={toggleSaved} className="flex h-9 w-9 items-center justify-center rounded-full border border-secondary text-secondary transition-all duration-200 hover:scale-110 hover:border-primary hover:text-primary active:scale-95" aria-label={saved ? 'Remove Concerts Near You from library' : 'Save Concerts Near You'}>
              {saved ? <CheckIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LiveEventsPage() {
  useDocumentTitle('Live Events')
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [locationLabel, setLocationLabel] = useState(() => localStorage.getItem(LOCATION_KEY) ?? '')
  const [locationOpen, setLocationOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customDate, setCustomDate] = useState('')
  const [genre, setGenre] = useState('all')
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const locationMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const following = isAuthenticated ? artistService.getFollowing().catch(() => []) : Promise.resolve([])
    Promise.all([artistService.getLiveEvents('all', 200).catch(() => []), following])
      .then(([nextEvents, followed]) => {
        setEvents(nextEvents)
        setFollowedIds(new Set(followed.map((artist) => artist.id)))
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  // Close the location popover on any outside click.
  useEffect(() => {
    if (!locationOpen) return
    const close = (event: MouseEvent) => {
      if (!locationMenuRef.current?.contains(event.target as Node)) setLocationOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [locationOpen])

  // Locations come from the feed itself — every city that actually has events.
  const locations = useMemo<LocationOption[]>(() => {
    const grouped = new Map<string, LocationOption>()
    for (const event of events) {
      const city = event.city.trim()
      if (!city) continue
      const label = `${city}, ${event.country}`
      const existing = grouped.get(label)
      if (existing) existing.count += 1
      else grouped.set(label, { city, country: event.country, label, count: 1 })
    }
    return [...grouped.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [events])

  const selectedLocation = useMemo(
    () => locations.find((item) => item.label === locationLabel) ?? null,
    [locations, locationLabel],
  )

  const genres = useMemo(() => [...new Set(events.flatMap((event) => event.artist.genres))].sort(), [events])

  const filteredEvents = useMemo(() => events.filter((event) => {
    if (selectedLocation && (event.city.trim() !== selectedLocation.city || event.country !== selectedLocation.country)) return false
    if (genre !== 'all' && !event.artist.genres.includes(genre)) return false
    return eventMatchesDate(event, dateFilter, customDate)
  }), [customDate, dateFilter, events, genre, selectedLocation])

  // One card per artist per rail — a six-date tour shouldn't fill the row.
  const uniqueByArtist = (list: LiveEvent[], limit: number) => {
    const seen = new Set<string>()
    const result: LiveEvent[] = []
    for (const item of list) {
      if (seen.has(item.artist.id)) continue
      seen.add(item.artist.id)
      result.push(item)
      if (result.length === limit) break
    }
    return result
  }

  const justForYou = useMemo(() => uniqueByArtist([...filteredEvents]
    .sort((a, b) => Number(followedIds.has(b.artist.id)) - Number(followedIds.has(a.artist.id)) || b.artist.monthlyListeners - a.artist.monthlyListeners), 10), [filteredEvents, followedIds])
  const popular = useMemo(() => uniqueByArtist([...filteredEvents]
    .sort((a, b) => b.artist.monthlyListeners - a.artist.monthlyListeners), 12), [filteredEvents])
  const highlightedWeekend = useMemo(() => {
    if (dateFilter === 'custom') return []
    const preset: DateFilter = dateFilter === 'next-weekend' ? 'next-weekend' : 'weekend'
    return uniqueByArtist(events.filter((event) => {
      if (selectedLocation && (event.city.trim() !== selectedLocation.city || event.country !== selectedLocation.country)) return false
      if (genre !== 'all' && !event.artist.genres.includes(genre)) return false
      return eventMatchesDate(event, preset, '')
    }), 10)
  }, [dateFilter, events, genre, selectedLocation])

  // "All events" groups an artist's run of shows into one card ("Jul 5–12 • 5 events").
  const allEventGroups = useMemo(() => {
    const grouped = new Map<string, LiveEvent[]>()
    for (const event of filteredEvents) {
      grouped.set(event.artist.id, [...(grouped.get(event.artist.id) ?? []), event])
    }
    return [...grouped.values()].sort((a, b) => new Date(a[0].eventDate).getTime() - new Date(b[0].eventDate).getTime())
  }, [filteredEvents])

  const updateLocation = (value: string) => {
    setLocationLabel(value)
    if (value) localStorage.setItem(LOCATION_KEY, value)
    else localStorage.removeItem(LOCATION_KEY)
    setLocationOpen(false)
  }

  const clearFilters = () => {
    setDateFilter('all')
    setCustomDate('')
    setGenre('all')
  }
  const hasFilters = dateFilter !== 'all' || genre !== 'all' || Boolean(selectedLocation)

  if (loading) {
    return (
      <div className="min-h-full bg-page">
        <div className="h-80 animate-pulse bg-violet-900/60" />
        <div className="space-y-10 px-6 py-8">
          {[0, 1].map((row) => <div key={row} className="h-52 animate-pulse rounded-lg bg-elevated" />)}
        </div>
      </div>
    )
  }

  const locationChooser = (
    <div ref={locationMenuRef} className="relative">
      <button
        type="button"
        onClick={() => setLocationOpen((open) => !open)}
        className={CHIP_OUTLINED}
        aria-expanded={locationOpen}
        aria-haspopup="listbox"
        aria-label="Filter by location"
      >
        <MapPinIcon className="h-4 w-4" />
        {selectedLocation?.label ?? 'Choose location'}
        <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform duration-200', locationOpen && 'rotate-180')} />
      </button>
      {locationOpen && (
        <div className="animate-pop-in absolute left-0 top-full z-40 mt-2 max-h-80 w-64 overflow-y-auto rounded-lg bg-elevated p-1 shadow-2xl" role="listbox" aria-label="Locations">
          <button
            type="button"
            role="option"
            aria-selected={!selectedLocation}
            onClick={() => updateLocation('')}
            className={cn('flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-white/10', !selectedLocation && 'font-bold')}
          >
            All locations
            {!selectedLocation && <CheckIcon className="h-4 w-4 text-accent" />}
          </button>
          {locations.map((item) => (
            <button
              key={item.label}
              type="button"
              role="option"
              aria-selected={item.label === locationLabel}
              onClick={() => updateLocation(item.label)}
              className={cn('flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-white/10', item.label === locationLabel && 'font-bold')}
            >
              <span className="truncate">{item.label}</span>
              <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-secondary">
                {item.count}
                {item.label === locationLabel && <CheckIcon className="h-4 w-4 text-accent" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-full bg-page pb-16">
      <header className="relative flex h-80 items-end overflow-hidden bg-[linear-gradient(145deg,#7659ff_0%,#5941ca_46%,#352875_100%)] px-6 pb-10 sm:px-9">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_8%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(to_top,rgba(10,8,28,0.18),transparent_65%)]" />
        <h1 className="relative text-6xl font-black tracking-[-0.055em] text-white sm:text-8xl">Live Events</h1>
      </header>

      <div className="sticky top-0 z-30 border-b border-white/5 bg-[#211a46]/95 px-6 py-4 backdrop-blur-xl sm:px-9">
        <div className="flex flex-wrap items-center gap-2">
          {locationChooser}
          <button type="button" onClick={() => setDatePickerOpen(true)} className={customDate ? CHIP_ACTIVE : CHIP_OUTLINED} aria-label="Select event date">
            <CalendarDaysIcon className="h-4 w-4" />
            {customDate ? new Date(`${customDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Select dates'}
            {customDate && (
              <XMarkIcon
                className="h-3.5 w-3.5"
                onClick={(event) => { event.stopPropagation(); setCustomDate(''); setDateFilter('all') }}
                aria-label="Clear selected date"
              />
            )}
          </button>
          <button type="button" onClick={() => setDateFilter(dateFilter === 'weekend' ? 'all' : 'weekend')} className={dateFilter === 'weekend' ? CHIP_ACTIVE : CHIP_FILLED}>This weekend</button>
          <button type="button" onClick={() => setDateFilter(dateFilter === 'next-weekend' ? 'all' : 'next-weekend')} className={dateFilter === 'next-weekend' ? CHIP_ACTIVE : CHIP_FILLED}>Next weekend</button>
          <label className={cn(CHIP_OUTLINED, 'cursor-pointer', genre !== 'all' && 'border-white bg-white/10')}>
            <select value={genre} onChange={(event) => setGenre(event.target.value)} className="appearance-none bg-transparent pr-4 outline-none" aria-label="Filter events by genre">
              <option value="all" className="bg-elevated text-primary">All genres</option>
              {genres.map((item) => <option key={item} value={item} className="bg-elevated capitalize text-primary">{item}</option>)}
            </select>
          </label>
          {hasFilters && (
            <button type="button" onClick={() => { clearFilters(); updateLocation('') }} className="px-2 text-xs font-bold text-white/70 transition-colors hover:text-white">Clear filters</button>
          )}
        </div>
      </div>

      {/* Location prompt — shown until the visitor picks a city, like the reference. */}
      {!selectedLocation && events.length > 0 && (
        <div className="bg-[linear-gradient(180deg,#1c1540_0%,rgba(18,14,40,0)_100%)] px-6 pb-4 pt-10 text-center sm:px-9">
          <h2 className="text-2xl font-black text-white">Set your location</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70">Setting a location lets us show you the best concerts around you.</p>
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className="mt-5 rounded-full bg-[#1ed760] px-8 py-3 text-sm font-bold text-black transition-all duration-200 hover:scale-105 hover:bg-[#3be477] active:scale-95"
          >
            Choose location
          </button>
        </div>
      )}

      <main className="px-6 pt-9 sm:px-9" data-testid="live-events-content">
        {events.length === 0 ? (
          <div className="mb-14 rounded-xl border border-primary/10 bg-surface px-6 py-14 text-center">
            <MapPinIcon className="mx-auto h-9 w-9 text-secondary" />
            <h2 className="mt-4 text-2xl font-black text-primary">No upcoming events yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-secondary">Tour dates come from artists and the live Ticketmaster sync. Check back soon, or sync tour dates from the admin artist tools.</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="mb-14 rounded-xl border border-primary/10 bg-surface px-6 py-14 text-center">
            <MapPinIcon className="mx-auto h-9 w-9 text-secondary" />
            <h2 className="mt-4 text-2xl font-black text-primary">Nothing {selectedLocation ? `in ${selectedLocation.label}` : 'here'} yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-secondary">Try another location, clear the date filter, or browse every event we know about.</p>
            <button type="button" onClick={() => { clearFilters(); updateLocation('') }} className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-page transition-all duration-200 hover:scale-105 active:scale-95">Show all events</button>
          </div>
        ) : (
          <>
            <EventSection eyebrow="Concerts we think you’ll like" title="Just for you" events={justForYou} />
            <EventSection eyebrow="Updates every Thursday" title={dateFilter === 'next-weekend' ? 'Next weekend' : 'On this weekend'} events={highlightedWeekend} />
            <EventSection eyebrow="What’s trending right now" title={selectedLocation ? `Popular in ${selectedLocation.city}` : 'Popular right now'} events={popular} />
            <VenueSection events={filteredEvents} />
            <ConcertsNearYou events={filteredEvents} />
            <section id="all-events">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl font-black text-primary">All events</h2>
                <span className="text-xs text-secondary">{filteredEvents.length} upcoming</span>
              </div>
              <HorizontalScroller bleedRight>
                {allEventGroups.map((group) => (
                  <EventCard
                    key={group[0].id}
                    event={group[0]}
                    groupSize={group.length}
                    groupEnd={group[group.length - 1].eventDate}
                  />
                ))}
              </HorizontalScroller>
            </section>
          </>
        )}
      </main>

      {datePickerOpen && (
        <EventDatePicker
          onClose={() => setDatePickerOpen(false)}
          customDate={customDate}
          dateFilter={dateFilter}
          onSelectDate={(iso) => { setCustomDate(iso); setDateFilter('custom') }}
          onSelectWeekend={(which) => { setCustomDate(''); setDateFilter(dateFilter === which ? 'all' : which) }}
          onClear={() => { setCustomDate(''); setDateFilter('all') }}
        />
      )}
    </div>
  )
}
