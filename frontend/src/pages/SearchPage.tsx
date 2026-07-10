import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  QueueListIcon,
  UserCircleIcon,
  XMarkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid'
import { CheckBadgeIcon, FilmIcon } from '@heroicons/react/24/solid'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { searchService, type SearchResults } from '@/services/searchService'
import { genreService } from '@/services/genreService'
import { meService, type RecentSearch } from '@/services/meService'
import { trackService } from '@/services/trackService'
import { artistService } from '@/services/artistService'
import { playlistService } from '@/services/playlistService'
import type { Genre } from '@/types/genre'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Playlist } from '@/types/playlist'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'
import type { UserSearchResult } from '@/types/friend'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlaybackGate, usePlayContextGate } from '@/hooks/usePlaybackGate'
import { Spinner } from '@/components/ui/Spinner'
import { BrowseCategoryGrid, BrowseFilterPills, type BrowseFilter } from '@/components/common/BrowseCategoryGrid'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { useTranslation } from '@/i18n/useTranslation'
import { cn } from '@/utils/cn'
import { formatMs } from '@/utils/formatTime'
import { getBrowseCoverUrl } from '@/data/browseContent'

type Tab = 'all' | 'songs' | 'playlists' | 'artists' | 'albums' | 'podcasts' | 'profiles' | 'genres'
type TopResultKind = 'track' | 'artist' | 'album'

export type SearchRow =
  | { kind: 'track'; id: string; item: Track }
  | { kind: 'lyrics'; id: string; item: Track }
  | { kind: 'artist'; id: string; item: Artist }
  | { kind: 'album'; id: string; item: Album }
  | { kind: 'playlist'; id: string; item: Playlist }
  | { kind: 'musicVideo'; id: string; item: MusicVideo }
  | { kind: 'podcast'; id: string; item: PodcastSummary }
  | { kind: 'profile'; id: string; item: UserSearchResult }

export type TopSearchResult =
  | { kind: 'track'; id: string; item: Track; score: number }
  | { kind: 'artist'; id: string; item: Artist; score: number }
  | { kind: 'album'; id: string; item: Album; score: number }

type SongTableRow =
  | { kind: 'track'; id: string; item: Track }
  | { kind: 'lyrics'; id: string; item: Track }
  | { kind: 'musicVideo'; id: string; item: MusicVideo }

type FeatureCardRow =
  | { kind: 'playlist'; id: string; item: Playlist }
  | { kind: 'album'; id: string; item: Album }
  | { kind: 'podcast'; id: string; item: PodcastSummary }
  | { kind: 'musicVideo'; id: string; item: MusicVideo }

const TAB_ORDER: Tab[] = ['all', 'playlists', 'artists', 'songs', 'podcasts', 'profiles', 'albums', 'genres']

export function pickTopSearchResult(results: SearchResults, query: string): TopSearchResult | null {
  const candidates: TopSearchResult[] = [
    ...results.tracks.map((item) => ({ kind: 'track' as const, id: item.id, item, score: scoreMatch(item.title, query) + 8 })),
    ...results.artists.map((item) => ({ kind: 'artist' as const, id: item.id, item, score: scoreMatch(item.name, query) + 6 })),
    ...results.albums.map((item) => ({ kind: 'album' as const, id: item.id, item, score: scoreMatch(item.title, query) + 4 })),
  ]

  return candidates
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || topKindRank(a.kind) - topKindRank(b.kind))[0] ?? null
}

export function buildSearchRows(results: SearchResults, tab: Tab): SearchRow[] {
  const rows = interleaveRows([
    results.tracks.map((item) => ({ kind: 'track' as const, id: item.id, item })),
    results.artists.map((item) => ({ kind: 'artist' as const, id: item.id, item })),
    results.albums.map((item) => ({ kind: 'album' as const, id: item.id, item })),
    (results.musicVideos ?? []).map((item) => ({ kind: 'musicVideo' as const, id: item.id, item })),
    results.playlists.map((item) => ({ kind: 'playlist' as const, id: item.id, item })),
    (results.podcasts ?? []).map((item) => ({ kind: 'podcast' as const, id: item.id, item })),
    (results.profiles ?? []).map((item) => ({ kind: 'profile' as const, id: item.id, item })),
  ])

  if (tab === 'all') return rows
  if (tab === 'songs') {
    return [
      ...results.tracks.map((item) => ({ kind: 'track' as const, id: item.id, item })),
      ...(results.tracksByLyrics ?? []).map((item) => ({ kind: 'lyrics' as const, id: item.id, item })),
    ]
  }
  if (tab === 'playlists') return results.playlists.map((item) => ({ kind: 'playlist' as const, id: item.id, item }))
  if (tab === 'artists') return results.artists.map((item) => ({ kind: 'artist' as const, id: item.id, item }))
  if (tab === 'albums') return results.albums.map((item) => ({ kind: 'album' as const, id: item.id, item }))
  if (tab === 'podcasts') return (results.podcasts ?? []).map((item) => ({ kind: 'podcast' as const, id: item.id, item }))
  if (tab === 'profiles') return (results.profiles ?? []).map((item) => ({ kind: 'profile' as const, id: item.id, item }))
  return []
}

export function buildSongRows(results: SearchResults): SongTableRow[] {
  return [
    ...interleaveRows([
      results.tracks.map((item) => ({ kind: 'track' as const, id: item.id, item })),
      (results.musicVideos ?? []).map((item) => ({ kind: 'musicVideo' as const, id: item.id, item })),
    ]) as SongTableRow[],
    ...(results.tracksByLyrics ?? []).map((item) => ({ kind: 'lyrics' as const, id: item.id, item })),
  ]
}

function buildFeatureCards(results: SearchResults): FeatureCardRow[] {
  return [
    ...results.playlists.map((item) => ({ kind: 'playlist' as const, id: item.id, item })),
    ...results.albums.map((item) => ({ kind: 'album' as const, id: item.id, item })),
    ...(results.podcasts ?? []).map((item) => ({ kind: 'podcast' as const, id: item.id, item })),
    ...(results.musicVideos ?? []).map((item) => ({ kind: 'musicVideo' as const, id: item.id, item })),
  ]
}

export function filterSearchGenres(genres: Genre[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return genres
  return genres.filter((genre) =>
    genre.name.toLowerCase().includes(normalized) || genre.slug.toLowerCase().includes(normalized),
  )
}

function scoreMatch(value: string, query: string) {
  const text = value.trim().toLowerCase()
  const q = query.trim().toLowerCase()
  if (!text || !q) return 0
  if (text === q) return 100
  if (text.startsWith(q)) return 70
  if (text.includes(q)) return 40
  return 0
}

function topKindRank(kind: TopResultKind) {
  if (kind === 'track') return 0
  if (kind === 'artist') return 1
  return 2
}

function interleaveRows(groups: SearchRow[][]) {
  const rows: SearchRow[] = []
  const max = Math.max(0, ...groups.map((group) => group.length))
  for (let i = 0; i < max; i += 1) {
    for (const group of groups) {
      const item = group[i]
      if (item) rows.push(item)
    }
  }
  return rows
}

function hasSearchResults(results: SearchResults) {
  return (
    results.tracks.length > 0 ||
    results.artists.length > 0 ||
    results.albums.length > 0 ||
    results.playlists.length > 0 ||
    (results.musicVideos?.length ?? 0) > 0 ||
    (results.podcasts?.length ?? 0) > 0 ||
    (results.profiles?.length ?? 0) > 0 ||
    (results.tracksByLyrics?.length ?? 0) > 0
  )
}

export function SearchPage() {
  const { t } = useTranslation()
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

  const trimmed = query.trim()
  const results = resultsState && resultsState.query === trimmed ? resultsState.data : null
  const loading = trimmed.length > 0 && !results

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

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q) return
    let cancelled = false
    searchService.search(q).then((r) => {
      if (cancelled) return
      setResultsState({ query: q, data: r })
      if (hasSearchResults(r) && isAuthenticated) {
        meService.addRecentSearch(q).then(setRecents).catch(() => {})
      }
    })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, isAuthenticated])

  useEffect(() => {
    setActiveTab('all')
  }, [trimmed])

  const tabLabels: Record<Tab, string> = {
    all: t('search.tab.all'),
    songs: t('search.tab.songs'),
    playlists: t('search.tab.playlists'),
    artists: t('search.tab.artists'),
    albums: t('search.tab.albums'),
    podcasts: t('search.tab.podcasts'),
    profiles: t('search.tab.profiles'),
    genres: t('search.tab.genres'),
  }
  const isMobile = useIsMobile()
  useDocumentTitle(trimmed ? t('search.titleWithQuery', { query: trimmed }) : t('topbar.search'))
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const [mobileValue, setMobileValue] = useState(query)

  useEffect(() => { setMobileValue(query) }, [query])

  const handleMobileSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setMobileValue(q)
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`, { replace: true })
    else navigate('/search', { replace: true })
  }

  const rows = useMemo(() => (results ? buildSearchRows(results, activeTab) : []), [results, activeTab])
  const songRows = useMemo(() => (results ? buildSongRows(results) : []), [results])
  const lyricRows = useMemo<SearchRow[]>(
    () => (results ? (results.tracksByLyrics ?? []).map((item) => ({ kind: 'lyrics' as const, id: item.id, item })) : []),
    [results],
  )
  const featureCards = useMemo(() => (results ? buildFeatureCards(results) : []), [results])
  const matchedGenres = useMemo(() => filterSearchGenres(genres, trimmed), [genres, trimmed])
  const topResult = useMemo(() => (results ? pickTopSearchResult(results, trimmed) : null), [results, trimmed])

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      {isMobile && (
        <div className="-mx-4 sticky top-0 z-20 bg-page px-4 pb-3">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
            <input
              ref={mobileInputRef}
              autoFocus
              type="search"
              placeholder={t('topbar.searchPlaceholder')}
              value={mobileValue}
              onChange={handleMobileSearch}
              className="h-11 w-full rounded-full border border-transparent bg-elevated pl-10 pr-10 text-sm font-normal text-primary transition-colors placeholder:font-normal placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {mobileValue && (
              <button
                onClick={() => { setMobileValue(''); navigate('/search', { replace: true }) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary transition-colors hover:text-primary"
                aria-label={t('topbar.clearSearch')}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {!trimmed ? (
        <>
          {recents.length > 0 && (
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-normal text-primary">{t('topbar.recentSearches')}</h2>
                <button
                  onClick={() => {
                    meService.clearRecentSearches().then(() => setRecents([])).catch(() => {})
                  }}
                  className="text-xs font-normal uppercase tracking-wider text-secondary transition-colors hover:text-primary"
                >
                  {t('search.clearAll')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recents.map((recent) => (
                  <div
                    key={recent.id}
                    className="flex items-center gap-1 rounded-full bg-elevated py-1.5 pl-4 pr-1.5 transition-colors hover:bg-surface"
                  >
                    <button
                      onClick={() => navigate(`/search?q=${encodeURIComponent(recent.term)}`)}
                      className="text-sm font-normal text-primary"
                    >
                      {recent.term}
                    </button>
                    <button
                      onClick={() => {
                        meService.removeRecentSearch(recent.id)
                          .then(() => setRecents((rows) => rows.filter((row) => row.id !== recent.id)))
                          .catch(() => {})
                      }}
                      aria-label={t('search.removeRecent', { term: recent.term })}
                      className="rounded-full p-0.5 text-secondary transition-colors hover:bg-elevated hover:text-primary"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="mx-auto max-w-[1160px] space-y-4">
            <div className="sticky top-0 z-20 -mx-4 bg-page/95 px-4 py-3 backdrop-blur-xl md:-mx-6 md:px-6">
              <BrowseFilterPills value={browseFilter} onChange={setBrowseFilter} />
            </div>
            <h2 className="text-2xl font-normal text-primary">{t('topbar.browseAll')}</h2>
            <BrowseCategoryGrid genres={genres} filter={browseFilter} />
          </section>
        </>
      ) : (
        <>
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <Spinner size="lg" />
            </div>
          )}

          {!loading && results && (
            <div className="mx-auto max-w-[1340px] space-y-8">
              <div className="sticky top-0 z-20 -mx-4 flex flex-wrap justify-center gap-2 bg-page/95 px-4 py-2 backdrop-blur-xl md:-mx-6 md:px-6">
                {TAB_ORDER.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-sm font-normal transition-colors',
                      activeTab === tab
                        ? 'bg-primary text-page'
                        : 'bg-elevated text-secondary hover:text-primary',
                    )}
                  >
                    {tabLabels[tab]}
                  </button>
                ))}
              </div>

              {activeTab === 'all' && (
                <AllResultsView
                  topResult={topResult}
                  query={trimmed}
                  featureCards={featureCards}
                  rows={rows}
                  lyricRows={lyricRows}
                />
              )}

              {activeTab === 'songs' && <SongResultsTable rows={songRows} />}

              {activeTab === 'playlists' && <MediaCardGrid rows={rows.filter((row) => row.kind === 'playlist')} />}
              {activeTab === 'artists' && <PeopleGrid rows={rows.filter((row) => row.kind === 'artist')} />}
              {activeTab === 'albums' && <MediaCardGrid rows={rows.filter((row) => row.kind === 'album')} />}
              {activeTab === 'podcasts' && <PodcastResultsGrid rows={rows.filter((row) => row.kind === 'podcast')} />}
              {activeTab === 'profiles' && <PeopleGrid rows={rows.filter((row) => row.kind === 'profile')} />}
              {activeTab === 'genres' && <GenreResultsGrid genres={matchedGenres} />}

              {isTabEmpty(activeTab, rows, songRows, matchedGenres, lyricRows) && (
                <div className="py-16 text-center">
                  <MagnifyingGlassIcon className="mx-auto mb-4 h-16 w-16 text-muted" />
                  <p className="text-lg font-normal text-primary">{t('search.noResults', { query })}</p>
                  <p className="mt-1 text-sm text-secondary">{t('search.noResultsSub')}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function isTabEmpty(tab: Tab, rows: SearchRow[], songRows: SongTableRow[], genres: Genre[], lyricRows: SearchRow[]) {
  if (tab === 'all') return rows.length === 0 && lyricRows.length === 0
  if (tab === 'songs') return songRows.length === 0
  if (tab === 'genres') return genres.length === 0
  return rows.length === 0
}

function AllResultsView({
  topResult,
  query,
  featureCards,
  rows,
  lyricRows,
}: {
  topResult: TopSearchResult | null
  query: string
  featureCards: FeatureCardRow[]
  rows: SearchRow[]
  lyricRows: SearchRow[]
}) {
  const { t } = useTranslation()
  const title = topResult
    ? getTopResultPlainTitle(topResult)
    : query

  return (
    // One shared column for all three sections — the top result card and the
    // "Featuring" grid keep the exact same edges as the result rows below.
    <div className="mx-auto w-full max-w-[980px] space-y-8">
      {topResult && <TopResultCard result={topResult} query={query} />}

      {featureCards.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-normal text-primary">
            {t('search.section.featuring', { query: title })}
          </h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {featureCards.slice(0, 6).map((row) => (
              <FeatureCard key={`${row.kind}-${row.id}`} row={row} />
            ))}
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section>
          <div className="flex flex-col gap-1">
            {rows.slice(0, 24).map((row) => (
              <SearchResultRow key={`${row.kind}-${row.id}`} row={row} />
            ))}
          </div>
        </section>
      )}

      {lyricRows.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-normal text-primary">{t('search.section.foundInLyrics')}</h2>
          <div className="flex flex-col gap-1">
            {lyricRows.slice(0, 12).map((row) => (
              <SearchResultRow key={`${row.kind}-${row.id}`} row={row} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TopResultCard({ result, query }: { result: TopSearchResult; query: string }) {
  const { title, subtitle, imageUrl, fallback, rounded, path, badge } = getTopResultPresentation(result, query)
  const navigate = useNavigate()
  const actions = useSearchActions()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(path)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        navigate(path)
      }}
      className="group grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-5 rounded-md bg-surface px-5 py-4 text-left transition-colors hover:bg-elevated focus:bg-elevated focus:outline-none"
    >
        <div className={cn('flex h-[72px] w-[72px] items-center justify-center overflow-hidden bg-elevated shadow-xl', rounded)}>
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            fallback
          )}
        </div>
        <span className="min-w-0">
          <span className="block truncate text-2xl font-bold text-primary">{title}</span>
          <span className="mt-1 block truncate text-sm font-normal text-secondary">{badge === 'Top match' ? subtitle : badge}</span>
        </span>
        {actions.renderTopAction(result)}
        <button
          type="button"
          onClick={(event) => actions.playTopResult(event, result)}
          aria-label={actions.t('search.playTopResult', { title })}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-page shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {actions.isTopResultPlaying(result) ? (
            <PauseIcon className="h-6 w-6" />
          ) : (
            <PlayIcon className="ml-0.5 h-6 w-6" />
          )}
        </button>
    </div>
  )
}

function FeatureCard({ row }: { row: FeatureCardRow }) {
  const navigate = useNavigate()
  const actions = useSearchActions()
  const presentation = getFeaturePresentation(row, actions.t)
  const playableRow = featureToSearchRow(row)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(presentation.path)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        navigate(presentation.path)
      }}
      className="group min-w-0 cursor-pointer text-left focus:outline-none"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-md bg-elevated shadow-lg">
        {presentation.imageUrl ? (
          <img src={presentation.imageUrl} alt="" className="h-full w-full object-cover transition duration-200 group-hover:brightness-75" />
        ) : (
          presentation.fallback
        )}
        {playableRow && (
          <button
            type="button"
            onClick={(event) => actions.playRow(event, playableRow)}
            className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-accent text-page opacity-0 shadow-lg transition-all hover:scale-105 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:outline-none"
            aria-label={actions.t('search.playTopResult', { title: presentation.title })}
          >
            {actions.isRowPlaying(playableRow) ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
          </button>
        )}
      </div>
      <span className="block truncate text-base font-normal text-primary">{presentation.title}</span>
      <span className="mt-1 block truncate text-sm font-normal text-secondary">{presentation.subtitle}</span>
    </div>
  )
}

function SongResultsTable({ rows }: { rows: SongTableRow[] }) {
  const actions = useSearchActions()

  if (rows.length === 0) return null

  return (
    <section>
      <div className="grid grid-cols-[44px_minmax(0,1fr)_64px] md:grid-cols-[44px_minmax(0,1.45fr)_minmax(220px,0.85fr)_44px_64px] items-center border-b border-primary/10 px-3 pb-2 text-sm font-normal text-secondary">
        <span className="text-center">#</span>
        <span>{actions.t('search.table.title')}</span>
        <span className="hidden md:block">{actions.t('search.table.album')}</span>
        <span className="hidden justify-self-center md:block" aria-label={actions.t('search.table.duration')}>
          <ClockIcon className="h-5 w-5" />
        </span>
        <span />
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {rows.slice(0, 50).map((row, index) => (
          <SongTableResultRow key={`${row.kind}-${row.id}`} row={row} index={index + 1} />
        ))}
      </div>
    </section>
  )
}

function SongTableResultRow({ row, index }: { row: SongTableRow; index: number }) {
  const navigate = useNavigate()
  const actions = useSearchActions()
  const presentation = getSongRowPresentation(row, actions.t)
  const searchRow = songToSearchRow(row)
  const isPlaying = actions.isRowPlaying(searchRow)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(presentation.path)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        navigate(presentation.path)
      }}
      className="group grid grid-cols-[44px_minmax(0,1fr)_64px] md:grid-cols-[44px_minmax(0,1.45fr)_minmax(220px,0.85fr)_44px_64px] items-center rounded-md px-3 py-2 text-left transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
    >
      <span className="text-center text-base font-normal text-secondary group-hover:hidden">{index}</span>
      <button
        type="button"
        onClick={(event) => actions.playRow(event, searchRow)}
        className="hidden h-6 w-6 items-center justify-center justify-self-center text-primary group-hover:flex"
        aria-label={isPlaying ? actions.t('player.pause') : actions.t('player.play')}
      >
        {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
      </button>

      <span className="flex min-w-0 items-center gap-3">
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-elevated">
          {presentation.imageUrl ? (
            <img src={presentation.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            presentation.fallback
          )}
        </span>
        <span className="min-w-0">
          <span className={cn('block truncate text-base font-normal', isPlaying ? 'text-accent' : 'text-primary')}>
            {presentation.title}
          </span>
          <span className="block truncate text-sm text-secondary">{presentation.subtitle}</span>
        </span>
      </span>

      <span className="hidden min-w-0 truncate text-sm text-secondary md:block">{presentation.album}</span>
      <span className="hidden justify-self-center text-sm text-secondary md:block">{formatMs(presentation.durationMs)}</span>
      <span className="justify-self-end">{actions.renderRowAction(searchRow)}</span>
    </div>
  )
}

function MediaCardGrid({ rows }: { rows: SearchRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {rows.map((row) => (
        <MediaGridCard key={`${row.kind}-${row.id}`} row={row} />
      ))}
    </section>
  )
}

function MediaGridCard({ row }: { row: SearchRow }) {
  const navigate = useNavigate()
  const actions = useSearchActions()
  const presentation = getMediaGridPresentation(row, actions.t)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(presentation.path)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        navigate(presentation.path)
      }}
      className="group min-w-0 cursor-pointer text-left focus:outline-none"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-md bg-elevated shadow-lg">
        {presentation.imageUrl ? (
          <img src={presentation.imageUrl} alt="" className="h-full w-full object-cover transition duration-200 group-hover:brightness-75" />
        ) : (
          presentation.fallback
        )}
        {(row.kind === 'album' || row.kind === 'musicVideo') && (
          <button
            type="button"
            onClick={(event) => actions.playRow(event, row)}
            className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-accent text-page opacity-0 shadow-lg transition-all hover:scale-105 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:outline-none"
            aria-label={actions.t('search.playTopResult', { title: presentation.title })}
          >
            {actions.isRowPlaying(row) ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
          </button>
        )}
      </div>
      <span className="block line-clamp-2 text-base font-normal leading-tight text-primary">{presentation.title}</span>
      <span className="mt-1 block line-clamp-2 text-sm font-normal leading-snug text-secondary">{presentation.subtitle}</span>
    </div>
  )
}

function PeopleGrid({ rows }: { rows: SearchRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="grid grid-cols-2 gap-x-7 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {rows.map((row) => (
        <PersonGridCard key={`${row.kind}-${row.id}`} row={row} />
      ))}
    </section>
  )
}

function PersonGridCard({ row }: { row: SearchRow }) {
  const navigate = useNavigate()
  const actions = useSearchActions()
  const presentation = getPersonGridPresentation(row, actions.t)

  return (
    <button type="button" onClick={() => navigate(presentation.path)} className="group min-w-0 text-left">
      <div className="mb-4 aspect-square overflow-hidden rounded-full bg-elevated shadow-lg">
        {presentation.imageUrl ? (
          <img src={presentation.imageUrl} alt="" className="h-full w-full object-cover transition duration-200 group-hover:brightness-90" />
        ) : (
          presentation.fallback
        )}
      </div>
      <span className="block truncate text-base font-normal text-primary">{presentation.title}</span>
      <span className="mt-1 block truncate text-sm text-secondary">{presentation.subtitle}</span>
    </button>
  )
}

function PodcastResultsGrid({ rows }: { rows: SearchRow[] }) {
  const { t } = useTranslation()
  if (rows.length === 0) return null
  return (
    <section className="mx-auto max-w-[900px] space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-normal text-primary">{t('search.tab.podcasts')}</h2>
        <span className="text-sm font-normal text-secondary">{t('common.showAll')}</span>
      </div>
      <MediaCardGrid rows={rows} />
      <div className="border-t border-primary/10 pt-8" />
    </section>
  )
}

function GenreResultsGrid({ genres }: { genres: Genre[] }) {
  const navigate = useNavigate()
  if (genres.length === 0) return null
  return (
    <section className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {genres.map((genre) => {
        const imageUrl = getBrowseCoverUrl(genre.slug, genre.imageUrl)
        return (
          <button key={genre.id} type="button" onClick={() => navigate(`/genres/${genre.slug}`)} className="group text-left">
            <div className="mb-3 aspect-square overflow-hidden rounded-md bg-elevated shadow-lg">
              <img src={imageUrl} alt="" className="h-full w-full object-cover transition duration-200 group-hover:brightness-80" />
            </div>
            <span className="block line-clamp-2 text-base font-normal text-primary">{genre.name}</span>
          </button>
        )
      })}
    </section>
  )
}

export function SearchResultRow({ row, compact = false }: { row: SearchRow; compact?: boolean }) {
  const navigate = useNavigate()
  const actions = useSearchActions()
  const presentation = getRowPresentation(row, actions.t)
  const isPlaying = actions.isRowPlaying(row)
  const isPlayable = row.kind !== 'playlist' && row.kind !== 'podcast' && row.kind !== 'profile'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(presentation.path)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        navigate(presentation.path)
      }}
      className={cn(
        'group grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none',
        compact ? 'py-1.5' : 'py-2',
      )}
    >
      <div className={cn('relative flex shrink-0 items-center justify-center overflow-hidden bg-elevated', presentation.rounded, compact ? 'h-11 w-11' : 'h-12 w-12')}>
        {presentation.imageUrl ? (
          <img
            src={presentation.imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-150 group-hover:brightness-50"
          />
        ) : (
          presentation.fallback
        )}
        {isPlayable && (
          <button
            type="button"
            onClick={(event) => actions.playRow(event, row)}
            className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            aria-label={isPlaying ? actions.t('player.pause') : actions.t('player.play')}
          >
            {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
          </button>
        )}
      </div>

      <span className="min-w-0">
        <span className={cn('block truncate text-sm font-normal', isPlaying ? 'text-accent' : 'text-primary')}>
          {presentation.title}
        </span>
        <span className="block truncate text-xs font-normal text-secondary">{presentation.subtitle}</span>
      </span>

      <span className="hidden rounded-full bg-elevated px-2.5 py-1 text-[11px] font-normal text-secondary sm:inline-flex">
        {presentation.badge}
      </span>

      {actions.renderRowAction(row)}
    </div>
  )
}

function useSearchActions() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const startTrack = usePlaybackGate()
  const startContext = usePlayContextGate()
  const playVideo = usePlayerStore((s) => s.playVideo)
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const currentContextType = usePlayerStore((s) => s.currentContextType)
  const currentContextId = usePlayerStore((s) => s.currentContextId)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const currentVideo = usePlayerStore((s) => s.currentVideo)
  const isVideoPlaying = usePlayerStore((s) => s.isVideoPlaying)
  const {
    likedTrackIds,
    likeTrack,
    unlikeTrack,
    savedAlbumIds,
    saveAlbum,
    unsaveAlbum,
    followedArtistIds,
    followArtist,
    unfollowArtist,
    savedVideoIds,
    saveVideo,
    unsaveVideo,
    savedPodcastIds,
    savePodcast,
    unsavePodcast,
  } = useLibraryStore()

  const isTrackActive = (track: Track) => currentTrack?.id === track.id
  const isAlbumActive = (album: Album) =>
    currentContextType !== 'artist' &&
    currentContextType !== 'mix' &&
    currentTrack?.album.id === album.id
  const isArtistActive = (artist: Artist) => currentContextType === 'artist' && currentContextId === artist.id
  const isVideoActive = (video: MusicVideo) => playbackMode === 'video' && currentVideo?.id === video.id

  const playTrack = (event: React.MouseEvent, track: Track) => {
    event.stopPropagation()
    if (isTrackActive(track)) {
      togglePlayPause()
      return
    }
    startTrack(track, [track])
  }

  const playAlbum = async (event: React.MouseEvent, album: Album) => {
    event.stopPropagation()
    if (isAlbumActive(album)) {
      togglePlayPause()
      return
    }
    try {
      const tracks = await trackService.getByAlbum(album.id)
      startContext({ type: 'album', id: album.id }, tracks, 0)
    } catch {
      // Detail navigation still works if album playback cannot be loaded.
    }
  }

  const playArtist = async (event: React.MouseEvent, artist: Artist) => {
    event.stopPropagation()
    if (isArtistActive(artist)) {
      togglePlayPause()
      return
    }
    try {
      const tracks = await artistService.getTopTracks(artist.id, 20)
      startContext({ type: 'artist', id: artist.id }, tracks, 0)
    } catch {
      // Detail navigation still works if top tracks cannot be loaded.
    }
  }

  const playPlaylist = async (event: React.MouseEvent, playlist: Playlist) => {
    event.stopPropagation()
    try {
      const full = playlist.tracks?.length ? playlist : await playlistService.getById(playlist.id)
      const tracks = full.tracks?.map((row) => row.track) ?? []
      startContext({ type: 'playlist', id: playlist.id }, tracks, 0)
    } catch {
      // Detail navigation still works if playlist playback cannot be loaded.
    }
  }

  const playVideoRow = (event: React.MouseEvent, video: MusicVideo) => {
    event.stopPropagation()
    if (isVideoActive(video)) {
      togglePlayPause()
      return
    }
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Start watching with a free account', imageUrl: video.thumbnailUrl })
      return
    }
    playVideo(video, [video])
  }

  const playRow = (event: React.MouseEvent, row: SearchRow) => {
    if (row.kind === 'track' || row.kind === 'lyrics') playTrack(event, row.item)
    else if (row.kind === 'album') void playAlbum(event, row.item)
    else if (row.kind === 'artist') void playArtist(event, row.item)
    else if (row.kind === 'musicVideo') playVideoRow(event, row.item)
    else if (row.kind === 'playlist') void playPlaylist(event, row.item)
  }

  const playTopResult = (event: React.MouseEvent, result: TopSearchResult) => {
    if (result.kind === 'track') playTrack(event, result.item)
    else if (result.kind === 'album') void playAlbum(event, result.item)
    else void playArtist(event, result.item)
  }

  const isRowPlaying = (row: SearchRow) => {
    if ((row.kind === 'track' || row.kind === 'lyrics') && isTrackActive(row.item)) return isPlaying
    if (row.kind === 'album' && isAlbumActive(row.item)) return isPlaying
    if (row.kind === 'artist' && isArtistActive(row.item)) return isPlaying
    if (row.kind === 'musicVideo' && isVideoActive(row.item)) return isVideoPlaying
    return false
  }

  const isTopResultPlaying = (result: TopSearchResult) => {
    if (result.kind === 'track') return isTrackActive(result.item) && isPlaying
    if (result.kind === 'album') return isAlbumActive(result.item) && isPlaying
    return isArtistActive(result.item) && isPlaying
  }

  const toggleTrackLike = (event: React.MouseEvent, track: Track) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.saveMusicPrompt'), imageUrl: track.album.coverUrl })
      return
    }
    if (likedTrackIds.has(track.id)) unlikeTrack(track.id)
    else likeTrack(track)
  }

  const toggleAlbumSave = (event: React.MouseEvent, album: Album) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.saveMusicPrompt'), imageUrl: album.coverUrl })
      return
    }
    if (savedAlbumIds.has(album.id)) unsaveAlbum(album.id)
    else saveAlbum(album)
  }

  const toggleArtistFollow = (event: React.MouseEvent, artist: Artist) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('detail.followArtistPrompt'), imageUrl: artist.imageUrl })
      return
    }
    if (followedArtistIds.has(artist.id)) unfollowArtist(artist.id)
    else followArtist(artist)
  }

  const toggleVideoSave = (event: React.MouseEvent, video: MusicVideo) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Save videos with a free account', imageUrl: video.thumbnailUrl })
      return
    }
    if (savedVideoIds.has(video.id)) unsaveVideo(video.id)
    else saveVideo(video)
  }

  const togglePodcastSave = (event: React.MouseEvent, podcast: PodcastSummary) => {
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Save podcasts with a free account', imageUrl: podcast.imageUrl })
      return
    }
    if (savedPodcastIds.has(podcast.id)) unsavePodcast(podcast.id)
    else savePodcast(podcast)
  }

  const renderRowAction = (row: SearchRow) => {
    if (row.kind === 'artist') {
      const followed = followedArtistIds.has(row.item.id)
      return (
        <button
          type="button"
          onClick={(event) => toggleArtistFollow(event, row.item)}
          className={cn(
            'shrink-0 rounded-full border px-4 py-1.5 text-xs font-normal transition-all hover:scale-[1.02] active:scale-95',
            followed ? 'border-primary bg-primary text-page' : 'border-secondary/60 text-primary hover:border-primary',
          )}
        >
          {followed ? t('common.following') : t('common.follow')}
        </button>
      )
    }

    if (row.kind === 'track' || row.kind === 'lyrics') {
      return <SaveIconButton active={likedTrackIds.has(row.item.id)} onClick={(event) => toggleTrackLike(event, row.item)} />
    }
    if (row.kind === 'album') {
      return <SaveIconButton active={savedAlbumIds.has(row.item.id)} onClick={(event) => toggleAlbumSave(event, row.item)} />
    }
    if (row.kind === 'musicVideo') {
      return <SaveIconButton active={savedVideoIds.has(row.item.id)} onClick={(event) => toggleVideoSave(event, row.item)} />
    }
    if (row.kind === 'podcast') {
      return <SaveIconButton active={savedPodcastIds.has(row.item.id)} onClick={(event) => togglePodcastSave(event, row.item)} />
    }

    return <span className="h-9 w-9 shrink-0" aria-hidden="true" />
  }

  const renderTopAction = (result: TopSearchResult) => {
    if (result.kind === 'artist') {
      const followed = followedArtistIds.has(result.item.id)
      return (
        <button
          type="button"
          onClick={(event) => toggleArtistFollow(event, result.item)}
          className={cn(
            'hidden shrink-0 rounded-full border px-4 py-2 text-sm font-normal transition-all hover:scale-[1.02] active:scale-95 sm:inline-flex',
            followed ? 'border-primary bg-primary text-page' : 'border-secondary/60 text-primary hover:border-primary',
          )}
        >
          {followed ? t('common.following') : t('common.follow')}
        </button>
      )
    }

    if (result.kind === 'track') {
      return (
        <span className="hidden sm:inline-flex">
          <SaveIconButton active={likedTrackIds.has(result.item.id)} onClick={(event) => toggleTrackLike(event, result.item)} />
        </span>
      )
    }

    return (
      <span className="hidden sm:inline-flex">
        <SaveIconButton active={savedAlbumIds.has(result.item.id)} onClick={(event) => toggleAlbumSave(event, result.item)} />
      </span>
    )
  }

  return { t, navigate, playRow, playTopResult, isRowPlaying, isTopResultPlaying, renderRowAction, renderTopAction }
}

function SaveIconButton({ active, onClick }: { active: boolean; onClick: (event: React.MouseEvent) => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:text-primary',
        active && 'text-accent hover:text-accent',
      )}
      aria-label={active ? t('detail.removeFromLibrary') : t('detail.saveToLibrary')}
    >
      <AnimatedLikeIcon liked={active} className="h-5 w-5" heartClassName="h-5 w-5" />
    </button>
  )
}

function getTopResultPlainTitle(result: TopSearchResult) {
  if (result.kind === 'artist') return result.item.name
  return result.item.title
}

function featureToSearchRow(row: FeatureCardRow): SearchRow | null {
  if (row.kind === 'playlist') return { kind: 'playlist', id: row.id, item: row.item }
  if (row.kind === 'album') return { kind: 'album', id: row.id, item: row.item }
  if (row.kind === 'musicVideo') return { kind: 'musicVideo', id: row.id, item: row.item }
  return null
}

function songToSearchRow(row: SongTableRow): SearchRow {
  if (row.kind === 'musicVideo') return { kind: 'musicVideo', id: row.id, item: row.item }
  if (row.kind === 'lyrics') return { kind: 'lyrics', id: row.id, item: row.item }
  return { kind: 'track', id: row.id, item: row.item }
}

function getFeaturePresentation(row: FeatureCardRow, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (row.kind === 'playlist') {
    return {
      title: row.item.name,
      subtitle: t('search.row.byOwner', { owner: row.item.owner.name }),
      imageUrl: row.item.coverUrl,
      fallback: <QueueListIcon className="h-12 w-12 text-secondary" />,
      path: `/playlist/${row.item.id}`,
    }
  }

  if (row.kind === 'album') {
    return {
      title: row.item.title,
      subtitle: t('search.row.byArtist', { artist: row.item.artist.name }),
      imageUrl: row.item.coverUrl,
      fallback: <MusicalNoteIcon className="h-12 w-12 text-secondary" />,
      path: `/album/${row.item.id}`,
    }
  }

  if (row.kind === 'musicVideo') {
    return {
      title: row.item.title,
      subtitle: t('search.row.byArtist', { artist: row.item.artist.name }),
      imageUrl: row.item.thumbnailUrl,
      fallback: <FilmIcon className="h-12 w-12 text-secondary" />,
      path: `/videos/${row.item.id}`,
    }
  }

  return {
    title: row.item.title,
    subtitle: row.item.author,
    imageUrl: row.item.imageUrl,
    fallback: <MicrophoneIcon className="h-12 w-12 text-secondary" />,
    path: `/podcasts/${row.item.id}`,
  }
}

function getSongRowPresentation(row: SongTableRow, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (row.kind === 'musicVideo') {
    return {
      title: row.item.title,
      subtitle: t('search.row.videoBy', { artist: row.item.artist.name }),
      album: row.item.title,
      imageUrl: row.item.thumbnailUrl,
      fallback: <FilmIcon className="h-full w-full p-2.5 text-secondary" />,
      path: `/videos/${row.item.id}`,
      durationMs: row.item.durationMs,
    }
  }

  return {
    title: row.item.title,
    subtitle: row.kind === 'lyrics'
      ? t('search.row.lyricsBy', { artist: row.item.artist.name })
      : row.item.artist.name,
    album: row.item.album.title,
    imageUrl: row.item.album.coverUrl,
    fallback: <MusicalNoteIcon className="h-full w-full p-2.5 text-secondary" />,
    path: `/track/${row.item.id}`,
    durationMs: row.item.durationMs,
  }
}

function getMediaGridPresentation(row: SearchRow, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (row.kind === 'playlist') {
    return {
      title: row.item.name,
      subtitle: t('search.row.byOwner', { owner: row.item.owner.name }),
      imageUrl: row.item.coverUrl,
      fallback: <QueueListIcon className="flex h-full w-full p-12 text-secondary" />,
      path: `/playlist/${row.item.id}`,
    }
  }

  if (row.kind === 'album') {
    return {
      title: row.item.title,
      subtitle: `${row.item.releaseDate.slice(0, 4)} • ${row.item.artist.name}`,
      imageUrl: row.item.coverUrl,
      fallback: <MusicalNoteIcon className="flex h-full w-full p-12 text-secondary" />,
      path: `/album/${row.item.id}`,
    }
  }

  if (row.kind === 'musicVideo') {
    return {
      title: row.item.title,
      subtitle: t('search.row.byArtist', { artist: row.item.artist.name }),
      imageUrl: row.item.thumbnailUrl,
      fallback: <FilmIcon className="flex h-full w-full p-12 text-secondary" />,
      path: `/videos/${row.item.id}`,
    }
  }

  if (row.kind === 'podcast') {
    return {
      title: row.item.title,
      subtitle: row.item.description || row.item.author,
      imageUrl: row.item.imageUrl,
      fallback: <MicrophoneIcon className="flex h-full w-full p-12 text-secondary" />,
      path: `/podcasts/${row.item.id}`,
    }
  }

  return {
    title: '',
    subtitle: '',
    imageUrl: null,
    fallback: <MusicalNoteIcon className="flex h-full w-full p-12 text-secondary" />,
    path: '/search',
  }
}

function getPersonGridPresentation(row: SearchRow, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (row.kind === 'artist') {
    return {
      title: row.item.name,
      subtitle: t('search.type.artist'),
      imageUrl: row.item.imageUrl,
      fallback: <UserCircleIcon className="h-full w-full text-secondary" />,
      path: `/artist/${row.item.id}`,
    }
  }

  if (row.kind === 'profile') {
    return {
      title: row.item.name,
      subtitle: t('search.type.profile'),
      imageUrl: row.item.avatarUrl,
      fallback: <UserCircleIcon className="h-full w-full text-secondary" />,
      path: `/users/${row.item.id}`,
    }
  }

  return {
    title: '',
    subtitle: '',
    imageUrl: null,
    fallback: <UserCircleIcon className="h-full w-full text-secondary" />,
    path: '/search',
  }
}

function getTopResultPresentation(result: TopSearchResult, query: string) {
  if (result.kind === 'track') {
    return {
      title: result.item.title,
      subtitle: result.item.artist.name,
      imageUrl: result.item.album.coverUrl,
      fallback: <MusicalNoteIcon className="h-10 w-10 text-secondary" />,
      rounded: 'rounded-md',
      path: `/track/${result.item.id}`,
      badge: result.item.title.toLowerCase() === query.toLowerCase() ? 'Song' : 'Top match',
    }
  }

  if (result.kind === 'artist') {
    return {
      title: result.item.name,
      subtitle: 'Artist',
      imageUrl: result.item.imageUrl,
      fallback: <UserCircleIcon className="h-12 w-12 text-secondary" />,
      rounded: 'rounded-full',
      path: `/artist/${result.item.id}`,
      badge: 'Artist',
    }
  }

  return {
    title: result.item.title,
    subtitle: result.item.artist.name,
    imageUrl: result.item.coverUrl,
    fallback: <MusicalNoteIcon className="h-10 w-10 text-secondary" />,
    rounded: 'rounded-md',
    path: `/album/${result.item.id}`,
    badge: result.item.type === 'single' ? 'Single' : 'Album',
  }
}

function getRowPresentation(row: SearchRow, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (row.kind === 'track' || row.kind === 'lyrics') {
    return {
      title: row.item.title,
      subtitle: (
        <>
          {row.item.explicit && <span className="mr-1 rounded bg-secondary px-1 text-[9px] font-normal text-page">E</span>}
          {row.kind === 'lyrics'
            ? t('search.row.lyricsBy', { artist: row.item.artist.name })
            : t('search.row.songBy', { artist: row.item.artist.name })}
        </>
      ),
      imageUrl: row.item.album.coverUrl,
      fallback: <MusicalNoteIcon className="h-5 w-5 text-secondary" />,
      rounded: 'rounded',
      path: `/track/${row.item.id}`,
      badge: row.kind === 'lyrics' ? t('search.type.lyrics') : t('search.type.song'),
    }
  }

  if (row.kind === 'artist') {
    return {
      title: (
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate">{row.item.name}</span>
          {row.item.verified && <CheckBadgeIcon className="h-4 w-4 shrink-0 text-accent" aria-label={t('artist.verified')} />}
        </span>
      ),
      subtitle: t('search.type.artist'),
      imageUrl: row.item.imageUrl,
      fallback: <UserCircleIcon className="h-6 w-6 text-secondary" />,
      rounded: 'rounded-full',
      path: `/artist/${row.item.id}`,
      badge: t('search.type.artist'),
    }
  }

  if (row.kind === 'album') {
    return {
      title: row.item.title,
      subtitle: `${row.item.type === 'single' ? t('search.type.single') : t('search.type.album')} • ${row.item.artist.name}`,
      imageUrl: row.item.coverUrl,
      fallback: <MusicalNoteIcon className="h-5 w-5 text-secondary" />,
      rounded: 'rounded',
      path: `/album/${row.item.id}`,
      badge: row.item.type === 'single' ? t('search.type.single') : t('search.type.album'),
    }
  }

  if (row.kind === 'playlist') {
    return {
      title: row.item.name,
      subtitle: t('search.row.playlistBy', { owner: row.item.owner.name }),
      imageUrl: row.item.coverUrl,
      fallback: <QueueListIcon className="h-5 w-5 text-secondary" />,
      rounded: 'rounded',
      path: `/playlist/${row.item.id}`,
      badge: t('search.type.playlist'),
    }
  }

  if (row.kind === 'musicVideo') {
    return {
      title: row.item.title,
      subtitle: t('search.row.videoBy', { artist: row.item.artist.name }),
      imageUrl: row.item.thumbnailUrl,
      fallback: <FilmIcon className="h-5 w-5 text-secondary" />,
      rounded: 'rounded',
      path: `/videos/${row.item.id}`,
      badge: t('search.type.musicVideo'),
    }
  }

  if (row.kind === 'podcast') {
    return {
      title: row.item.title,
      subtitle: t('search.row.podcastBy', { author: row.item.author }),
      imageUrl: row.item.imageUrl,
      fallback: <MicrophoneIcon className="h-5 w-5 text-secondary" />,
      rounded: 'rounded',
      path: `/podcasts/${row.item.id}`,
      badge: t('search.type.podcast'),
    }
  }

  return {
    title: row.item.name,
    subtitle: row.item.isArtist ? t('search.row.artistProfile') : t('search.type.profile'),
    imageUrl: row.item.avatarUrl,
    fallback: <UserCircleIcon className="h-6 w-6 text-secondary" />,
    rounded: 'rounded-full',
    path: `/users/${row.item.id}`,
    badge: t('search.type.profile'),
  }
}
