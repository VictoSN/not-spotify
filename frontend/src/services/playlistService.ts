import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import type { ApiResponse } from '@/types/api'
import { api, delay, USE_MOCK } from './api'
import { mockPlaylists } from '@/mock/playlists'
import { mockUserRef } from '@/mock/users'

export const playlistService = {
  async getById(id: string): Promise<Playlist> {
    if (USE_MOCK) {
      await delay(200)
      return mockPlaylists.find((p) => p.id === id) ?? mockPlaylists[0]
    }
    const res = await api.get<ApiResponse<Playlist>>(`/playlists/${id}`)
    return res.data.data
  },

  async getFeatured(limit = 6): Promise<Playlist[]> {
    if (USE_MOCK) {
      await delay(300)
      return mockPlaylists.slice(0, limit)
    }
    const res = await api.get<ApiResponse<Playlist[]>>('/playlists/featured', { params: { limit } })
    return res.data.data
  },

  async getUserPlaylists(): Promise<Playlist[]> {
    if (USE_MOCK) {
      await delay(200)
      return mockPlaylists.filter((p) => p.owner.id === mockUserRef.id)
    }
    const res = await api.get<ApiResponse<Playlist[]>>('/me/playlists')
    return res.data.data
  },

  async create(name: string, description?: string): Promise<Playlist> {
    if (USE_MOCK) {
      await delay(400)
      const now = new Date().toISOString()
      return {
        id: `playlist-${Date.now()}`,
        name,
        description: description ?? null,
        coverUrl: null,
        isPublic: false,
        owner: mockUserRef,
        tracks: [],
        followerCount: 0,
        totalDurationMs: 0,
        createdAt: now,
        updatedAt: now,
      }
    }
    const res = await api.post<ApiResponse<Playlist>>('/playlists', { name, description })
    return res.data.data
  },

  async addTrack(playlistId: string, track: Track): Promise<void> {
    if (USE_MOCK) { await delay(200); return }
    await api.post(`/playlists/${playlistId}/tracks`, { trackId: track.id })
  },

  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    if (USE_MOCK) { await delay(200); return }
    await api.delete(`/playlists/${playlistId}/tracks/${trackId}`)
  },

  async delete(playlistId: string): Promise<void> {
    if (USE_MOCK) { await delay(300); return }
    await api.delete(`/playlists/${playlistId}`)
  },

  async search(query: string): Promise<Playlist[]> {
    if (USE_MOCK) {
      await delay(300)
      const q = query.toLowerCase()
      return mockPlaylists.filter((p) => p.name.toLowerCase().includes(q))
    }
    const res = await api.get<ApiResponse<Playlist[]>>('/playlists/search', { params: { q: query } })
    return res.data.data
  },
}
