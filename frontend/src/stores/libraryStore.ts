import { create } from 'zustand'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'
import type { Playlist, PlaylistTrack, PlaylistVisibility, SmartPlaylistRules } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { trackService } from '@/services/trackService'
import { albumService } from '@/services/albumService'
import { artistService } from '@/services/artistService'
import { useAuthStore } from './authStore'

interface LibraryState {
  savedPlaylists: Playlist[]
  likedSongs: Track[]
  likedAtMap: Record<string, string>
  followedArtists: Artist[]
  savedAlbums: Album[]
  savedVideos: MusicVideo[]
  savedPodcasts: PodcastSummary[]
  likedTrackIds: Set<string>
  followedArtistIds: Set<string>
  savedAlbumIds: Set<string>
  savedVideoIds: Set<string>
  savedPodcastIds: Set<string>
  isLoading: boolean

  fetchLibrary: () => Promise<void>
  likeTrack: (track: Track) => Promise<void>
  unlikeTrack: (trackId: string) => Promise<void>
  followArtist: (artist: Artist) => Promise<void>
  unfollowArtist: (artistId: string) => Promise<void>
  saveAlbum: (album: Album) => Promise<void>
  unsaveAlbum: (albumId: string) => Promise<void>
  saveVideo: (video: MusicVideo) => void
  unsaveVideo: (videoId: string) => void
  savePodcast: (podcast: PodcastSummary) => void
  unsavePodcast: (podcastId: string) => void
  createPlaylist: (name: string, description?: string, isPublic?: boolean, smartRules?: SmartPlaylistRules) => Promise<Playlist>
  syncPlaylistTracks: (playlistId: string, tracks: PlaylistTrack[]) => void
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>
  deletePlaylist: (playlistId: string) => Promise<void>
  savePlaylist: (playlist: Playlist) => Promise<void>
  unsavePlaylist: (playlistId: string) => Promise<void>
  setPlaylistVisibility: (playlistId: string, visibility: PlaylistVisibility) => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  savedPlaylists: [],
  likedSongs: [],
  likedAtMap: {},
  followedArtists: [],
  savedAlbums: [],
  savedVideos: [],
  savedPodcasts: [],
  likedTrackIds: new Set(),
  followedArtistIds: new Set(),
  savedAlbumIds: new Set(),
  savedVideoIds: new Set(),
  savedPodcastIds: new Set(),
  isLoading: false,

  fetchLibrary: async () => {
    set({ isLoading: true, savedPlaylists: [], likedSongs: [], likedTrackIds: new Set() })
    try {
      const [playlists, savedRows, savedAlbums] = await Promise.all([
        playlistService.getUserPlaylists(),
        trackService.getLikedSongs(),
        albumService.getSavedAlbums(),
      ])
      const likedTracks = savedRows.map((r) => r.track)
      const likedAtMap: Record<string, string> = {}
      for (const r of savedRows) likedAtMap[r.track.id] = r.savedAt
      const likedIds = new Set(likedTracks.map((t) => t.id))

      let followedArtists: Artist[] = []
      try {
        const stored = localStorage.getItem('ns-followed-artists')
        if (stored) followedArtists = JSON.parse(stored)
      } catch { /* ignore */ }
      followedArtists = await refreshFollowedArtists(followedArtists)
      const followedIds = new Set(followedArtists.map((a) => a.id))

      // Saved videos + podcasts are client-side only (no backend save endpoints
      // yet) — same localStorage approach as followed artists.
      const savedVideos = readStored<MusicVideo>('ns-saved-videos')
      const savedPodcasts = readStored<PodcastSummary>('ns-saved-podcasts')

      set({
        savedPlaylists: playlists,
        likedSongs: likedTracks,
        likedAtMap,
        likedTrackIds: likedIds,
        savedAlbums,
        savedAlbumIds: new Set(savedAlbums.map((a) => a.id)),
        followedArtists,
        followedArtistIds: followedIds,
        savedVideos,
        savedVideoIds: new Set(savedVideos.map((v) => v.id)),
        savedPodcasts,
        savedPodcastIds: new Set(savedPodcasts.map((p) => p.id)),
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  likeTrack: async (track) => {
    const prev = { likedSongs: get().likedSongs, likedTrackIds: get().likedTrackIds, likedAtMap: get().likedAtMap }
    const savedAt = new Date().toISOString()
    set({
      likedSongs: [track, ...prev.likedSongs],
      likedTrackIds: new Set([...prev.likedTrackIds, track.id]),
      likedAtMap: { ...prev.likedAtMap, [track.id]: savedAt },
    })
    try {
      await trackService.like(track.id)
    } catch {
      set({ likedSongs: prev.likedSongs, likedTrackIds: prev.likedTrackIds, likedAtMap: prev.likedAtMap })
    }
  },

  unlikeTrack: async (trackId) => {
    const prev = { likedSongs: get().likedSongs, likedTrackIds: get().likedTrackIds, likedAtMap: get().likedAtMap }
    const newIds = new Set(prev.likedTrackIds)
    newIds.delete(trackId)
    const newLikedAtMap = { ...prev.likedAtMap }
    delete newLikedAtMap[trackId]
    set({
      likedSongs: prev.likedSongs.filter((t) => t.id !== trackId),
      likedTrackIds: newIds,
      likedAtMap: newLikedAtMap,
    })
    try {
      await trackService.unlike(trackId)
    } catch {
      set({ likedSongs: prev.likedSongs, likedTrackIds: prev.likedTrackIds, likedAtMap: prev.likedAtMap })
    }
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
    try {
      await albumService.saveToLibrary(album.id)
    } catch {
      set({ savedAlbums: prev, savedAlbumIds: prevIds })
    }
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
    try {
      await albumService.unsaveFromLibrary(albumId)
    } catch {
      set({ savedAlbums: prev, savedAlbumIds: prevIds })
    }
  },

  saveVideo: (video) => {
    const prevIds = get().savedVideoIds
    if (prevIds.has(video.id)) return
    const savedVideos = [video, ...get().savedVideos]
    set({ savedVideos, savedVideoIds: new Set([...prevIds, video.id]) })
    writeStored('ns-saved-videos', savedVideos)
  },

  unsaveVideo: (videoId) => {
    const savedVideos = get().savedVideos.filter((v) => v.id !== videoId)
    const newIds = new Set(get().savedVideoIds)
    newIds.delete(videoId)
    set({ savedVideos, savedVideoIds: newIds })
    writeStored('ns-saved-videos', savedVideos)
  },

  savePodcast: (podcast) => {
    const prevIds = get().savedPodcastIds
    if (prevIds.has(podcast.id)) return
    const savedPodcasts = [podcast, ...get().savedPodcasts]
    set({ savedPodcasts, savedPodcastIds: new Set([...prevIds, podcast.id]) })
    writeStored('ns-saved-podcasts', savedPodcasts)
  },

  unsavePodcast: (podcastId) => {
    const savedPodcasts = get().savedPodcasts.filter((p) => p.id !== podcastId)
    const newIds = new Set(get().savedPodcastIds)
    newIds.delete(podcastId)
    set({ savedPodcasts, savedPodcastIds: newIds })
    writeStored('ns-saved-podcasts', savedPodcasts)
  },

  createPlaylist: async (name, description, isPublic = true, smartRules) => {
    const playlist = await playlistService.create(name, description, isPublic, smartRules)
    set((s) => ({ savedPlaylists: [playlist, ...s.savedPlaylists] }))
    return playlist
  },

  syncPlaylistTracks: (playlistId, tracks) => {
    set((s) => ({
      savedPlaylists: s.savedPlaylists.map((p) =>
        p.id === playlistId ? { ...p, tracks } : p,
      ),
    }))
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

  setPlaylistVisibility: async (playlistId, visibility) => {
    await playlistService.setVisibility(playlistId, visibility)
    set((s) => ({
      savedPlaylists: s.savedPlaylists.map((p) =>
        p.id === playlistId ? { ...p, visibility, isPublic: visibility === 'public' } : p,
      ),
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
            tracks: [...(p.tracks ?? []), { track, addedAt: new Date().toISOString(), addedBy: p.owner }],
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
        const removed = (p.tracks ?? []).find((pt) => pt.track.id === trackId)
        return {
          ...p,
          tracks: (p.tracks ?? []).filter((pt) => pt.track.id !== trackId),
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

/** Read a JSON array from localStorage, tolerating missing/corrupt values. */
function readStored<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeStored<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / serialization errors */
  }
}

async function refreshFollowedArtists(artists: Artist[]) {
  if (artists.length === 0) return artists
  const refreshed = await Promise.all(
    artists.map(async (artist) => {
      try {
        return await artistService.getById(artist.id)
      } catch {
        return artist
      }
    }),
  )
  try {
    localStorage.setItem('ns-followed-artists', JSON.stringify(refreshed))
  } catch {
    /* ignore */
  }
  return refreshed
}

// Clear the personal library the moment the user logs out — no refresh needed.
// Only fire on the authenticated → unauthenticated transition (not during the
// initial hydration window), and also drop the localStorage caches so likes/follows
// can't survive logout or leak into the next session.
useAuthStore.subscribe((state, prev) => {
  if (!prev.isAuthenticated || state.isAuthenticated) return
  try {
    // Keep ns-followed-artists: follows are local-only until the backend supports them.
    // clean up any legacy liked-songs keys from before backend persistence
    localStorage.removeItem('ns-liked-tracks')
    localStorage.removeItem('ns-liked-at')
  } catch {
    /* ignore */
  }
  useLibraryStore.setState({
    savedPlaylists: [],
    likedSongs: [],
    likedAtMap: {},
    followedArtists: [],
    savedAlbums: [],
    savedVideos: [],
    savedPodcasts: [],
    likedTrackIds: new Set(),
    followedArtistIds: new Set(),
    savedAlbumIds: new Set(),
    savedVideoIds: new Set(),
    savedPodcastIds: new Set(),
    isLoading: false,
  })
})
