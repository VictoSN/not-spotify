import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import { api } from './api'

export const playlistService = {
  async getById(id: string): Promise<Playlist> {
    const res = await api.get<Playlist>(`/playlists/${id}`)
    return res.data
  },

  async getRecommended(limit = 10): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>('/playlists')
    return res.data.slice(0, limit)
  },

  async getFeatured(limit = 6): Promise<Playlist[]> {
    return this.getRecommended(limit)
  },

  async getUserPlaylists(): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>('/me/playlists')
    return res.data
  },

  async create(name: string, description?: string, isPublic = true): Promise<Playlist> {
    const res = await api.post<Playlist>('/playlists', { name, description, isPublic })
    return res.data
  },

  async updateVisibility(playlistId: string, isPublic: boolean): Promise<Playlist> {
    const res = await api.patch<Playlist>(`/playlists/${playlistId}`, { isPublic })
    return res.data
  },

  async update(
    playlistId: string,
    payload: { name?: string; description?: string | null; isPublic?: boolean },
  ): Promise<Playlist> {
    const res = await api.patch<Playlist>(`/playlists/${playlistId}`, payload)
    return res.data
  },

  async uploadCover(playlistId: string, file: File): Promise<Playlist> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<Playlist>(`/playlists/${playlistId}/cover`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  async addTrack(playlistId: string, track: Track): Promise<void> {
    await api.post(`/playlists/${playlistId}/tracks`, { trackId: track.id })
  },

  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}/tracks/${trackId}`)
  },

  async delete(playlistId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}`)
  },

  async save(playlistId: string): Promise<void> {
    await api.post(`/me/saved-playlists/${playlistId}`)
  },

  async unsave(playlistId: string): Promise<void> {
    await api.delete(`/me/saved-playlists/${playlistId}`)
  },

  async search(query: string): Promise<Playlist[]> {
    const res = await api.get<{ playlists: Playlist[] }>('/search', { params: { q: query, type: 'playlist' } })
    return res.data.playlists
  },
}
