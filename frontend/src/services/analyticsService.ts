import { api } from './api'

export const analyticsService = {
  async recordVisit(path: string): Promise<void> {
    await api.post('/analytics/visit', { path })
  },

  async playbackHeartbeat(trackId: string): Promise<void> {
    await api.post('/analytics/playback-heartbeat', { trackId })
  },
}
