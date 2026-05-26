import type { Artist } from '@/types/artist'
import { api } from './api'

export interface CreateArtistPayload {
  name: string
  bio?: string | null
  instagram?: string | null
  twitter?: string | null
  website?: string | null
  verified?: boolean
}

export type UpdateArtistPayload = Partial<CreateArtistPayload>

export const adminService = {
  async listArtists(): Promise<Artist[]> {
    const res = await api.get<Artist[]>('/artists')
    return res.data
  },

  async getArtist(id: string): Promise<Artist> {
    const res = await api.get<Artist>(`/admin/artists/${id}`)
    return res.data
  },

  async createArtist(payload: CreateArtistPayload): Promise<Artist> {
    const res = await api.post<Artist>('/admin/artists', payload)
    return res.data
  },

  async updateArtist(id: string, payload: UpdateArtistPayload): Promise<Artist> {
    const res = await api.patch<Artist>(`/admin/artists/${id}`, payload)
    return res.data
  },

  async deleteArtist(id: string): Promise<void> {
    await api.delete(`/admin/artists/${id}`)
  },

  async uploadArtistImage(id: string, file: File, type: 'profile' | 'header' = 'profile'): Promise<Artist> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<Artist>(`/admin/artists/${id}/image?type=${type}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
