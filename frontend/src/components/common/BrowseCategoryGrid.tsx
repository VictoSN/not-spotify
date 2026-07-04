import { Link } from 'react-router-dom'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { useTranslation } from '@/i18n/useTranslation'
import type { Genre } from '@/types/genre'
import {
  curatedBrowseCategories,
  browseColorForSlug,
  isVividColor,
  getBrowseCoverUrl,
  type BrowseCategorySeed,
  type BrowseFilter,
} from '@/data/browseContent'

export type { BrowseFilter } from '@/data/browseContent'

type BrowseCategory = BrowseCategorySeed & {
  id: string
  imageUrl: string
  to: string
}

function BrowseGenreArt({ category }: { category: BrowseCategory }) {
  return (
    <div
      className="absolute -right-8 top-5 z-0 h-36 w-32 rotate-[23deg] overflow-hidden rounded-[3px] bg-black/20 shadow-[0_14px_24px_rgba(0,0,0,0.36)] ring-1 ring-white/15 transition-transform duration-300 group-hover:rotate-[20deg] group-hover:scale-105"
      aria-hidden="true"
    >
      <img src={category.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/10" />
      <SpotifyMark className="absolute left-2 top-2 h-3.5 w-3.5 text-white/90 drop-shadow" />
      <p className="absolute bottom-3 left-3 right-2 line-clamp-2 text-[11px] font-black leading-none text-white drop-shadow">
        {category.name}
      </p>
    </div>
  )
}

function buildBrowseCategories(genres: Genre[]): BrowseCategory[] {
  const genreBySlug = new Map(genres.map((genre) => [genre.slug, genre]))
  const usedGenreIds = new Set<string>()

  const curated = curatedBrowseCategories.map((category) => {
    const genre = genreBySlug.get(category.slug)
    if (genre) usedGenreIds.add(genre.id)

    return {
      ...category,
      id: genre?.id ?? `browse-${category.slug}`,
      // Curated colors are hand-picked; only let a backend color override when it
      // is actually vivid, so a dull/gray genre color can't wash out the card.
      color: isVividColor(genre?.color) ? genre!.color : category.color,
      kind: category.kind ?? 'music',
      imageUrl: getBrowseCoverUrl(category.slug, genre?.imageUrl),
      to: category.to ?? (genre ? `/genres/${genre.slug}` : `/genres/${category.slug}`),
    }
  })

  const remainingGenres = genres
    .filter((genre) => !usedGenreIds.has(genre.id))
    .map((genre) => ({
      id: genre.id,
      name: genre.name,
      slug: genre.slug,
      // Keep a vivid backend color; otherwise fall to a stable palette hue so the
      // grid stays colorful instead of a wall of gray.
      color: isVividColor(genre.color) ? genre.color : browseColorForSlug(genre.slug),
      kind: 'music' as const,
      coverUrl: getBrowseCoverUrl(genre.slug, genre.imageUrl),
      imageUrl: getBrowseCoverUrl(genre.slug, genre.imageUrl),
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
