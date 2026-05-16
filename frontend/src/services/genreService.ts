import type { Genre } from '@/types/genre'
import type { Playlist } from '@/types/playlist'
import type { ApiResponse } from '@/types/api'
import { api, delay, USE_MOCK } from './api'
import { mockGenres } from '@/mock/genres'
import { mockPlaylists } from '@/mock/playlists'

export const genreService = {
  async getAll(): Promise<Genre[]> {
    if (USE_MOCK) {
      await delay(200)
      return mockGenres
    }
    const res = await api.get<ApiResponse<Genre[]>>('/genres')
    return res.data.data
  },

  async getBySlug(slug: string): Promise<Genre> {
    if (USE_MOCK) {
      await delay(200)
      return mockGenres.find((g) => g.slug === slug) ?? mockGenres[0]
    }
    const res = await api.get<ApiResponse<Genre>>(`/genres/${slug}`)
    return res.data.data
  },

  async getPlaylistsByGenre(slug: string): Promise<Playlist[]> {
    if (USE_MOCK) {
      await delay(300)
      void slug
      return mockPlaylists
    }
    const res = await api.get<ApiResponse<Playlist[]>>(`/genres/${slug}/playlists`)
    return res.data.data
  },
}
