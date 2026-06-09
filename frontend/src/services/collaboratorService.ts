import type { UserRef } from '@/types/user'
import { api } from './api'

export const collaboratorService = {
  async list(playlistId: string): Promise<UserRef[]> {
    const res = await api.get<UserRef[]>(`/playlists/${playlistId}/collaborators`)
    return res.data
  },

  async invite(playlistId: string, userId: string): Promise<void> {
    await api.post(`/playlists/${playlistId}/collaborators`, { userId })
  },

  async remove(playlistId: string, userId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}/collaborators/${userId}`)
  },
}
