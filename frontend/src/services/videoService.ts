import type { MusicVideo } from '@/types/musicVideo'
import { api } from './api'

export const videoService = {
  async list(): Promise<MusicVideo[]> {
    const res = await api.get<MusicVideo[]>('/videos')
    return res.data
  },

  async getById(id: string): Promise<MusicVideo> {
    const res = await api.get<MusicVideo>(`/videos/${id}`)
    return res.data
  },
}
