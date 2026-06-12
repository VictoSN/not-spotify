import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { searchService, type SearchResults } from '@/services/searchService'
import { genreService } from '@/services/genreService'
import { meService, type RecentSearch } from '@/services/meService'
import type { Genre } from '@/types/genre'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores/authStore'
import { TrackCard } from '@/components/cards/TrackCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { Spinner } from '@/components/ui/Spinner'
import { SectionHeader } from '@/components/common/SectionHeader'
import { BrowseCategoryGrid, BrowseFilterPills, type BrowseFilter } from '@/components/common/BrowseCategoryGrid'

type Tab = 'all' | 'songs' | 'artists' | 'albums' | 'playlists'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const debouncedQuery = useDebounce(query, 300)

  const [resultsState, setResultsState] = useState<{ query: string; data: SearchResults } | null>(null)
  const [genres, setGenres] = useState<Genre[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [recents, setRecents] = useState<RecentSearch[]>([])
  const [browseFilter, setBrowseFilter] = useState<BrowseFilter>('all')

  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Derive results/loading from state so the effect never calls setState synchronously.
  const trimmed = query.trim()
  const results = resultsState && resultsState.query === trimmed ? resultsState.data : null
  const loading = trimmed.length > 0 && !results

  // Load genres on first render
  useEffect(() => {
    genreService.getAll().then(setGenres)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setRecents([])
      return
    }
    meService.getRecentSearches().then(setRecents).catch(() => setRecents([]))
  }, [isAuthenticated])

  // Search when query changes
  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q) return
    let cancelled = false
    searchService.search(q).then((r) => {
      if (cancelled) return
      setResultsState({ query: q, data: r })
      const hasResults =
        r.tracks.length > 0 || r.artists.length > 0 || r.albums.length > 0 || r.playlists.length > 0
      if (hasResults && isAuthenticated) {
        meService.addRecentSearch(q).then(setRecents).catch(() => {})
      }
    })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, isAuthenticated])

  const tabs: Tab[] = ['all', 'songs', 'artists', 'albums', 'playlists']
  const isMobile = useIsMobile()
  useDocumentTitle(query.trim() ? `Search: ${query.trim()}` : 'Search')
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const [mobileValue, setMobileValue] = useState(query)

  useEffect(() => { setMobileValue(query) }, [query])

  const handleMobileSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setMobileValue(q)
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`, { replace: true })
    else navigate('/search', { replace: true })
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      {/* Mobile-only search bar — the desktop version lives in TopBar */}
      {isMobile && (
        <div className="sticky top-0 z-20 bg-page pb-3 -mx-4 px-4">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
            <input
              ref={mobileInputRef}
              autoFocus
              type="search"
              placeholder="What do you want to play?"
              value={mobileValue}
              onChange={handleMobileSearch}
              className="h-11 w-full rounded-full border border-transparent bg-elevated pl-10 pr-10 text-sm font-semibold text-primary transition-colors placeholder:font-semibold placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {mobileValue && (
              <button
                onClick={() => { setMobileValue(''); navigate('/search', { replace: true }) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
      {!query.trim() ? (
        /* Recent searches + browse */
        <>
          {recents.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-primary">Recent searches</h2>
                <button
                  onClick={() => {
                    meService.clearRecentSearches().then(() => setRecents([])).catch(() => {})
                  }}
                  className="text-xs font-semibold text-secondary hover:text-primary uppercase tracking-wider transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recents.map((recent) => (
                  <div
                    key={recent.id}
                    className="flex items-center gap-1 bg-elevated hover:bg-surface rounded-full pl-4 pr-1.5 py-1.5 transition-colors"
                  >
                    <button
                      onClick={() => navigate(`/search?q=${encodeURIComponent(recent.term)}`)}
                      className="text-sm font-medium text-primary"
                    >
                      {recent.term}
                    </button>
                    <button
                      onClick={() => {
                        meService.removeRecentSearch(recent.id)
                          .then(() => setRecents((rows) => rows.filter((row) => row.id !== recent.id)))
                          .catch(() => {})
                      }}
                      aria-label={`Remove ${recent.term}`}
                      className="text-secondary hover:text-primary p-0.5 rounded-full hover:bg-elevated transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="space-y-4">
            <div className="sticky top-0 z-20 -mx-4 bg-page/95 px-4 py-3 backdrop-blur-xl md:-mx-6 md:px-6">
              <BrowseFilterPills value={browseFilter} onChange={setBrowseFilter} />
            </div>
            <h2 className="text-2xl font-black text-primary">Browse all</h2>
            <BrowseCategoryGrid genres={genres} filter={browseFilter} />
          </section>
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

              {(activeTab === 'all' || activeTab === 'songs') && (results.tracksByLyrics?.length ?? 0) > 0 && (
                <section className="mb-8">
                  <SectionHeader title="Found in lyrics" subtitle={`Songs whose lyrics mention "${query.trim()}"`} />
                  <div className="flex flex-col gap-1">
                    {results.tracksByLyrics.slice(0, activeTab === 'songs' ? 20 : 5).map((track) => (
                      <TrackCard key={track.id} track={track} queue={results.tracksByLyrics} />
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
                results.albums.length === 0 && results.playlists.length === 0 &&
                (results.tracksByLyrics?.length ?? 0) === 0 && (
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
