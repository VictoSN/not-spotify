import { create } from 'zustand'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'

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
  createPlaylist: (name: string, description?: string) => Promise<Playlist>
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>
  deletePlaylist: (playlistId: string) => Promise<void>
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
      set({ savedPlaylists: playlists, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  likeTrack: async (track) => {
    const prev = get().likedSongs
    const prevIds = get().likedTrackIds
    set({
      likedSongs: [track, ...prev],
      likedTrackIds: new Set([...prevIds, track.id]),
    })
    // TODO: call trackService.like(track.id) and roll back on failure
  },

  unlikeTrack: async (trackId) => {
    const prev = get().likedSongs
    const prevIds = get().likedTrackIds
    const newIds = new Set(prevIds)
    newIds.delete(trackId)
    set({
      likedSongs: prev.filter((t) => t.id !== trackId),
      likedTrackIds: newIds,
    })
  },

  followArtist: async (artist) => {
    const prev = get().followedArtists
    const prevIds = get().followedArtistIds
    set({
      followedArtists: [artist, ...prev],
      followedArtistIds: new Set([...prevIds, artist.id]),
    })
  },

  unfollowArtist: async (artistId) => {
    const prev = get().followedArtists
    const prevIds = get().followedArtistIds
    const newIds = new Set(prevIds)
    newIds.delete(artistId)
    set({
      followedArtists: prev.filter((a) => a.id !== artistId),
      followedArtistIds: newIds,
    })
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

  createPlaylist: async (name, description) => {
    const playlist = await playlistService.create(name, description)
    set((s) => ({ savedPlaylists: [playlist, ...s.savedPlaylists] }))
    return playlist
  },

  addTrackToPlaylist: async (playlistId, track) => {
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
