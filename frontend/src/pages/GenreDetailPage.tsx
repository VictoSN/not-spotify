import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Genre } from '@/types/genre'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import { genreService } from '@/services/genreService'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { TrackTile } from '@/components/cards/TrackTile'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { Spinner } from '@/components/ui/Spinner'

export function GenreDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [genre, setGenre] = useState<Genre | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    Promise.all([
      genreService.getBySlug(slug),
      genreService.getPlaylistsByGenre(slug),
      genreService.getTracksByGenre(slug),
    ]).then(([g, p, t]) => {
      setGenre(g)
      setPlaylists(p)
      setTracks(t)
      setLoading(false)
    }).catch(() => {
      setGenre(null)
      setPlaylists([])
      setTracks([])
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
        {playlists.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-primary">Popular playlists</h2>
            <div className="flex flex-wrap gap-4">
              {playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
          </section>
        )}

        {tracks.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-primary">Popular tracks</h2>
            <HorizontalScroller>
              {tracks.map((track) => (
                <TrackTile key={track.id} track={track} queue={tracks} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {playlists.length === 0 && tracks.length === 0 && (
          <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">
            Nothing has been tagged with {genre.name} yet.
          </div>
        )}
      </div>
    </div>
  )
}
