import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import type { Album } from '@/types/album'
import type { Artist, TourDate } from '@/types/artist'
import { artistService } from '@/services/artistService'
import { useDominantColor, withAlpha } from '@/hooks/useDominantColor'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { shareLink } from '@/utils/share'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'

const savedEventKey = 'not-spotify:saved-events'

function getSavedEvents() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(savedEventKey) ?? '[]') as string[])
  } catch {
    return new Set<string>()
  }
}

function regionName(country: string) {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(country.toUpperCase()) ?? country
  } catch {
    return country
  }
}

export function ArtistEventDetailPage() {
  const { id, eventId } = useParams<{ id: string; eventId: string }>()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [event, setEvent] = useState<TourDate | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(() => eventId ? getSavedEvents().has(eventId) : false)
  useDocumentTitle(artist && event ? `${artist.name} at ${event.venue}` : null)

  useEffect(() => {
    if (!id || !eventId) return
    Promise.all([
      artistService.getById(id),
      artistService.getTourDates(id),
      artistService.getAlbums(id),
    ]).then(([artistData, events, albumData]) => {
      setArtist(artistData)
      setEvent(events.find((item) => item.id === eventId) ?? null)
      setAlbums(albumData)
    }).finally(() => setLoading(false))
  }, [eventId, id])

  const colorSource = artist?.headerImageUrl ?? artist?.imageUrl
  const heroColor = useDominantColor(colorSource, { resetOnChange: true }) ?? 'hsl(210 18% 22%)'
  const displayAlbums = useMemo(() => albums.slice(0, 5), [albums])

  const toggleSaved = () => {
    if (!eventId) return
    const values = getSavedEvents()
    if (values.has(eventId)) values.delete(eventId)
    else values.add(eventId)
    localStorage.setItem(savedEventKey, JSON.stringify([...values]))
    setSaved(values.has(eventId))
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  if (!artist || !event) return <div className="p-8 text-secondary">Event not found.</div>

  const date = new Date(event.eventDate)
  const venueLocation = `${event.city}, ${regionName(event.country)}`

  return (
    <div className="min-h-full">
      <header
        className={artist.headerImageUrl
          ? 'relative h-80 overflow-hidden sm:h-auto sm:aspect-[3/1]'
          : 'relative h-72 overflow-hidden sm:h-auto sm:aspect-[4/1]'}
        style={{ background: `linear-gradient(120deg, ${heroColor}, ${withAlpha(heroColor, 0.48)})` }}
      >
        {artist.headerImageUrl ? (
          <img src={artist.headerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : artist.imageUrl ? (
          <img src={artist.imageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-7 bottom-7 flex items-end gap-6">
          {!artist.headerImageUrl && (
            <Avatar src={artist.imageUrl} alt={artist.name} size="xl" round className="h-32 w-32 text-4xl shadow-2xl sm:h-44 sm:w-44" />
          )}
          <div className="min-w-0">
            <div className="mb-5 inline-flex rounded-lg bg-black/55 px-4 py-3 text-xl font-black text-white backdrop-blur-sm">
              {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
            <h1 className="truncate text-5xl font-black text-white drop-shadow-xl sm:text-7xl">{artist.name}</h1>
            {artist.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {artist.genres.slice(0, 5).map((genre) => (
                  <span key={genre} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        className="px-6 pb-14 pt-8 sm:px-9"
        style={{ background: `linear-gradient(180deg, ${withAlpha(heroColor, 0.3)} 0, transparent 24rem)` }}
      >
        <h2 className="text-2xl font-black text-primary">{event.venue}, {venueLocation}</h2>
        <p className="mt-2 text-sm text-secondary">
          {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          {' · '}
          {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </p>

        <div className="mt-10 flex items-center gap-4">
          <button
            type="button"
            onClick={toggleSaved}
            className="inline-flex items-center gap-2 rounded-full border border-secondary/70 px-4 py-2 text-sm font-bold text-primary transition-colors hover:border-primary"
          >
            {saved ? <CheckIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => void shareLink(`/artist/${artist.id}/events/${event.id}`, { title: `${artist.name} at ${event.venue}` })}
            className="rounded-full p-2 text-secondary transition-colors hover:bg-white/10 hover:text-primary"
            aria-label="Share event"
          >
            <ShareIcon className="h-6 w-6" />
          </button>
        </div>

        <section className="mt-12">
          <div className="flex max-w-md overflow-hidden rounded bg-elevated">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-white text-2xl font-black text-blue-600">
              Tickets
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-4 px-5">
              <div>
                <p className="text-sm font-bold text-primary">On sale</p>
                <p className="truncate text-xs text-secondary">{event.venue}</p>
              </div>
              {event.ticketUrl ? (
                <a
                  href={event.ticketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-black"
                >
                  Find tickets
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
              ) : (
                <span className="text-xs font-semibold text-secondary">Ticket link unavailable</span>
              )}
            </div>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-secondary">
            Ticket availability and pricing are managed by the venue. All times are local to the venue timezone.
          </p>
        </section>

        <section className="mt-16">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-black text-primary">Lineup</h2>
            <Link to={`/artist/${artist.id}`} className="text-xs font-bold text-secondary hover:text-primary">See all</Link>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
            <Link to={`/artist/${artist.id}`} className="w-64 shrink-0">
              <div className="relative aspect-square overflow-hidden rounded-md bg-elevated">
                <Avatar src={artist.imageUrl} alt={artist.name} size="xl" className="h-full w-full rounded-none text-7xl" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-5 pt-20">
                  <p className="text-2xl font-black text-white">{artist.name}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-secondary">On tour</p>
            </Link>
            {displayAlbums.map((album) => (
              <Link key={album.id} to={`/album/${album.id}`} className="w-40 shrink-0 sm:w-44">
                <img src={album.coverUrl} alt={album.title} className="aspect-square w-full rounded-md object-cover shadow-lg" />
                <p className="mt-3 truncate text-sm font-bold text-primary">{album.title}</p>
                <p className="mt-1 truncate text-xs text-secondary">{artist.name}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16 pb-8">
          <h2 className="mb-7 text-2xl font-black text-primary">Venue</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <MapPinIcon className="mt-0.5 h-7 w-7 shrink-0 text-primary" />
              <div>
                <p className="font-bold text-primary">{event.venue}</p>
                <p className="mt-1 text-sm text-secondary">{venueLocation}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ClockIcon className="h-7 w-7 shrink-0 text-primary" />
              <p className="font-bold text-primary">
                Show at {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
