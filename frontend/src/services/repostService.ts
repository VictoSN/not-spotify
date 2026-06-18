import type { Repost } from '@/types/repost'
import { api } from './api'

export const repostService = {
  async getMyReposts(limit = 30): Promise<Repost[]> {
    const res = await api.get<Repost[]>('/me/reposts', { params: { limit } })
    return res.data
  },

  async getFeed(limit = 30): Promise<Repost[]> {
    const res = await api.get<Repost[]>('/me/feed', { params: { limit } })
    return res.data
  },

  async createRepost(params: { trackId?: string; albumId?: string; playlistId?: string }): Promise<Repost> {
    const res = await api.post<Repost>('/me/reposts', params)
    return res.data
  },

  async deleteRepost(id: string): Promise<void> {
    await api.delete(`/me/reposts/${id}`)
  },
}
