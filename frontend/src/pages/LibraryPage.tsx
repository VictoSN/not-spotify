import { useEffect, useState } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { TrackCard } from '@/components/cards/TrackCard'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PlusIcon } from '@heroicons/react/24/outline'

type Filter = 'playlists' | 'albums' | 'artists' | 'liked'

export function LibraryPage() {
  const { savedPlaylists, savedAlbums, followedArtists, likedSongs, isLoading, fetchLibrary, createPlaylist } = useLibraryStore()
  const [filter, setFilter] = useState<Filter>('playlists')

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'playlists', label: 'Playlists', count: savedPlaylists.length },
    { key: 'albums', label: 'Albums', count: savedAlbums.length },
    { key: 'artists', label: 'Artists', count: followedArtists.length },
    { key: 'liked', label: 'Liked songs', count: likedSongs.length },
  ]

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-primary">Your Library</h1>
        <Button size="icon" variant="ghost" onClick={() => createPlaylist(`New Playlist`)} aria-label="Create playlist">
          <PlusIcon className="w-5 h-5" />
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === key ? 'bg-primary text-page' : 'bg-elevated text-secondary hover:text-primary'
            }`}
          >
            {label}
            {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {filter === 'playlists' && (
        savedPlaylists.length === 0 ? (
          <EmptyState
            title="No playlists yet"
            description="Create your first playlist and start adding songs."
            action={
              <Button onClick={() => createPlaylist('My Playlist')} className="gap-2">
                <PlusIcon className="w-4 h-4" /> Create playlist
              </Button>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-4">
            {savedPlaylists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
          </div>
        )
      )}

      {filter === 'albums' && (
        savedAlbums.length === 0 ? (
          <EmptyState title="No saved albums" description="Save albums to find them here later." />
        ) : (
          <div className="flex flex-wrap gap-4">
            {savedAlbums.map((a) => <AlbumCard key={a.id} album={a} />)}
          </div>
        )
      )}

      {filter === 'artists' && (
        followedArtists.length === 0 ? (
          <EmptyState title="No followed artists" description="Follow your favourite artists to find them here." />
        ) : (
          <div className="flex flex-wrap gap-4">
            {followedArtists.map((a) => <ArtistCard key={a.id} artist={a} />)}
          </div>
        )
      )}

      {filter === 'liked' && (
        likedSongs.length === 0 ? (
          <EmptyState title="No liked songs" description="Like songs to add them to this list." />
        ) : (
          <div className="flex flex-col gap-1">
            {likedSongs.map((track) => <TrackCard key={track.id} track={track} queue={likedSongs} />)}
          </div>
        )
      )}
    </div>
  )
}
