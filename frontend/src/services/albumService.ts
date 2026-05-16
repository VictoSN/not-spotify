import type { Album } from '@/types/album'
import type { ApiResponse } from '@/types/api'
import { api, delay, USE_MOCK } from './api'
import { mockAlbums } from '@/mock/albums'

export const albumService = {
  async getById(id: string): Promise<Album> {
    if (USE_MOCK) {
      await delay(200)
      return mockAlbums.find((a) => a.id === id) ?? mockAlbums[0]
    }
    const res = await api.get<ApiResponse<Album>>(`/albums/${id}`)
    return res.data.data
  },

  async getNewReleases(limit = 10): Promise<Album[]> {
    if (USE_MOCK) {
      await delay(300)
      return [...mockAlbums].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)).slice(0, limit)
    }
    const res = await api.get<ApiResponse<Album[]>>('/albums/new-releases', { params: { limit } })
    return res.data.data
  },

  async search(query: string): Promise<Album[]> {
    if (USE_MOCK) {
      await delay(300)
      const q = query.toLowerCase()
      return mockAlbums.filter(
        (a) => a.title.toLowerCase().includes(q) || a.artist.name.toLowerCase().includes(q),
      )
    }
    const res = await api.get<ApiResponse<Album[]>>('/albums/search', { params: { q: query } })
    return res.data.data
  },
}
