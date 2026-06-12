import type { Track } from '@/types/track'
import { api } from './api'

export interface ChartEntry {
  rank: number
  playsThisWeek: number
  track: Track
}

export const trackService = {
  async getById(id: string): Promise<Track> {
    const res = await api.get<Track>(`/tracks/${id}`)
    return res.data
  },

  async getTrending(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/trending', { params: { limit } })
    return res.data
  },

  async getCharts(limit = 50): Promise<ChartEntry[]> {
    const res = await api.get<ChartEntry[]>('/tracks/charts', { params: { limit } })
    return res.data
  },

  async getMostLiked(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/most-liked', { params: { limit } })
    return res.data
  },

  async getNewMusic(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/new-music', { params: { limit } })
    return res.data
  },

  async getForYou(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/for-you', { params: { limit } })
    return res.data
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

  async like(trackId: string): Promise<void> {
    await api.post(`/me/saved-tracks/${trackId}`)
  },

  async unlike(trackId: string): Promise<void> {
    await api.delete(`/me/saved-tracks/${trackId}`)
  },

  async getLikedSongs(): Promise<{ track: Track; savedAt: string }[]> {
    const res = await api.get<{ track: Track; savedAt: string }[]>('/me/saved-tracks')
    return res.data
  },

  async getMyRatings(): Promise<Record<string, number>> {
    const res = await api.get<Record<string, number>>('/me/ratings')
    return res.data
  },

  async rateTrack(trackId: string, rating: number): Promise<{ ratingCount: number; averageRating: number; myRating: number }> {
    const res = await api.put(`/me/track-ratings/${trackId}`, { rating })
    return res.data
  },

  async unrateTrack(trackId: string): Promise<{ ratingCount: number; averageRating: number; myRating: number }> {
    const res = await api.delete(`/me/track-ratings/${trackId}`)
    return res.data
  },

  async getLyrics(id: string): Promise<{ lyrics: string | null; syncedLyrics: string | null; source: string }> {
    const res = await api.get<{ lyrics: string | null; syncedLyrics: string | null; source: string }>(`/tracks/${id}/lyrics`)
    return res.data
  },
}
