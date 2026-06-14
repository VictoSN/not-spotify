import { api } from './api'
import type { NotificationList } from '@/types/notification'

export const notificationService = {
  async list(): Promise<NotificationList> {
    const res = await api.get<NotificationList>('/notifications')
    return res.data
  },

  async markRead(id: string): Promise<void> {
    await api.post(`/notifications/${id}/read`)
  },

  async markAllRead(): Promise<void> {
    await api.post('/notifications/read-all')
  },

  async clearAll(): Promise<void> {
    await api.delete('/notifications')
  },
}
