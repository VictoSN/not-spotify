import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Genre } from '@/types/genre'
import { genreService } from '@/services/genreService'
import { Spinner } from '@/components/ui/Spinner'

export function GenreBrowsePage() {
  const [genres, setGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    genreService.getAll().then((g) => { setGenres(g); setLoading(false) })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="px-6 py-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Browse all genres</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {genres.map((genre) => (
          <Link
            key={genre.id}
            to={`/genres/${genre.slug}`}
            className="relative h-32 rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            style={{ backgroundColor: genre.color }}
          >
            {genre.imageUrl && (
              <img
                src={genre.imageUrl}
                alt={genre.name}
                className="absolute bottom-0 right-0 w-20 h-20 object-cover rounded-tl-lg opacity-80 rotate-[15deg] translate-x-3 translate-y-2"
              />
            )}
            <span className="absolute top-4 left-4 text-white font-black text-xl drop-shadow">{genre.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
