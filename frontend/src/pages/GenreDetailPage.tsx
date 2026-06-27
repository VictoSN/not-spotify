import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Genre } from '@/types/genre'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import type { BrowseFeatureRow } from '@/data/browseContent'
import { genreService } from '@/services/genreService'
import { searchService, type SearchResults } from '@/services/searchService'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { TrackTile } from '@/components/cards/TrackTile'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  getBrowseCategoryBySlug,
  getBrowseChips,
  getBrowseFallbackRows,
  getBrowseHeroUrl,
  getBrowseSearchQuery,
} from '@/data/browseContent'

function fulfilledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

function searchHref(query: string) {
  return `/search?q=${encodeURIComponent(query)}`
}

function emptySearchResults(): SearchResults {
  return { tracks: [], tracksByLyrics: [], artists: [], albums: [], playlists: [] }
}

export function GenreDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [genre, setGenre] = useState<Genre | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return

    let cancelled = false
    const curated = getBrowseCategoryBySlug(slug)
    const fallbackGenre: Genre | null = curated
      ? {
          id: `browse-${curated.slug}`,
          name: curated.name,
          slug: curated.slug,
          color: curated.color,
          imageUrl: curated.coverUrl,
        }
      : null
    const label = curated?.name ?? titleFromSlug(slug)
    const query = getBrowseSearchQuery(slug, label)

    setLoading(true)
    Promise.allSettled([
      genreService.getBySlug(slug),
      genreService.getPlaylistsByGenre(slug),
      genreService.getTracksByGenre(slug),
      searchService.search(query),
    ]).then(([genreResult, playlistResult, trackResult, searchResult]) => {
      if (cancelled) return

      const apiGenre = fulfilledValue(genreResult)
      const apiPlaylists = fulfilledValue(playlistResult) ?? []
      const apiTracks = fulfilledValue(trackResult) ?? []
      const search = fulfilledValue(searchResult) ?? emptySearchResults()
      const selectedGenre = apiGenre ?? fallbackGenre

      setGenre(selectedGenre)
      setPlaylists(apiPlaylists.length > 0 ? apiPlaylists : search.playlists)
      setTracks(apiTracks.length > 0 ? apiTracks : [...search.tracks, ...search.tracksByLyrics])
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setGenre(fallbackGenre)
      setPlaylists([])
      setTracks([])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [slug])

  useDocumentTitle(genre ? genre.name : 'Genre')

  const fallbackRows = useMemo(() => (genre ? getBrowseFallbackRows(genre.slug, genre.name) : []), [genre])

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  if (!genre) return <div className="p-8 text-secondary">Genre not found.</div>

  const heroUrl = getBrowseHeroUrl(genre.slug, genre.imageUrl)
  const chips = getBrowseChips(genre.slug)
  const query = getBrowseSearchQuery(genre.slug, genre.name)
  const heroStyle = {
    background: `linear-gradient(180deg, ${genre.color}66 0%, ${genre.color}22 46%, rgba(18,18,18,0) 100%)`,
  }

  return (
    <div className="min-h-full bg-page text-primary">
      <section className="relative min-h-[320px] overflow-hidden md:min-h-[380px]">
        <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/68 via-black/18 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-page to-transparent" />
        <div className="relative flex min-h-[320px] items-end px-6 pb-8 md:min-h-[380px] md:px-8 md:pb-10">
          <h1 className="max-w-[12ch] text-[58px] font-black leading-none tracking-[-0.04em] text-white drop-shadow-2xl md:text-[86px]">
            {genre.name}
          </h1>
        </div>
      </section>

      <div className="px-5 pb-16 pt-7 md:px-8" style={heroStyle}>
        {chips.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Link
                key={chip}
                to={searchHref(chip)}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-white/18"
              >
                {chip}
              </Link>
            ))}
          </div>
        )}

        {playlists.length > 0 && (
          <GenreRow title={`Popular ${genre.name} playlists`} href={searchHref(query)}>
            <HorizontalScroller>
              {playlists.slice(0, 16).map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} flush />
              ))}
            </HorizontalScroller>
          </GenreRow>
        )}

        {tracks.length > 0 && (
          <GenreRow title={`${genre.name} tracks`} href={searchHref(query)}>
            <HorizontalScroller>
              {tracks.slice(0, 18).map((track) => (
                <TrackTile key={track.id} track={track} queue={tracks} flush />
              ))}
            </HorizontalScroller>
          </GenreRow>
        )}

        {fallbackRows.map((row) => (
          <EditorialRow key={row.title} row={row} />
        ))}

        {playlists.length === 0 && tracks.length === 0 && fallbackRows.length === 0 && (
          <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">
            Nothing has been tagged with {genre.name} yet.
          </div>
        )}
      </div>
    </div>
  )
}

function GenreRow({
  title,
  href,
  children,
}: {
  title: string
  href: string
  children: ReactNode
}) {
  return (
    <section className="mb-10">
      <SectionHeader title={title} href={href} />
      {children}
    </section>
  )
}

function EditorialRow({ row }: { row: BrowseFeatureRow }) {
  return (
    <section className="mb-10">
      {/* "Show all" and each card open a real track-list route (a discovery page or
          the themed genre page), never a name→search query for the showcase title. */}
      <SectionHeader title={row.title} href={row.href ?? row.items[0]?.href} />
      <HorizontalScroller>
        {row.items.map((item) => (
          <Link key={item.title} to={item.href ?? '/genres'} className="group w-40 shrink-0 rounded-lg p-0 transition-colors hover:bg-transparent sm:w-44">
            <div className="mb-3 aspect-square overflow-hidden rounded-md bg-elevated shadow-lg">
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
            </div>
            <p className="truncate text-sm font-semibold text-primary">{item.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-secondary">{item.description}</p>
          </Link>
        ))}
      </HorizontalScroller>
    </section>
  )
}
