import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { TrackRow } from '@/components/cards/TrackRow'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PlusIcon, PlayIcon, ClockIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'

type Filter = 'playlists' | 'albums' | 'artists' | 'liked'
type SortKey = 'recent' | 'az' | 'za'

/** 'recent' keeps API order (most recently added/updated first). */
function sortBy<T>(items: T[], sort: SortKey, name: (item: T) => string): T[] {
  if (sort === 'recent') return items
  return [...items].sort((a, b) =>
    sort === 'az' ? name(a).localeCompare(name(b)) : name(b).localeCompare(name(a)),
  )
}

export function LibraryPage() {
  useDocumentTitle('Your Library')
  const isMobile = useIsMobile()
  const { savedPlaylists, savedAlbums, followedArtists, likedSongs, likedAtMap, isLoading, fetchLibrary, createPlaylist } =
    useLibraryStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const playWithGate = usePlaybackGate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') as Filter | null
  const filter: Filter = tab && ['playlists', 'albums', 'artists', 'liked'].includes(tab) ? tab : 'playlists'
  const setFilter = (f: Filter) => setSearchParams(f === 'playlists' ? {} : { tab: f })
  const [sort, setSort] = useState<SortKey>('recent')

  const sortedPlaylists = sortBy(savedPlaylists, sort, (p) => p.name)
  const sortedAlbums = sortBy(savedAlbums, sort, (a) => a.title)
  const sortedArtists = sortBy(followedArtists, sort, (a) => a.name)
  const sortedLiked = sortBy(likedSongs, sort, (t) => t.title)

  useEffect(() => {
    if (!isAuthenticated) return
    fetchLibrary()
  }, [fetchLibrary, isAuthenticated])

  const handleCreatePlaylist = () => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Create playlists with a free account' })
      return
    }
    createPlaylist('New Playlist')
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'playlists', label: 'Playlists', count: savedPlaylists.length },
    { key: 'albums', label: 'Albums', count: savedAlbums.length },
    { key: 'artists', label: 'Artists', count: followedArtists.length },
    { key: 'liked', label: 'Liked songs', count: likedSongs.length },
  ]

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-primary">Your Library</h1>
        <Button size="icon" variant="ghost" onClick={handleCreatePlaylist} aria-label="Create playlist">
          <PlusIcon className="w-5 h-5" />
        </Button>
      </div>

      {/* Filter chips + sort */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
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
        <select
          aria-label="Sort library"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="ml-auto rounded-md border border-secondary/20 bg-elevated px-3 py-1.5 text-sm font-medium text-primary outline-none transition-colors hover:border-secondary/40 focus:border-accent"
        >
          <option value="recent">Recently added</option>
          <option value="az">A to Z</option>
          <option value="za">Z to A</option>
        </select>
      </div>

      {/* Content */}
      {filter === 'playlists' &&
        (savedPlaylists.length === 0 ? (
          <EmptyState
            title="No playlists yet"
            description="Create your first playlist and start adding songs."
            action={
              <Button onClick={handleCreatePlaylist} className="gap-2">
                <PlusIcon className="w-4 h-4" /> Create playlist
              </Button>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-4">
            {sortedPlaylists.map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </div>
        ))}

      {filter === 'albums' &&
        (savedAlbums.length === 0 ? (
          <EmptyState title="No saved albums" description="Save albums to find them here later." />
        ) : (
          <div className="flex flex-wrap gap-4">
            {sortedAlbums.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </div>
        ))}

      {filter === 'artists' &&
        (followedArtists.length === 0 ? (
          <EmptyState title="No followed artists" description="Follow your favourite artists to find them here." />
        ) : (
          <div className="flex flex-wrap gap-4">
            {sortedArtists.map((a) => (
              <ArtistCard key={a.id} artist={a} />
            ))}
          </div>
        ))}

      {filter === 'liked' &&
        (likedSongs.length === 0 ? (
          <EmptyState title="No liked songs" description="Like songs to add them to this list." />
        ) : (
          <div>
            {/* Playlist-style header */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 pb-4 sm:pb-6 bg-gradient-to-b from-accent-dim/40 to-transparent rounded-lg mb-4 p-4">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-md shadow-2xl flex-shrink-0 bg-accent/20 flex items-center justify-center self-center sm:self-auto">
                <HeartSolid className="w-12 h-12 sm:w-16 sm:h-16 text-accent" />
              </div>
              <div className="min-w-0 pb-1 text-center sm:text-left">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Playlist</p>
                <h2 className="text-3xl sm:text-4xl font-black text-primary mt-1 mb-2">Liked Songs</h2>
                <p className="text-xs text-secondary">{likedSongs.length} songs</p>
              </div>
            </div>

            {/* Play button */}
            <div className="flex items-center gap-4 mb-4">
              <Button
                onClick={() => playWithGate(likedSongs[0], likedSongs)}
                size="lg"
                className="gap-2"
              >
                <PlayIcon className="w-5 h-5" />
                Play
              </Button>
            </div>

            {/* Column headers */}
            <div
              className="grid items-center gap-4 px-4 py-2 border-b border-elevated/30 mb-2"
              style={{ gridTemplateColumns: isMobile ? '16px 1fr var(--track-actions-width)' : '16px 6fr 4fr 3fr var(--track-actions-width)' }}
            >
              <span className="text-xs text-secondary">#</span>
              <span className="text-xs text-secondary uppercase tracking-wider">Title</span>
              <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">Album</span>
              <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">Date added</span>
              <div className="grid grid-cols-[32px_50px_32px] sm:grid-cols-[80px_32px_50px_32px] items-center gap-1.5 sm:gap-2 justify-end w-[114px] sm:w-[194px] ml-auto">
                <span className="hidden sm:block" />
                <span />
                <span className="flex justify-end pr-1">
                  <ClockIcon className="w-4 h-4 text-secondary" />
                </span>
                <span />
              </div>
            </div>

            {sortedLiked.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                queue={sortedLiked}
                showAlbum
                addedAt={likedAtMap[track.id]}
              />
            ))}
          </div>
        ))}
    </div>
  )
}
