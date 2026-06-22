import { describe, it, expect, beforeEach } from 'vitest'
import { useLibraryStore } from './libraryStore'
import { useAuthStore } from './authStore'
import type { Artist } from '@/types/artist'
import type { Playlist, PlaylistTrack } from '@/types/playlist'

const artist = (id: string, name = id): Artist => ({ id, name }) as Artist

beforeEach(() => {
  window.localStorage.clear()
  useLibraryStore.setState({
    savedPlaylists: [],
    likedSongs: [],
    likedAtMap: {},
    followedArtists: [],
    savedAlbums: [],
    likedTrackIds: new Set(),
    followedArtistIds: new Set(),
    savedAlbumIds: new Set(),
    isLoading: false,
  })
})

describe('libraryStore follows (localStorage-backed, no backend)', () => {
  it('followArtist adds to state + id set and persists', async () => {
    await useLibraryStore.getState().followArtist(artist('a1', 'Artist One'))
    const s = useLibraryStore.getState()
    expect(s.followedArtists.map((a) => a.id)).toEqual(['a1'])
    expect(s.followedArtistIds.has('a1')).toBe(true)
    expect(JSON.parse(localStorage.getItem('ns-followed-artists')!)).toHaveLength(1)
  })

  it('most-recently followed artist sits first', async () => {
    await useLibraryStore.getState().followArtist(artist('a1'))
    await useLibraryStore.getState().followArtist(artist('a2'))
    expect(useLibraryStore.getState().followedArtists.map((a) => a.id)).toEqual(['a2', 'a1'])
  })

  it('unfollowArtist removes from state + id set and updates storage', async () => {
    await useLibraryStore.getState().followArtist(artist('a1'))
    await useLibraryStore.getState().followArtist(artist('a2'))
    await useLibraryStore.getState().unfollowArtist('a1')
    const s = useLibraryStore.getState()
    expect(s.followedArtists.map((a) => a.id)).toEqual(['a2'])
    expect(s.followedArtistIds.has('a1')).toBe(false)
    expect(JSON.parse(localStorage.getItem('ns-followed-artists')!).map((a: Artist) => a.id)).toEqual(['a2'])
  })
})

describe('libraryStore.syncPlaylistTracks', () => {
  it('replaces tracks for only the matching playlist', () => {
    useLibraryStore.setState({
      savedPlaylists: [
        { id: 'p1', tracks: [] } as unknown as Playlist,
        { id: 'p2', tracks: [] } as unknown as Playlist,
      ],
    })
    const newTracks = [
      { track: { id: 't1', durationMs: 1000 }, addedAt: 'x', addedBy: null },
    ] as unknown as PlaylistTrack[]

    useLibraryStore.getState().syncPlaylistTracks('p1', newTracks)

    const p1 = useLibraryStore.getState().savedPlaylists.find((p) => p.id === 'p1')!
    const p2 = useLibraryStore.getState().savedPlaylists.find((p) => p.id === 'p2')!
    expect(p1.tracks).toHaveLength(1)
    expect(p2.tracks).toHaveLength(0)
  })
})

describe('libraryStore logout reset', () => {
  it('clears the library and drops localStorage caches on logout', async () => {
    await useLibraryStore.getState().followArtist(artist('a1'))
    expect(localStorage.getItem('ns-followed-artists')).not.toBeNull()

    useAuthStore.setState({ isAuthenticated: true } as never)
    useAuthStore.setState({ isAuthenticated: false } as never)

    expect(useLibraryStore.getState().followedArtists).toEqual([])
    expect(useLibraryStore.getState().likedSongs).toEqual([])
    expect(useLibraryStore.getState().followedArtistIds.size).toBe(0)
    expect(localStorage.getItem('ns-followed-artists')).toBeNull()
  })
})
