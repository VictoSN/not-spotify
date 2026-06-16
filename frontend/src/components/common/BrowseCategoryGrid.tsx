import { Link } from 'react-router-dom'
import { useTranslation } from '@/i18n/useTranslation'
import type { Genre } from '@/types/genre'

type BrowseCategorySeed = {
  name: string
  slug: string
  color: string
  kind?: BrowseFilter
  to?: string
}

type BrowseCategory = BrowseCategorySeed & {
  id: string
  imageUrl: string
  to: string
}

export type BrowseFilter = 'all' | 'music' | 'podcasts'

const curatedBrowseCategories: BrowseCategorySeed[] = [
  { name: 'Music', slug: 'music', color: '#dc148c' },
  { name: 'Podcasts', slug: 'podcasts', color: '#006450', kind: 'podcasts' },
  { name: 'Live Events', slug: 'live-events', color: '#8400e7' },
  { name: 'Fitness', slug: 'fitness', color: '#777777', to: '/moods' },
  { name: 'Made For You', slug: 'made-for-you', color: '#1e3264' },
  { name: 'New Releases', slug: 'new-releases', color: '#608108' },
  { name: 'Mandopop', slug: 'mandopop', color: '#23366f' },
  { name: 'Pop', slug: 'pop', color: '#477d95' },
  { name: 'K-Pop', slug: 'k-pop', color: '#e8115b' },
  { name: 'Hip-Hop', slug: 'hip-hop', color: '#477d95' },
  { name: 'Charts', slug: 'charts', color: '#8d67ab' },
  { name: 'Podcast Charts', slug: 'podcast-charts', color: '#0d72ea', kind: 'podcasts' },
  { name: 'Educational', slug: 'educational', color: '#477d95', kind: 'podcasts' },
  { name: 'Documentary', slug: 'documentary', color: '#503750', kind: 'podcasts' },
  { name: 'Comedy', slug: 'comedy', color: '#af2896', kind: 'podcasts' },
  { name: 'J-Tracks', slug: 'j-tracks', color: '#8c1932' },
  { name: 'Indie', slug: 'indie', color: '#e8115b' },
  { name: 'Dance / Electronic', slug: 'electronic', color: '#477d95' },
  { name: 'Mood', slug: 'mood', color: '#e1118c', to: '/moods' },
  { name: 'Discover', slug: 'discover', color: '#8d67ab' },
  { name: 'Sleep', slug: 'sleep', color: '#1e3264', to: '/moods' },
  { name: 'Chill', slug: 'chill', color: '#b06239', to: '/moods' },
  { name: 'Love', slug: 'love', color: '#dc148c' },
  { name: 'RADAR', slug: 'radar', color: '#a56752' },
  { name: 'R&B', slug: 'rnb', color: '#d66d00' },
  { name: 'Workout Music', slug: 'workout', color: '#777777', to: '/moods' },
  { name: 'Soundtracks', slug: 'soundtracks', color: '#3046c7' },
  { name: 'Party', slug: 'party', color: '#8d67ab', to: '/moods' },
  { name: 'Rock', slug: 'rock', color: '#006450' },
  { name: 'Latin', slug: 'latin', color: '#0d72ea' },
  { name: 'Country', slug: 'country', color: '#e13300' },
  { name: 'At Home', slug: 'at-home', color: '#477d95', to: '/moods' },
  { name: 'Decades', slug: 'decades', color: '#a56752' },
  { name: 'Metal', slug: 'metal', color: '#e8115b' },
  { name: 'Jazz', slug: 'jazz', color: '#8d67ab' },
  { name: 'Classical', slug: 'classical', color: '#81472b' },
]

const fallbackColor = '#477d95'

function getCoverUrl(slug: string, imageUrl?: string | null) {
  return imageUrl ?? `https://picsum.photos/seed/not-spotify-browse-${encodeURIComponent(slug)}/260/260`
}

function getSearchUrl(name: string) {
  return `/search?q=${encodeURIComponent(name)}`
}

function buildBrowseCategories(genres: Genre[]): BrowseCategory[] {
  const genreBySlug = new Map(genres.map((genre) => [genre.slug, genre]))
  const usedGenreIds = new Set<string>()

  const curated = curatedBrowseCategories.map((category) => {
    const genre = genreBySlug.get(category.slug)
    if (genre) usedGenreIds.add(genre.id)

    return {
      id: genre?.id ?? `browse-${category.slug}`,
      name: category.name,
      slug: category.slug,
      color: genre?.color ?? category.color,
      kind: category.kind ?? 'music',
      imageUrl: getCoverUrl(category.slug, genre?.imageUrl),
      to: category.to ?? (genre ? `/genres/${genre.slug}` : getSearchUrl(category.name)),
    }
  })

  const remainingGenres = genres
    .filter((genre) => !usedGenreIds.has(genre.id))
    .map((genre) => ({
      id: genre.id,
      name: genre.name,
      slug: genre.slug,
      color: genre.color || fallbackColor,
      kind: 'music' as const,
      imageUrl: getCoverUrl(genre.slug, genre.imageUrl),
      to: `/genres/${genre.slug}`,
    }))

  return [...curated, ...remainingGenres]
}

export function BrowseFilterPills({
  value,
  onChange,
}: {
  value: BrowseFilter
  onChange: (value: BrowseFilter) => void
}) {
  const { t } = useTranslation()
  const filters: Array<{ value: BrowseFilter; label: string }> = [
    { value: 'all', label: t('browse.filter.all') },
    { value: 'music', label: t('browse.filter.music') },
    { value: 'podcasts', label: t('browse.filter.podcasts') },
  ]

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {filters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          className={`h-8 shrink-0 rounded-full px-3 text-sm font-bold transition-colors ${
            value === filter.value
              ? 'bg-primary text-page'
              : 'bg-elevated text-secondary hover:bg-surface hover:text-primary'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}

export function BrowseCategoryGrid({
  genres,
  filter = 'all',
}: {
  genres: Genre[]
  filter?: BrowseFilter
}) {
  const categories = buildBrowseCategories(genres).filter((category) => {
    if (filter === 'all') return true
    return category.kind === filter
  })

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          to={category.to}
          className="group relative isolate h-[150px] overflow-hidden rounded-md p-4 shadow-sm outline-none transition-transform duration-200 hover:scale-[1.018] focus-visible:ring-2 focus-visible:ring-white/70"
          style={{ backgroundColor: category.color }}
        >
          <span className="relative z-10 block max-w-[70%] text-[25px] font-black leading-[1.05] text-white drop-shadow">
            {category.name}
          </span>
          <div className="absolute -right-5 bottom-[-14px] z-0 h-32 w-32 rotate-[25deg] overflow-hidden rounded-[3px] bg-black/20 shadow-2xl transition-transform duration-300 group-hover:rotate-[21deg] group-hover:scale-105">
            <img
              src={category.imageUrl}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20 opacity-80" />
        </Link>
      ))}
    </div>
  )
}
