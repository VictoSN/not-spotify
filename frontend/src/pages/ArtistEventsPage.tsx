import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPinIcon } from '@heroicons/react/24/outline'
import type { Artist, TourDate } from '@/types/artist'
import { artistService } from '@/services/artistService'
import { useAuthStore } from '@/stores/authStore'
import { useDominantColor, withAlpha } from '@/hooks/useDominantColor'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { shareLink } from '@/utils/share'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { ShareIcon } from '@/components/common/ShareIcon'

function regionName(country: string) {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(country.toUpperCase()) ?? country
  } catch {
    return country
  }
}

function sameCountry(eventCountry: string, userCountry: string | null | undefined) {
  if (!userCountry) return false
  const eventValue = eventCountry.trim().toLowerCase()
  const userValue = userCountry.trim().toLowerCase()
  if (eventValue === userValue) return true
  return regionName(eventCountry).toLowerCase() === regionName(userCountry).toLowerCase()
}

function EventRow({ event, artistName, artistId }: { event: TourDate; artistName: string; artistId: string }) {
  const date = new Date(event.eventDate)
  const content = (
    <>
      <div className="w-16 shrink-0 text-center leading-none sm:w-24">
        <span className="block text-xs font-bold text-secondary">
          {date.toLocaleDateString(undefined, { month: 'short' })}
        </span>
        <span className="mt-1 block text-xl font-black text-primary">{date.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-primary">{event.city}</p>
        <p className="mt-1 truncate text-xs text-secondary">{artistName} · {event.venue}</p>
      </div>
      <time className="shrink-0 text-sm text-secondary">
        {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </time>
    </>
  )

  return (
    <Link to={`/artist/${artistId}/events/${event.id}`} className="flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-elevated/60">
      {content}
    </Link>
  )
}

export function ArtistEventsPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((state) => state.user)
  const [artist, setArtist] = useState<Artist | null>(null)
  const [events, setEvents] = useState<TourDate[]>([])
  const [loading, setLoading] = useState(true)
  useDocumentTitle(artist ? `${artist.name} concerts` : null)

  useEffect(() => {
    if (!id) return
    Promise.all([artistService.getById(id), artistService.getTourDates(id)])
      .then(([artistData, eventData]) => {
        setArtist(artistData)
        setEvents(eventData)
      })
      .finally(() => setLoading(false))
  }, [id])

  const colorSource = artist?.headerImageUrl ?? artist?.imageUrl
  const heroColor = useDominantColor(colorSource, { resetOnChange: true }) ?? 'hsl(210 18% 22%)'
  const nearby = useMemo(
    () => events.filter((event) => sameCountry(event.country, user?.country)),
    [events, user?.country],
  )
  const otherEvents = useMemo(
    () => events.filter((event) => !sameCountry(event.country, user?.country)),
    [events, user?.country],
  )
  const locationLabel = user?.country ? regionName(user.country) : 'your location'

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  if (!artist) return <div className="p-8 text-secondary">Artist not found.</div>

  return (
    <div className="min-h-full">
      <header
        className="relative h-80 overflow-hidden sm:h-auto sm:aspect-[3/1]"
        style={{ background: `linear-gradient(120deg, ${heroColor}, ${withAlpha(heroColor, 0.5)})` }}
      >
        {artist.headerImageUrl ? (
          <img src={artist.headerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : artist.imageUrl ? (
          <img src={artist.imageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-7 bottom-8 flex items-end gap-5">
          {!artist.headerImageUrl && <Avatar src={artist.imageUrl} alt={artist.name} size="xl" round className="h-28 w-28 text-3xl shadow-2xl" />}
          <div>
            <p className="mb-4 text-sm font-bold text-white">All events</p>
            <h1 className="text-5xl font-black text-white drop-shadow-xl sm:text-7xl">{artist.name}</h1>
          </div>
        </div>
      </header>

      <main
        className="px-6 pb-12 pt-5 sm:px-9"
        style={{ background: `linear-gradient(180deg, ${withAlpha(heroColor, 0.55)} 0, transparent 22rem)` }}
      >
        <div className="mb-12 flex items-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-secondary/60 px-4 py-2 text-sm font-bold text-primary">
            <MapPinIcon className="h-4 w-4" />
            {locationLabel}
          </span>
          <button
            type="button"
            onClick={() => void shareLink(`/artist/${artist.id}/events`, { title: `${artist.name} concerts` })}
            className="rounded-full p-2 text-secondary transition-colors hover:bg-elevated hover:text-primary"
            aria-label="Share events"
          >
            <ShareIcon className="h-5 w-5" />
          </button>
        </div>

        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-black text-primary">Near {locationLabel}</h2>
          {nearby.length > 0 ? (
            <div className="divide-y divide-primary/10">
              {nearby.map((event) => <EventRow key={event.id} event={event} artistName={artist.name} artistId={artist.id} />)}
            </div>
          ) : (
            <div className="py-2 text-center">
              <p className="text-sm text-secondary">No upcoming events.</p>
              <a href="#all-events" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-bold text-page">
                Browse all events
              </a>
            </div>
          )}
        </section>

        <section id="all-events">
          <h2 className="mb-5 text-2xl font-black text-primary">
            {nearby.length > 0 ? 'Other locations' : 'All upcoming events'}
          </h2>
          {otherEvents.length > 0 ? (
            <div className="divide-y divide-primary/10">
              {otherEvents.map((event) => <EventRow key={event.id} event={event} artistName={artist.name} artistId={artist.id} />)}
            </div>
          ) : (
            <p className="text-sm text-secondary">No other upcoming events.</p>
          )}
        </section>

        <Link to={`/artist/${artist.id}`} className="mt-10 inline-flex text-sm font-bold text-secondary hover:text-primary">
          Back to {artist.name}
        </Link>
      </main>
    </div>
  )
}
