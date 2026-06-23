import type { MusicVideo } from '@/types/musicVideo'
import { api } from './api'

// Cached index of all videos by trackId, lazily built. The catalogue is small
// (demo-scale) so one /videos round trip per session is cheap, and it lets the
// per-track lookup work even if the by-track API route isn't deployed yet.
let trackVideoIndex: Promise<Map<string, MusicVideo>> | null = null
async function loadTrackVideoIndex(): Promise<Map<string, MusicVideo>> {
  if (!trackVideoIndex) {
    trackVideoIndex = (async () => {
      const res = await api.get<MusicVideo[]>('/videos')
      const map = new Map<string, MusicVideo>()
      for (const v of res.data) if (v.trackId) map.set(v.trackId, v)
      return map
    })().catch((err) => {
      trackVideoIndex = null
      throw err
    })
  }
  return trackVideoIndex
}

export const videoService = {
  async list(): Promise<MusicVideo[]> {
    const res = await api.get<MusicVideo[]>('/videos')
    return res.data
  },

  async getById(id: string): Promise<MusicVideo> {
    const res = await api.get<MusicVideo>(`/videos/${id}`)
    return res.data
  },

  /**
   * Returns the music video accompanying a given audio track, or null if there
   * isn't one. Tries the dedicated /videos/by-track/{id} route first, then falls
   * back to the cached /videos list so the feature works whether or not the
   * backend has been redeployed with the new route.
   */
  async getByTrackId(trackId: string): Promise<MusicVideo | null> {
    try {
      const res = await api.get<MusicVideo>(`/videos/by-track/${trackId}`)
      return res.data
    } catch {
      try {
        const index = await loadTrackVideoIndex()
        return index.get(trackId) ?? null
      } catch {
        return null
      }
    }
  },
}
