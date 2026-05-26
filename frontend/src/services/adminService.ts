import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { api } from './api'

// ── Artist ────────────────────────────────────────────────────────────────────

export interface CreateArtistPayload {
  name: string
  bio?: string | null
  instagram?: string | null
  twitter?: string | null
  website?: string | null
  verified?: boolean
}

export type UpdateArtistPayload = Partial<CreateArtistPayload>

// ── Album ─────────────────────────────────────────────────────────────────────

export interface CreateAlbumPayload {
  title: string
  artistId: string
  type?: string
  releaseDate?: string | null  // YYYY-MM-DD
  label?: string | null
  copyright?: string | null
}

export type UpdateAlbumPayload = Partial<CreateAlbumPayload>

// ── Track ─────────────────────────────────────────────────────────────────────

export interface CreateTrackPayload {
  title: string
  albumId: string
  artistId: string
  durationMs: number
  trackNumber?: number
  discNumber?: number
  explicit?: boolean
}

export type UpdateTrackPayload = Partial<CreateTrackPayload>

// ── Service ───────────────────────────────────────────────────────────────────

export const adminService = {
  // Artists
  async listArtists(): Promise<Artist[]> {
    const res = await api.get<Artist[]>('/artists')
    return res.data
  },

  async getArtist(id: string): Promise<Artist> {
    const res = await api.get<Artist>(`/admin/artists/${id}`)
    return res.data
  },

  async createArtist(payload: CreateArtistPayload): Promise<Artist> {
    const res = await api.post<Artist>('/admin/artists', payload)
    return res.data
  },

  async updateArtist(id: string, payload: UpdateArtistPayload): Promise<Artist> {
    const res = await api.patch<Artist>(`/admin/artists/${id}`, payload)
    return res.data
  },

  async deleteArtist(id: string): Promise<void> {
    await api.delete(`/admin/artists/${id}`)
  },

  async uploadArtistImage(id: string, file: File, type: 'profile' | 'header' = 'profile'): Promise<Artist> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<Artist>(`/admin/artists/${id}/image?type=${type}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  // Albums
  async listAlbums(): Promise<Album[]> {
    const res = await api.get<Album[]>('/albums')
    return res.data
  },

  async getAlbum(id: string): Promise<Album> {
    const res = await api.get<Album>(`/albums/${id}`)
    return res.data
  },

  async createAlbum(payload: CreateAlbumPayload): Promise<Album> {
    const res = await api.post<Album>('/admin/albums', payload)
    return res.data
  },

  async updateAlbum(id: string, payload: UpdateAlbumPayload): Promise<Album> {
    const res = await api.patch<Album>(`/admin/albums/${id}`, payload)
    return res.data
  },

  async deleteAlbum(id: string): Promise<void> {
    await api.delete(`/admin/albums/${id}`)
  },

  async uploadAlbumCover(id: string, file: File): Promise<Album> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<Album>(`/admin/albums/${id}/cover`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  // Tracks
  async listTracks(): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks')
    return res.data
  },

  async getTrack(id: string): Promise<Track> {
    const res = await api.get<Track>(`/tracks/${id}`)
    return res.data
  },

  async createTrack(payload: CreateTrackPayload): Promise<Track> {
    const res = await api.post<Track>('/admin/tracks', payload)
    return res.data
  },

  async updateTrack(id: string, payload: UpdateTrackPayload): Promise<Track> {
    const res = await api.patch<Track>(`/admin/tracks/${id}`, payload)
    return res.data
  },

  async deleteTrack(id: string): Promise<void> {
    await api.delete(`/admin/tracks/${id}`)
  },

  async uploadTrackAudio(id: string, file: File): Promise<Track> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<Track>(`/admin/tracks/${id}/audio`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
