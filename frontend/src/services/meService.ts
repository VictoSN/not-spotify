import type { Track } from '@/types/track'
import type { User } from '@/types/user'
import { api } from './api'

export interface RecentSearch {
  id: string
  term: string
  searchedAt: string
}

export interface PlayHistoryItem {
  track: Track
  playedAt: string
}

export interface ListeningStats {
  days: number
  totalPlays: number
  totalMinutes: number
  uniqueTracks: number
  uniqueArtists: number
  topTracks: { track: Track; playCount: number }[]
  topArtists: { artistId: string; name: string; playCount: number }[]
  topGenres: { name: string; playCount: number }[]
  byDay: { date: string; count: number }[]
}

export interface UpdateProfilePayload {
  name?: string
  email?: string
  country?: string
}

export const meService = {
  async updateProfile(payload: UpdateProfilePayload): Promise<User> {
    const res = await api.patch<User>('/me/profile', payload)
    return res.data
  },

  async uploadAvatar(file: File): Promise<User> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<User>('/me/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  async deleteAvatar(): Promise<User> {
    const res = await api.delete<User>('/me/avatar')
    return res.data
  },

  async getHistory(limit = 50, offset = 0): Promise<PlayHistoryItem[]> {
    const res = await api.get<PlayHistoryItem[]>('/me/history', { params: { limit, offset } })
    return res.data
  },

  async getStats(days = 30): Promise<ListeningStats> {
    const res = await api.get<ListeningStats>('/me/stats', { params: { days } })
    return res.data
  },

  async getRecentSearches(): Promise<RecentSearch[]> {
    const res = await api.get<RecentSearch[]>('/me/recent-searches')
    return res.data
  },

  async addRecentSearch(term: string): Promise<RecentSearch[]> {
    const res = await api.post<RecentSearch[]>('/me/recent-searches', { term })
    return res.data
  },

  async removeRecentSearch(id: string): Promise<void> {
    await api.delete(`/me/recent-searches/${id}`)
  },

  async clearRecentSearches(): Promise<void> {
    await api.delete('/me/recent-searches')
  },
}
