import type { Track } from '@/types/track'
import type { User } from '@/types/user'
import type { TourDate } from '@/types/artist'
import { api } from './api'

export interface TourDatePayload {
  eventDate: string
  city: string
  venue: string
  country?: string | null
  ticketUrl?: string | null
}

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

export interface ArtistStats {
  days: number
  totalPlays: number
  playsInWindow: number
  followerCount: number
  byDay: { date: string; count: number }[]
  topTracks: { track: Track; playCount: number }[]
}

export interface UpdateProfilePayload {
  name?: string
  email?: string
  country?: string
}

export interface AccountPreferences {
  allowPersonalizedAds: boolean
  blockAlcoholAds: boolean
  blockGamblingAds: boolean
  emailProductUpdates: boolean
  emailSecurityAlerts: boolean
}

export interface DeletedPlaylist {
  id: string
  originalPlaylistId: string
  name: string
  description: string | null
  trackCount: number
  deletedAt: string
  expiresAt: string
}

export interface LoginMethods {
  hasPassword: boolean
  externalProviders: {
    google: { enabled: boolean; configured: boolean; available: boolean }
    facebook: { enabled: boolean; configured: boolean; available: boolean }
    apple: { enabled: boolean; configured: boolean; available: boolean }
  }
}

export interface RedeemResult {
  code: string
  message: string
  user: User | null
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

  async getArtistStats(days = 14): Promise<ArtistStats> {
    const res = await api.get<ArtistStats>('/me/artist-stats', { params: { days } })
    return res.data
  },

  // Artist-managed tour/concert dates (Artist role).
  async getArtistTour(): Promise<TourDate[]> {
    const res = await api.get<TourDate[]>('/me/artist-tour')
    return res.data
  },

  async createArtistTourDate(payload: TourDatePayload): Promise<TourDate> {
    const res = await api.post<TourDate>('/me/artist-tour', payload)
    return res.data
  },

  async updateArtistTourDate(id: string, payload: TourDatePayload): Promise<TourDate> {
    const res = await api.put<TourDate>(`/me/artist-tour/${id}`, payload)
    return res.data
  },

  async deleteArtistTourDate(id: string): Promise<void> {
    await api.delete(`/me/artist-tour/${id}`)
  },

  async setArtistTourSetlist(id: string, trackIds: string[]): Promise<TourDate> {
    const res = await api.put<TourDate>(`/me/artist-tour/${id}/setlist`, { trackIds })
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

  async exportData(): Promise<unknown> {
    const res = await api.get<unknown>('/me/export')
    return res.data
  },

  async getAccountPreferences(): Promise<AccountPreferences> {
    const res = await api.get<AccountPreferences>('/me/account-preferences')
    return res.data
  },

  async updateAccountPreferences(payload: AccountPreferences): Promise<AccountPreferences> {
    const res = await api.put<AccountPreferences>('/me/account-preferences', payload)
    return res.data
  },

  async getLoginMethods(): Promise<LoginMethods> {
    const res = await api.get<LoginMethods>('/me/login-methods')
    return res.data
  },

  async redeem(code: string): Promise<RedeemResult> {
    const res = await api.post<RedeemResult>('/me/redeem', { code })
    return res.data
  },

  async getDeletedPlaylists(): Promise<DeletedPlaylist[]> {
    const res = await api.get<DeletedPlaylist[]>('/me/deleted-playlists')
    return res.data
  },

  async restoreDeletedPlaylist(id: string) {
    const res = await api.post(`/me/deleted-playlists/${id}/restore`)
    return res.data
  },

  async deleteAccount(confirmation: string): Promise<void> {
    await api.delete('/me/account', { data: { confirmation } })
  },
}
