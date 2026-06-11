import { useEffect, useState } from 'react'
import type { Genre } from '@/types/genre'
import { genreService } from '@/services/genreService'
import { Spinner } from '@/components/ui/Spinner'
import { BrowseCategoryGrid, BrowseFilterPills, type BrowseFilter } from '@/components/common/BrowseCategoryGrid'

export function GenreBrowsePage() {
  const [genres, setGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(true)
  const [browseFilter, setBrowseFilter] = useState<BrowseFilter>('all')

  useEffect(() => {
    genreService.getAll().then((g) => { setGenres(g); setLoading(false) })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <div className="sticky top-0 z-20 -mx-4 mb-4 bg-page/95 px-4 py-3 backdrop-blur-xl md:-mx-6 md:px-6">
        <BrowseFilterPills value={browseFilter} onChange={setBrowseFilter} />
      </div>
      <h1 className="mb-4 text-2xl font-black text-primary">Browse all</h1>
      <BrowseCategoryGrid genres={genres} filter={browseFilter} />
    </div>
  )
}
