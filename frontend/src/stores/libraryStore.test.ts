import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Artist } from '@/types/artist'
import type { Playlist, PlaylistTrack } from '@/types/playlist'

// Hoisted mock — factory must be self-contained (no outer variables).
vi.mock('@/services/artistService', () => ({
  artistService: {
    follow: vi.fn(),
    unfollow: vi.fn(),
    getFollowing: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    getTopTracks: vi.fn(),
    getAlbums: vi.fn(),
    getRelated: vi.fn(),
    search: vi.fn(),
    getFeatured: vi.fn(),
    getPopular: vi.fn(),
  },
}))

// fetchLibrary also pulls playlists / liked songs / saved albums.
vi.mock('@/services/playlistService', () => ({
  playlistService: { getUserPlaylists: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/services/trackService', () => ({
  trackService: { getLikedSongs: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/services/albumService', () => ({
  albumService: { getSavedAlbums: vi.fn().mockResolvedValue([]) },
}))

import { useLibraryStore } from './libraryStore'
import { useAuthStore } from './authStore'
import { artistService } from '@/services/artistService'

const artist = (id: string, name = id): Artist => ({ id, name }) as Artist

beforeEach(() => {
  window.localStorage.clear()
  vi.clearAllMocks()
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
  // Default: unauthenticated (guest).
  useAuthStore.setState({ isAuthenticated: false, user: null })
})

// ── Guest (no backend) ──────────────────────────────────────────────────────

describe('libraryStore follows (guest / localStorage-backed, no backend)', () => {
  it('followArtist adds to state + id set and persists', async () => {
    await useLibraryStore.getState().followArtist(artist('a1', 'Artist One'))
    const s = useLibraryStore.getState()
    expect(s.followedArtists.map((a) => a.id)).toEqual(['a1'])
    expect(s.followedArtistIds.has('a1')).toBe(true)
    expect(JSON.parse(localStorage.getItem('ns-followed-artists')!)).toHaveLength(1)
    // Guest → must NOT call the API.
    expect(artistService.follow).not.toHaveBeenCalled()
  })

  it('most-recently followed artist sits first', async () => {
    await useLibraryStore.getState().followArtist(artist('a1'))
    await useLibraryStore.getState().followArtist(artist('a2'))
    expect(useLibraryStore.getState().followedArtists.map((a) => a.id)).toEqual(['a2', 'a1'])
    expect(artistService.follow).not.toHaveBeenCalled()
  })

  it('unfollowArtist removes from state + id set and updates storage', async () => {
    await useLibraryStore.getState().followArtist(artist('a1'))
    await useLibraryStore.getState().followArtist(artist('a2'))
    await useLibraryStore.getState().unfollowArtist('a1')
    const s = useLibraryStore.getState()
    expect(s.followedArtists.map((a) => a.id)).toEqual(['a2'])
    expect(s.followedArtistIds.has('a1')).toBe(false)
    expect(JSON.parse(localStorage.getItem('ns-followed-artists')!).map((a: Artist) => a.id)).toEqual(['a2'])
    expect(artistService.unfollow).not.toHaveBeenCalled()
  })
})

// ── Authenticated (API success / failure) ────────────────────────────────────

describe('libraryStore follows (authenticated, API-backed)', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1' } as never })
  })

  it('followArtist calls the API and persists on success', async () => {
    vi.mocked(artistService.follow).mockResolvedValueOnce(undefined)
    await useLibraryStore.getState().followArtist(artist('a1'))
    const s = useLibraryStore.getState()
    expect(s.followedArtistIds.has('a1')).toBe(true)
    expect(artistService.follow).toHaveBeenCalledWith('a1')
  })

  it('followArtist calls the API and reverts on failure', async () => {
    vi.mocked(artistService.follow).mockRejectedValueOnce(new Error('Network error'))
    await useLibraryStore.getState().followArtist(artist('a1'))
    const s = useLibraryStore.getState()
    // State should be rolled back after the API fails.
    expect(s.followedArtists).toEqual([])
    expect(s.followedArtistIds.has('a1')).toBe(false)
    expect(artistService.follow).toHaveBeenCalledWith('a1')
  })

  it('unfollowArtist calls the API and persists on success', async () => {
    // First follow (needs API call to succeed so state sticks).
    vi.mocked(artistService.follow).mockResolvedValueOnce(undefined)
    await useLibraryStore.getState().followArtist(artist('a1'))
    expect(useLibraryStore.getState().followedArtistIds.has('a1')).toBe(true)

    vi.mocked(artistService.unfollow).mockResolvedValueOnce(undefined)
    await useLibraryStore.getState().unfollowArtist('a1')
    const s = useLibraryStore.getState()
    expect(s.followedArtistIds.has('a1')).toBe(false)
    expect(artistService.unfollow).toHaveBeenCalledWith('a1')
  })

  it('unfollowArtist calls the API and reverts on failure', async () => {
    // First follow.
    vi.mocked(artistService.follow).mockResolvedValueOnce(undefined)
    await useLibraryStore.getState().followArtist(artist('a1'))
    expect(useLibraryStore.getState().followedArtistIds.has('a1')).toBe(true)

    vi.mocked(artistService.unfollow).mockRejectedValueOnce(new Error('Network error'))
    await useLibraryStore.getState().unfollowArtist('a1')
    const s = useLibraryStore.getState()
    // State should be rolled back — artist should still be followed.
    expect(s.followedArtistIds.has('a1')).toBe(true)
    expect(artistService.unfollow).toHaveBeenCalledWith('a1')
  })
})

// ── Other existing tests ─────────────────────────────────────────────────────

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

describe('libraryStore.fetchLibrary follow hydration (per-user)', () => {
  it('unions locally-cached follows with the backend list so account-less artist follows survive reload', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1' } as never })
    // a-local was followed before but has no linked user account → the backend
    // GET never returns it; only the per-user cache remembers it.
    localStorage.setItem('ns-followed-artists:u1', JSON.stringify([artist('a-local', 'Local Only')]))
    vi.mocked(artistService.getFollowing).mockResolvedValueOnce([artist('a-backend', 'Backend Artist')])

    await useLibraryStore.getState().fetchLibrary()

    const ids = useLibraryStore.getState().followedArtists.map((a) => a.id).sort()
    expect(ids).toEqual(['a-backend', 'a-local'])
    expect(useLibraryStore.getState().followedArtistIds.has('a-local')).toBe(true)
  })

  it('does not leak another account\'s cached follows (cache is keyed per user)', async () => {
    // u1 has a cached follow…
    localStorage.setItem('ns-followed-artists:u1', JSON.stringify([artist('a-u1')]))
    // …but u2 signs in and the backend returns nobody.
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'u2' } as never })
    vi.mocked(artistService.getFollowing).mockResolvedValueOnce([])

    await useLibraryStore.getState().fetchLibrary()

    expect(useLibraryStore.getState().followedArtists).toEqual([])
  })
})

describe('libraryStore logout reset', () => {
  it('clears volatile state but keeps the user\'s own followed-artists cache, and drops the legacy global key', async () => {
    // Follow while signed in as u1 → persists under the per-user key.
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1' } as never })
    vi.mocked(artistService.follow).mockResolvedValueOnce(undefined)
    await useLibraryStore.getState().followArtist(artist('a1'))
    expect(localStorage.getItem('ns-followed-artists:u1')).not.toBeNull()
    // Simulate a stale global key left over from a previous app version.
    localStorage.setItem('ns-followed-artists', JSON.stringify([artist('leaked')]))

    useAuthStore.setState({ isAuthenticated: false } as never)

    expect(useLibraryStore.getState().followedArtists).toEqual([])
    expect(useLibraryStore.getState().likedSongs).toEqual([])
    expect(useLibraryStore.getState().followedArtistIds.size).toBe(0)
    // The user's own cache survives logout (so their next sign-in restores it)…
    expect(JSON.parse(localStorage.getItem('ns-followed-artists:u1')!).map((a: Artist) => a.id)).toEqual(['a1'])
    // …but the legacy global key is purged so it can't leak into the next account.
    expect(localStorage.getItem('ns-followed-artists')).toBeNull()
  })
})
