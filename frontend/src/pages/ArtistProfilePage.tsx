import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PlayIcon } from '@heroicons/react/24/solid'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import type { Artist } from '@/types/artist'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import { artistService } from '@/services/artistService'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { TrackRow } from '@/components/cards/TrackRow'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/common/SectionHeader'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { formatNumber } from '@/utils/formatNumber'

export function ArtistProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [artist, setArtist] = useState<Artist | null>(null)
  useDocumentTitle(artist?.name ?? null)
  const [topTracks, setTopTracks] = useState<Track[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const playWithGate = usePlaybackGate()
  const { followedArtistIds, followArtist, unfollowArtist } = useLibraryStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)

  useEffect(() => {
    if (!id) return
    Promise.all([artistService.getById(id), artistService.getTopTracks(id, 5), artistService.getAlbums(id)]).then(
      ([a, t, al]) => {
        setArtist(a)
        setTopTracks(t)
        setAlbums(al)
        setLoading(false)
      },
    )
  }, [id])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  if (!artist) return <div className="p-8 text-secondary">Artist not found.</div>

  const isFollowing = followedArtistIds.has(artist.id)
  const toggleFollow = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Follow artists with a free account', imageUrl: artist.imageUrl })
      return
    }
    if (isFollowing) unfollowArtist(artist.id)
    else followArtist(artist)
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative h-72 sm:h-80 overflow-hidden">
        {artist.headerImageUrl ? (
          <img src={artist.headerImageUrl} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-accent-dim to-page" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-page via-page/40 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3 sm:gap-4 sm:bottom-6 sm:left-6 sm:right-6">
          {artist.imageUrl && (
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className="w-16 h-16 sm:w-24 sm:h-24 rounded-full object-cover shadow-2xl border-2 border-elevated flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {artist.verified && <CheckBadgeIcon className="w-5 h-5 text-accent" />}
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Artist</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-primary drop-shadow-lg truncate">{artist.name}</h1>
            <p className="text-secondary text-sm mt-1">{formatNumber(artist.monthlyListeners)} monthly listeners</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 py-4">
        {topTracks.length > 0 && (
          <Button onClick={() => playWithGate(topTracks[0], topTracks)} size="lg" className="gap-2">
            <PlayIcon className="w-5 h-5" /> Play
          </Button>
        )}
        <Button variant={isFollowing ? 'outline' : 'secondary'} onClick={toggleFollow}>
          {isFollowing ? 'Following' : 'Follow'}
        </Button>
      </div>

      {/* Popular tracks */}
      {topTracks.length > 0 && (
        <section className="px-4 mb-8">
          <SectionHeader title="Popular" />
          {topTracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} queue={topTracks} showPlayCount />
          ))}
        </section>
      )}

      {/* Albums */}
      {albums.length > 0 && (
        <section className="px-6 mb-8">
          <SectionHeader title="Discography" />
          <HorizontalScroller>
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </HorizontalScroller>
        </section>
      )}

      {/* Bio */}
      {artist.bio && (
        <section className="px-6 mb-8">
          <SectionHeader title="About" />
          <div className="bg-surface rounded-xl p-6 relative overflow-hidden">
            {artist.headerImageUrl && (
              <img
                src={artist.headerImageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-10"
              />
            )}
            <p className="text-secondary leading-relaxed relative z-10">{artist.bio}</p>
            <p className="text-xs text-muted mt-4 relative z-10">{formatNumber(artist.followerCount)} followers</p>
          </div>
        </section>
      )}
    </div>
  )
}
