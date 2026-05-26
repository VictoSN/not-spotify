import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import { api } from './api'

export const playlistService = {
  async getById(id: string): Promise<Playlist> {
    const res = await api.get<Playlist>(`/playlists/${id}`)
    return res.data
  },

  async getFeatured(limit = 6): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>('/playlists')
    return res.data.slice(0, limit)
  },

  async getUserPlaylists(): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>('/playlists')
    return res.data
  },

  async create(name: string, description?: string): Promise<Playlist> {
    const res = await api.post<Playlist>('/playlists', { name, description })
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

  async search(query: string): Promise<Playlist[]> {
    const res = await api.get<{ playlists: Playlist[] }>('/search', { params: { q: query, type: 'playlist' } })
    return res.data.playlists
  },
}
