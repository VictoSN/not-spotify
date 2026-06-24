import { Link } from 'react-router-dom'
import { useTranslation } from '@/i18n/useTranslation'
import type { Genre } from '@/types/genre'
import {
  Activity,
  BarChart3,
  Bed,
  BookOpen,
  Calendar,
  ChartNoAxesCombined,
  Clapperboard,
  Coffee,
  Disc3,
  Dumbbell,
  FileText,
  Flame,
  GraduationCap,
  Guitar,
  Headphones,
  Heart,
  Laugh,
  Mic2,
  Music,
  PartyPopper,
  Podcast,
  Radio,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'

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

type BrowseIcon = typeof Music

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

const browseIconBySlug: Record<string, BrowseIcon> = {
  music: Music,
  podcasts: Podcast,
  'live-events': Calendar,
  fitness: Dumbbell,
  'made-for-you': Sparkles,
  'new-releases': Disc3,
  mandopop: Mic2,
  pop: Star,
  'k-pop': Mic2,
  'hip-hop': Radio,
  charts: ChartNoAxesCombined,
  'podcast-charts': BarChart3,
  educational: GraduationCap,
  documentary: FileText,
  comedy: Laugh,
  'j-tracks': Headphones,
  indie: Guitar,
  electronic: Zap,
  mood: Activity,
  discover: Sparkles,
  sleep: Bed,
  chill: Coffee,
  love: Heart,
  radar: Radio,
  rnb: Music,
  workout: Dumbbell,
  soundtracks: Clapperboard,
  party: PartyPopper,
  rock: Guitar,
  latin: Flame,
  country: Guitar,
  'at-home': Coffee,
  decades: Disc3,
  metal: Zap,
  jazz: Music,
  classical: Music,
}

function getBrowseIcon(category: BrowseCategory): BrowseIcon {
  const key = category.name.toLowerCase()
  if (browseIconBySlug[category.slug]) return browseIconBySlug[category.slug]
  if (category.kind === 'podcasts' || key.includes('podcast')) return Podcast
  if (key.includes('chart')) return BarChart3
  if (key.includes('workout') || key.includes('fitness')) return Dumbbell
  if (key.includes('sleep')) return Bed
  if (key.includes('love')) return Heart
  if (key.includes('rock') || key.includes('country')) return Guitar
  if (key.includes('education')) return BookOpen
  if (key.includes('party')) return PartyPopper
  return Music
}

function BrowseGenreArt({ category }: { category: BrowseCategory }) {
  const Icon = getBrowseIcon(category)
  const label = category.name.replace(/\s*\/\s*/g, ' / ').toUpperCase()

  return (
    <div
      className="absolute -right-8 top-4 z-0 h-36 w-32 rotate-[23deg] overflow-hidden rounded-[3px] bg-white/10 shadow-[0_14px_24px_rgba(0,0,0,0.36)] ring-1 ring-white/15 transition-transform duration-300 group-hover:rotate-[20deg] group-hover:scale-105"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(138deg, rgba(255,255,255,0.20), rgba(0,0,0,0.46)), ${category.color}`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25" />
      <Icon className="absolute left-1/2 top-8 h-14 w-14 -translate-x-1/2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]" strokeWidth={3.2} />
      <div className="absolute bottom-7 left-6 right-5 space-y-1.5">
        <div className="h-[5px] w-16 rounded-full bg-white/85" />
        <div className="h-[5px] w-12 rounded-full bg-white/72" />
        <div className="h-[5px] w-8 rounded-full bg-white/58" />
      </div>
      <div className="absolute bottom-3 left-5 right-4">
        <p className="truncate text-[9px] font-black uppercase leading-none tracking-[0.02em] text-white drop-shadow">
          {label}
        </p>
      </div>
    </div>
  )
}

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          to={category.to}
          className="group relative isolate h-[152px] overflow-hidden rounded-md p-4 shadow-sm outline-none transition-transform duration-200 hover:scale-[1.018] focus-visible:ring-2 focus-visible:ring-white/70"
          style={{ backgroundColor: category.color }}
        >
          <span className="relative z-10 block max-w-[70%] text-[25px] font-black leading-[1.05] text-white drop-shadow">
            {category.name}
          </span>
          <BrowseGenreArt category={category} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20 opacity-80" />
        </Link>
      ))}
    </div>
  )
}
