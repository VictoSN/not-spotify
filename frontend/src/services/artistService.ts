import type { Artist } from '@/types/artist'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import type { ApiResponse } from '@/types/api'
import { api, delay, USE_MOCK } from './api'
import { mockArtists } from '@/mock/artists'
import { mockTracks } from '@/mock/tracks'
import { mockAlbums } from '@/mock/albums'

export const artistService = {
  async getById(id: string): Promise<Artist> {
    if (USE_MOCK) {
      await delay(200)
      return mockArtists.find((a) => a.id === id) ?? mockArtists[0]
    }
    const res = await api.get<ApiResponse<Artist>>(`/artists/${id}`)
    return res.data.data
  },

  async getTopTracks(artistId: string, limit = 10): Promise<Track[]> {
    if (USE_MOCK) {
      await delay(200)
      return mockTracks.filter((t) => t.artist.id === artistId).slice(0, limit)
    }
    const res = await api.get<ApiResponse<Track[]>>(`/artists/${artistId}/top-tracks`, { params: { limit } })
    return res.data.data
  },

  async getAlbums(artistId: string): Promise<Album[]> {
    if (USE_MOCK) {
      await delay(200)
      return mockAlbums.filter((a) => a.artist.id === artistId)
    }
    const res = await api.get<ApiResponse<Album[]>>(`/artists/${artistId}/albums`)
    return res.data.data
  },

  async search(query: string): Promise<Artist[]> {
    if (USE_MOCK) {
      await delay(300)
      const q = query.toLowerCase()
      return mockArtists.filter((a) => a.name.toLowerCase().includes(q))
    }
    const res = await api.get<ApiResponse<Artist[]>>('/artists/search', { params: { q: query } })
    return res.data.data
  },

  async getFeatured(): Promise<Artist[]> {
    if (USE_MOCK) {
      await delay(300)
      return mockArtists.slice(0, 4)
    }
    const res = await api.get<ApiResponse<Artist[]>>('/artists/featured')
    return res.data.data
  },
}
