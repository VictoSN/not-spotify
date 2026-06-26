import { create } from 'zustand'
import type { AppNotification } from '@/types/notification'
import { notificationService } from '@/services/notificationService'
import { useAuthStore } from './authStore'

interface NotificationState {
  items: AppNotification[]
  unreadCount: number
  fetch: () => Promise<void>
  receive: (notification: AppNotification) => void
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  clearAll: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,

  fetch: async () => {
    try {
      const { items, unreadCount } = await notificationService.list()
      set({ items, unreadCount })
    } catch {
      /* ignore — network blip / not logged in */
    }
  },

  receive: (notification) => {
    set((s) => {
      const existed = s.items.some((n) => n.id === notification.id)
      const items = existed
        ? s.items.map((n) => (n.id === notification.id ? notification : n))
        : [notification, ...s.items].slice(0, 50)
      return {
        items,
        unreadCount: existed || notification.isRead ? s.unreadCount : s.unreadCount + 1,
      }
    })
  },

  markRead: async (id) => {
    // Optimistic: flip read + decrement the badge immediately.
    set((s) => {
      const target = s.items.find((n) => n.id === id)
      if (!target || target.isRead) return s
      return {
        items: s.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }
    })
    try {
      await notificationService.markRead(id)
    } catch {
      void get().fetch() // resync on failure
    }
  },

  markAllRead: async () => {
    set((s) => ({ items: s.items.map((n) => ({ ...n, isRead: true })), unreadCount: 0 }))
    try {
      await notificationService.markAllRead()
    } catch {
      void get().fetch()
    }
  },

  clearAll: async () => {
    set({ items: [], unreadCount: 0 })
    try {
      await notificationService.clearAll()
    } catch {
      void get().fetch()
    }
  },
}))

// Wipe on logout (same pattern as friendStore).
useAuthStore.subscribe((state, prev) => {
  if (!prev.isAuthenticated || state.isAuthenticated) return
  useNotificationStore.setState({ items: [], unreadCount: 0 })
})
