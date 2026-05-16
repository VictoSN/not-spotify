import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { searchService, type SearchResults } from '@/services/searchService'
import { genreService } from '@/services/genreService'
import type { Genre } from '@/types/genre'
import { useDebounce } from '@/hooks/useDebounce'
import { TrackCard } from '@/components/cards/TrackCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { Spinner } from '@/components/ui/Spinner'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Link } from 'react-router-dom'

type Tab = 'all' | 'songs' | 'artists' | 'albums' | 'playlists'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const debouncedQuery = useDebounce(query, 300)

  const [results, setResults] = useState<SearchResults | null>(null)
  const [genres, setGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('all')

  // Load genres on first render
  useEffect(() => {
    genreService.getAll().then(setGenres)
  }, [])

  // Search when query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null)
      return
    }
    setLoading(true)
    searchService.search(debouncedQuery).then((r) => {
      setResults(r)
      setLoading(false)
    })
  }, [debouncedQuery])

  const tabs: Tab[] = ['all', 'songs', 'artists', 'albums', 'playlists']

  return (
    <div className="px-6 py-6">
      {!query && !results ? (
        /* Browse genres */
        <>
          <h2 className="text-2xl font-bold text-primary mb-6">Browse genres</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {genres.map((genre) => (
              <Link
                key={genre.id}
                to={`/genres/${genre.slug}`}
                className="relative h-28 rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                style={{ backgroundColor: genre.color }}
              >
                {genre.imageUrl && (
                  <img
                    src={genre.imageUrl}
                    alt={genre.name}
                    className="absolute bottom-0 right-0 w-16 h-16 object-cover rounded-tl-lg opacity-80 rotate-[15deg] translate-x-3 translate-y-2"
                  />
                )}
                <span className="absolute top-4 left-4 text-white font-black text-lg drop-shadow">{genre.name}</span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        /* Search results */
        <>
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Spinner size="lg" />
            </div>
          )}

          {!loading && results && (
            <>
              {/* Tabs */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors ${
                      activeTab === tab
                        ? 'bg-primary text-page'
                        : 'bg-elevated text-secondary hover:text-primary'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Results */}
              {(activeTab === 'all' || activeTab === 'songs') && results.tracks.length > 0 && (
                <section className="mb-8">
                  <SectionHeader title="Songs" />
                  <div className="flex flex-col gap-1">
                    {results.tracks.slice(0, activeTab === 'songs' ? 50 : 5).map((track) => (
                      <TrackCard key={track.id} track={track} queue={results.tracks} />
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === 'all' || activeTab === 'artists') && results.artists.length > 0 && (
                <section className="mb-8">
                  <SectionHeader title="Artists" />
                  <div className="flex gap-4 flex-wrap">
                    {results.artists.slice(0, activeTab === 'artists' ? 50 : 5).map((artist) => (
                      <ArtistCard key={artist.id} artist={artist} />
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === 'all' || activeTab === 'albums') && results.albums.length > 0 && (
                <section className="mb-8">
                  <SectionHeader title="Albums" />
                  <div className="flex gap-4 flex-wrap">
                    {results.albums.slice(0, activeTab === 'albums' ? 50 : 5).map((album) => (
                      <AlbumCard key={album.id} album={album} />
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === 'all' || activeTab === 'playlists') && results.playlists.length > 0 && (
                <section className="mb-8">
                  <SectionHeader title="Playlists" />
                  <div className="flex gap-4 flex-wrap">
                    {results.playlists.slice(0, activeTab === 'playlists' ? 50 : 5).map((playlist) => (
                      <PlaylistCard key={playlist.id} playlist={playlist} />
                    ))}
                  </div>
                </section>
              )}

              {results.tracks.length === 0 && results.artists.length === 0 &&
                results.albums.length === 0 && results.playlists.length === 0 && (
                <div className="text-center py-16">
                  <MagnifyingGlassIcon className="w-16 h-16 text-muted mx-auto mb-4" />
                  <p className="text-primary font-semibold text-lg">No results for "{query}"</p>
                  <p className="text-secondary text-sm mt-1">Check your spelling or try different keywords.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
