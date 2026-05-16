import type { Track } from '@/types/track'
import type { ApiResponse } from '@/types/api'
import { api, delay, USE_MOCK } from './api'
import { mockTracks } from '@/mock/tracks'

export const trackService = {
  async getById(id: string): Promise<Track> {
    if (USE_MOCK) {
      await delay(200)
      return mockTracks.find((t) => t.id === id) ?? mockTracks[0]
    }
    const res = await api.get<ApiResponse<Track>>(`/tracks/${id}`)
    return res.data.data
  },

  async getTrending(limit = 20): Promise<Track[]> {
    if (USE_MOCK) {
      await delay(300)
      return [...mockTracks].sort((a, b) => b.playCount - a.playCount).slice(0, limit)
    }
    const res = await api.get<ApiResponse<Track[]>>('/tracks/trending', { params: { limit } })
    return res.data.data
  },

  async getRecommended(limit = 20): Promise<Track[]> {
    if (USE_MOCK) {
      await delay(400)
      return [...mockTracks].sort(() => Math.random() - 0.5).slice(0, limit)
    }
    const res = await api.get<ApiResponse<Track[]>>('/tracks/recommended', { params: { limit } })
    return res.data.data
  },

  async getByAlbum(albumId: string): Promise<Track[]> {
    if (USE_MOCK) {
      await delay(200)
      return mockTracks.filter((t) => t.album.id === albumId)
    }
    const res = await api.get<ApiResponse<Track[]>>(`/albums/${albumId}/tracks`)
    return res.data.data
  },

  async search(query: string): Promise<Track[]> {
    if (USE_MOCK) {
      await delay(300)
      const q = query.toLowerCase()
      return mockTracks.filter(
        (t) => t.title.toLowerCase().includes(q) || t.artist.name.toLowerCase().includes(q),
      )
    }
    const res = await api.get<ApiResponse<Track[]>>('/tracks/search', { params: { q: query } })
    return res.data.data
  },
}
