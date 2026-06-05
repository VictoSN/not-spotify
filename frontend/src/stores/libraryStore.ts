import { create } from 'zustand'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { trackService } from '@/services/trackService'
import { useAuthStore } from './authStore'

interface LibraryState {
  savedPlaylists: Playlist[]
  likedSongs: Track[]
  followedArtists: Artist[]
  savedAlbums: Album[]
  likedTrackIds: Set<string>
  followedArtistIds: Set<string>
  savedAlbumIds: Set<string>
  isLoading: boolean

  fetchLibrary: () => Promise<void>
  likeTrack: (track: Track) => Promise<void>
  unlikeTrack: (trackId: string) => Promise<void>
  followArtist: (artist: Artist) => Promise<void>
  unfollowArtist: (artistId: string) => Promise<void>
  saveAlbum: (album: Album) => Promise<void>
  unsaveAlbum: (albumId: string) => Promise<void>
  createPlaylist: (name: string, description?: string, isPublic?: boolean) => Promise<Playlist>
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>
  deletePlaylist: (playlistId: string) => Promise<void>
  savePlaylist: (playlist: Playlist) => Promise<void>
  unsavePlaylist: (playlistId: string) => Promise<void>
  setPlaylistVisibility: (playlistId: string, isPublic: boolean) => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  savedPlaylists: [],
  likedSongs: [],
  followedArtists: [],
  savedAlbums: [],
  likedTrackIds: new Set(),
  followedArtistIds: new Set(),
  savedAlbumIds: new Set(),
  isLoading: false,

  fetchLibrary: async () => {
    set({ isLoading: true })
    try {
      const playlists = await playlistService.getUserPlaylists()
      let likedTracks: Track[] = []
      try {
        likedTracks = await trackService.getLikedSongs()
      } catch {
        // If getLikedSongs endpoint doesn't exist, try localStorage as fallback
        const stored = localStorage.getItem('ns-liked-tracks')
        if (stored) {
          try {
            likedTracks = JSON.parse(stored)
          } catch {
            likedTracks = []
          }
        }
      }
      let followedArtists: Artist[] = []
      try {
        const stored = localStorage.getItem('ns-followed-artists')
        if (stored) {
          try {
            followedArtists = JSON.parse(stored)
          } catch {
            followedArtists = []
          }
        }
      } catch {
        followedArtists = []
      }
      const likedIds = new Set(likedTracks.map((t) => t.id))
      const followedIds = new Set(followedArtists.map((a) => a.id))
      set({
        savedPlaylists: playlists,
        likedSongs: likedTracks,
        likedTrackIds: likedIds,
        followedArtists,
        followedArtistIds: followedIds,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  likeTrack: async (track) => {
    const prevIds = get().likedTrackIds
    const newLikedSongs = [track, ...get().likedSongs]
    const newLikedIds = new Set([...prevIds, track.id])
    set({
      likedSongs: newLikedSongs,
      likedTrackIds: newLikedIds,
    })
    localStorage.setItem('ns-liked-tracks', JSON.stringify(newLikedSongs))
    trackService.like(track.id).catch(() => {
      // Silently ignore errors - the UI update stays in place
    })
  },

  unlikeTrack: async (trackId) => {
    const prevIds = get().likedTrackIds
    const newIds = new Set(prevIds)
    newIds.delete(trackId)
    const newLikedSongs = get().likedSongs.filter((t) => t.id !== trackId)
    set({
      likedSongs: newLikedSongs,
      likedTrackIds: newIds,
    })
    localStorage.setItem('ns-liked-tracks', JSON.stringify(newLikedSongs))
    trackService.unlike(trackId).catch(() => {
      // Silently ignore errors - the UI update stays in place
    })
  },

  followArtist: async (artist) => {
    const prev = get().followedArtists
    const prevIds = get().followedArtistIds
    const newArtists = [artist, ...prev]
    const newIds = new Set([...prevIds, artist.id])
    set({
      followedArtists: newArtists,
      followedArtistIds: newIds,
    })
    localStorage.setItem('ns-followed-artists', JSON.stringify(newArtists))
  },

  unfollowArtist: async (artistId) => {
    const prev = get().followedArtists
    const prevIds = get().followedArtistIds
    const newIds = new Set(prevIds)
    newIds.delete(artistId)
    const newArtists = prev.filter((a) => a.id !== artistId)
    set({
      followedArtists: newArtists,
      followedArtistIds: newIds,
    })
    localStorage.setItem('ns-followed-artists', JSON.stringify(newArtists))
  },

  saveAlbum: async (album) => {
    const prev = get().savedAlbums
    const prevIds = get().savedAlbumIds
    set({
      savedAlbums: [album, ...prev],
      savedAlbumIds: new Set([...prevIds, album.id]),
    })
  },

  unsaveAlbum: async (albumId) => {
    const prev = get().savedAlbums
    const prevIds = get().savedAlbumIds
    const newIds = new Set(prevIds)
    newIds.delete(albumId)
    set({
      savedAlbums: prev.filter((a) => a.id !== albumId),
      savedAlbumIds: newIds,
    })
  },

  createPlaylist: async (name, description, isPublic = true) => {
    const playlist = await playlistService.create(name, description, isPublic)
    set((s) => ({ savedPlaylists: [playlist, ...s.savedPlaylists] }))
    return playlist
  },

  savePlaylist: async (playlist) => {
    await playlistService.save(playlist.id)
    set((s) => ({
      savedPlaylists: [
        { ...playlist, isSaved: true, isOwner: false },
        ...s.savedPlaylists.filter((p) => p.id !== playlist.id),
      ],
    }))
  },

  unsavePlaylist: async (playlistId) => {
    await playlistService.unsave(playlistId)
    set((s) => ({ savedPlaylists: s.savedPlaylists.filter((p) => p.id !== playlistId) }))
  },

  setPlaylistVisibility: async (playlistId, isPublic) => {
    await playlistService.updateVisibility(playlistId, isPublic)
    set((s) => ({
      savedPlaylists: s.savedPlaylists.map((p) => (p.id === playlistId ? { ...p, isPublic } : p)),
    }))
  },

  addTrackToPlaylist: async (playlistId, track) => {
    try {
      await playlistService.addTrack(playlistId, track)
      set((s) => ({
        savedPlaylists: s.savedPlaylists.map((p) => {
          if (p.id !== playlistId) return p
          return {
            ...p,
            tracks: [...p.tracks, { track, addedAt: new Date().toISOString(), addedBy: p.owner }],
            totalDurationMs: p.totalDurationMs + track.durationMs,
          }
        }),
      }))
    } catch (error) {
      console.error('Failed to add track to playlist:', error)
      throw error
    }
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    await playlistService.removeTrack(playlistId, trackId)
    set((s) => ({
      savedPlaylists: s.savedPlaylists.map((p) => {
        if (p.id !== playlistId) return p
        const removed = p.tracks.find((pt) => pt.track.id === trackId)
        return {
          ...p,
          tracks: p.tracks.filter((pt) => pt.track.id !== trackId),
          totalDurationMs: p.totalDurationMs - (removed?.track.durationMs ?? 0),
        }
      }),
    }))
  },

  deletePlaylist: async (playlistId) => {
    await playlistService.delete(playlistId)
    set((s) => ({ savedPlaylists: s.savedPlaylists.filter((p) => p.id !== playlistId) }))
  },
}))

// Clear the personal library the moment the user logs out — no refresh needed.
// Only fire on the authenticated → unauthenticated transition (not during the
// initial hydration window), and also drop the localStorage caches so likes/follows
// can't survive logout or leak into the next session.
useAuthStore.subscribe((state, prev) => {
  if (!prev.isAuthenticated || state.isAuthenticated) return
  try {
    localStorage.removeItem('ns-liked-tracks')
    localStorage.removeItem('ns-followed-artists')
  } catch {
    /* ignore */
  }
  useLibraryStore.setState({
    savedPlaylists: [],
    likedSongs: [],
    followedArtists: [],
    savedAlbums: [],
    likedTrackIds: new Set(),
    followedArtistIds: new Set(),
    savedAlbumIds: new Set(),
    isLoading: false,
  })
})
