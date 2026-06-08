import type { Genre } from '@/types/genre'
import type { Playlist } from '@/types/playlist'
import { api } from './api'

export const genreService = {
  async getAll(): Promise<Genre[]> {
    const res = await api.get<Genre[]>('/genres')
    return res.data
  },

  async getBySlug(slug: string): Promise<Genre> {
    const res = await api.get<Genre>(`/genres/${slug}`)
    return res.data
  },

  async getPlaylistsByGenre(_slug: string): Promise<Playlist[]> {
    return []
  },
}
