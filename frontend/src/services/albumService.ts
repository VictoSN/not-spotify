import type { Album } from '@/types/album'
import { api } from './api'

export const albumService = {
  async getById(id: string): Promise<Album> {
    const res = await api.get<Album>(`/albums/${id}`)
    return res.data
  },

  async getNewReleases(limit = 10): Promise<Album[]> {
    const res = await api.get<Album[]>('/albums')
    return [...res.data].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)).slice(0, limit)
  },

  async search(query: string): Promise<Album[]> {
    const res = await api.get<{ albums: Album[] }>('/search', { params: { q: query, type: 'album' } })
    return res.data.albums
  },
}
