import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Genre } from '@/types/genre'
import type { Playlist } from '@/types/playlist'
import { genreService } from '@/services/genreService'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { Spinner } from '@/components/ui/Spinner'

export function GenreDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [genre, setGenre] = useState<Genre | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    Promise.all([genreService.getBySlug(slug), genreService.getPlaylistsByGenre(slug)]).then(([g, p]) => {
      setGenre(g)
      setPlaylists(p)
      setLoading(false)
    })
  }, [slug])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (!genre) return <div className="p-8 text-secondary">Genre not found.</div>

  return (
    <div>
      <div className="h-40 flex items-end px-6 pb-6" style={{ backgroundColor: genre.color }}>
        <h1 className="text-5xl font-black text-white drop-shadow-lg">{genre.name}</h1>
      </div>
      <div className="px-6 py-6">
        <h2 className="text-xl font-bold text-primary mb-4">Popular playlists</h2>
        <div className="flex flex-wrap gap-4">
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      </div>
    </div>
  )
}
