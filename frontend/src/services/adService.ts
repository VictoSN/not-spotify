import type { Ad, AdAdmin, AdSettings, UpsertAdPayload } from '@/types/ad'
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

/**
 * Admin-only ad management (`/admin/ads/*`, gated behind the Admin role on the
 * server). These create/edit the same `Advertisement` rows that `getNext` serves
 * to free-tier listeners, so an ad created here is exactly what a free account hears.
 */
export const adminAdService = {
  async list(): Promise<AdAdmin[]> {
    const res = await api.get<AdAdmin[]>('/admin/ads')
    return res.data
  },

  async create(payload: UpsertAdPayload): Promise<AdAdmin> {
    const res = await api.post<AdAdmin>('/admin/ads', payload)
    return res.data
  },

  async update(id: string, payload: UpsertAdPayload): Promise<AdAdmin> {
    const res = await api.put<AdAdmin>(`/admin/ads/${id}`, payload)
    return res.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/admin/ads/${id}`)
  },

  /** The global cadence + on/off switch that decides whether ads serve at all. */
  async getSettings(): Promise<AdSettings> {
    const res = await api.get<AdSettings>('/admin/ads/settings')
    return res.data
  },

  async updateSettings(payload: AdSettings): Promise<AdSettings> {
    const res = await api.put<AdSettings>('/admin/ads/settings', payload)
    return res.data
  },
}
