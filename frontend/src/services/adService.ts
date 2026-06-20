import type { Ad, AdSettings } from '@/types/ad'
import { api } from './api'

export const adService = {
  /** The free-tier cadence (an ad after every N tracks) + global on/off. */
  async getSettings(): Promise<AdSettings> {
    const res = await api.get<AdSettings>('/ads/settings')
    return res.data
  },

  /** One ad to play, or null when ads are off / nothing matches (HTTP 204). */
  async getNext(country?: string): Promise<Ad | null> {
    const res = await api.get<Ad>('/ads/next', {
      params: country ? { country } : undefined,
    })
    if (res.status === 204 || !res.data) return null
    return res.data
  },

  async recordImpression(id: string): Promise<void> {
    await api.post(`/ads/${id}/impression`)
  },
}
