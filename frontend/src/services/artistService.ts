import type { Artist, TourDate } from '@/types/artist'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import { api } from './api'

export const artistService = {
  async getById(id: string): Promise<Artist> {
    const res = await api.get<Artist>(`/artists/${id}`)
    return res.data
  },

  async getTourDates(artistId: string): Promise<TourDate[]> {
    const res = await api.get<TourDate[]>(`/artists/${artistId}/tour`)
    return res.data
  },

  async getTopTracks(artistId: string, limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>(`/artists/${artistId}/top-tracks`, { params: { limit } })
    return res.data
  },

  async getAlbums(artistId: string): Promise<Album[]> {
    const res = await api.get<Album[]>(`/artists/${artistId}/albums`)
    return res.data
  },

  async getRelated(artistId: string, limit = 8): Promise<Artist[]> {
    const res = await api.get<Artist[]>(`/artists/${artistId}/related`, { params: { limit } })
    return res.data
  },

  async search(query: string): Promise<Artist[]> {
    const res = await api.get<{ artists: Artist[] }>('/search', { params: { q: query, type: 'artist' } })
    return res.data.artists
  },

  async getFeatured(): Promise<Artist[]> {
    const res = await api.get<Artist[]>('/artists')
    return res.data.slice(0, 4)
  },

  async getPopular(limit = 10): Promise<Artist[]> {
    const res = await api.get<Artist[]>('/artists/popular', { params: { limit } })
    return res.data
  },

  async getFollowing(): Promise<Artist[]> {
    const res = await api.get<Artist[]>('/artists/following')
    return res.data
  },

  async follow(artistId: string): Promise<void> {
    await api.post(`/artists/${artistId}/follow`)
  },

  async unfollow(artistId: string): Promise<void> {
    await api.delete(`/artists/${artistId}/follow`)
  },
}
