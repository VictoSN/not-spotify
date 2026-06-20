import type { Podcast, PodcastSummary, Episode } from '@/types/podcast'
import { api } from './api'

export const podcastService = {
  async getAll(): Promise<PodcastSummary[]> {
    const res = await api.get<PodcastSummary[]>('/podcasts')
    return res.data
  },

  async getById(id: string): Promise<Podcast> {
    const res = await api.get<Podcast>(`/podcasts/${id}`)
    return res.data
  },

  async getEpisodes(id: string): Promise<Episode[]> {
    const res = await api.get<Episode[]>(`/podcasts/${id}/episodes`)
    return res.data
  },
}
