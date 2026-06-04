import type { Track } from '@/types/track'
import { api } from './api'

export const trackService = {
  async getById(id: string): Promise<Track> {
    const res = await api.get<Track>(`/tracks/${id}`)
    return res.data
  },

  async getTrending(limit = 20): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/featured')
    return res.data.slice(0, limit)
  },

  async getRecommended(limit = 20): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/featured')
    return res.data.slice(0, limit)
  },

  async getByAlbum(albumId: string): Promise<Track[]> {
    const res = await api.get<Track[]>(`/albums/${albumId}/tracks`)
    return res.data
  },

  async search(query: string): Promise<Track[]> {
    const res = await api.get<{ tracks: Track[] }>('/search', { params: { q: query, type: 'track' } })
    return res.data.tracks
  },

  async getRecents(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/me/recents', { params: { limit } })
    return res.data
  },

  async recordPlay(trackId: string): Promise<void> {
    await api.post('/me/plays', { trackId })
  },
}
