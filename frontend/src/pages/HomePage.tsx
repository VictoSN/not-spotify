import { useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import type { Playlist } from '@/types/playlist'
import type { Album } from '@/types/album'
import { trackService } from '@/services/trackService'
import { playlistService } from '@/services/playlistService'
import { albumService } from '@/services/albumService'
import { useAuthStore } from '@/stores/authStore'
import { usePlayerStore } from '@/stores/playerStore'
import { SectionHeader } from '@/components/common/SectionHeader'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { TrackCard } from '@/components/cards/TrackCard'
import { Spinner } from '@/components/ui/Spinner'

export function HomePage() {
  const { user } = useAuthStore()
  const { play } = usePlayerStore()
  const [trending, setTrending] = useState<Track[]>([])
  const [featured, setFeatured] = useState<Playlist[]>([])
  const [newReleases, setNewReleases] = useState<Album[]>([])
  const [recommended, setRecommended] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      trackService.getTrending(10),
      playlistService.getFeatured(6),
      albumService.getNewReleases(6),
      trackService.getRecommended(10),
    ]).then(([tr, fe, nr, rec]) => {
      setTrending(tr)
      setFeatured(fe)
      setNewReleases(nr)
      setRecommended(rec)
      setLoading(false)
    })
  }, [])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="px-6 py-6">
      <h1 className="text-3xl font-bold text-primary mb-6">
        {getGreeting()}{user ? `, ${user.name.split(' ')[0]}` : ''}
      </h1>

      {/* Quick access: recently played playlists in a grid */}
      {featured.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {featured.slice(0, 6).map((p) => (
            <button
              key={p.id}
              onClick={() => { const tracks = p.tracks.map((pt) => pt.track); if (tracks.length) play(tracks[0], tracks) }}
              className="flex items-center gap-3 bg-elevated/60 hover:bg-elevated rounded-md overflow-hidden text-left group transition-colors"
            >
              {p.coverUrl && (
                <img src={p.coverUrl} alt={p.name} className="w-14 h-14 object-cover flex-shrink-0" />
              )}
              <span className="text-sm font-semibold text-primary truncate pr-2">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Recommended */}
      <section className="mb-8">
        <SectionHeader title="Recommended for you" />
        <HorizontalScroller>
          {recommended.map((track) => (
            <div key={track.id} className="flex-shrink-0 w-36 sm:w-40">
              <div
                className="group relative aspect-square rounded-md overflow-hidden bg-elevated mb-2 cursor-pointer"
                onClick={() => play(track, recommended)}
              >
                <img src={track.album.coverUrl} alt={track.album.title} className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-semibold text-primary truncate">{track.title}</p>
              <p className="text-xs text-secondary truncate">{track.artist.name}</p>
            </div>
          ))}
        </HorizontalScroller>
      </section>

      {/* Trending */}
      <section className="mb-8">
        <SectionHeader title="Trending now" />
        <div className="flex flex-col gap-1">
          {trending.slice(0, 8).map((track) => (
            <TrackCard key={track.id} track={track} queue={trending} />
          ))}
        </div>
      </section>

      {/* Featured Playlists */}
      <section className="mb-8">
        <SectionHeader title="Featured playlists" href="/library" />
        <HorizontalScroller>
          {featured.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </HorizontalScroller>
      </section>

      {/* New Releases */}
      <section className="mb-8">
        <SectionHeader title="New releases" />
        <HorizontalScroller>
          {newReleases.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </HorizontalScroller>
      </section>
    </div>
  )
}
