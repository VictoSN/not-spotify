import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '@/stores/authStore'
import { useFriendStore } from '@/stores/friendStore'
import { useChatStore } from '@/stores/chatStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { fireOsNotification } from '@/services/notifications'
import { chatService } from '@/services/chatService'
import type { ChatMessage } from '@/types/chat'
import type { AppNotification } from '@/types/notification'

/**
 * Opens a SignalR WebSocket connection to /hubs/presence.
 *
 * The server fires:
 *   "FriendOnline"  (userId: string) — a friend just opened a tab
 *   "FriendOffline" (userId: string) — a friend closed their last tab
 *
 * We patch the Zustand activity array directly so the UI updates instantly
 * without waiting for the next poll cycle.
 */
export function usePresenceSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const connectionRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      connectionRef.current?.stop()
      connectionRef.current = null
      return
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL ?? ''}/hubs/presence`, {
        // JWT is sent as ?access_token= because browsers can't set
        // custom headers on WebSocket upgrade requests.
        accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
      })
      .withAutomaticReconnect([0, 1000, 3000, 5000, 10_000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    // ── Presence events ────────────────────────────────────────────────────

    connection.on('FriendOnline', (userId: string) => {
      useFriendStore.setState((s) => {
        const exists = s.activity.some((a) => a.userId === userId)
        return {
          activity: exists
            ? s.activity.map((a) => (a.userId === userId ? { ...a, isOnline: true } : a))
            : [...s.activity, { userId, isOnline: true, nowPlaying: null, playedAt: null, isListeningNow: false }],
        }
      })
    })

    connection.on('FriendOffline', (userId: string) => {
      useFriendStore.setState((s) => ({
        activity: s.activity.map((a) =>
          a.userId === userId ? { ...a, isOnline: false } : a,
        ),
      }))
    })

    // ── Chat events (pushed by ChatController via this same hub) ──────────────

    // A new direct message — either inbound from a friend, or an echo of my own
    // send (for multi-tab sync). If E2E encryption is enabled later, decrypt here.
    connection.on('ChatMessage', (message: ChatMessage) => {
      useChatStore.getState().receiveMessage(message)
      const me = useAuthStore.getState().user?.id
      if (message.recipientId === me) void chatService.markDelivered()
    })

    // A friend's client acknowledged receipt: one grey tick becomes two.
    connection.on('ChatDelivered', (recipientUserId: string, deliveredAt: string) => {
      useChatStore.getState().applyDelivered(recipientUserId, deliveredAt)
    })

    // A friend read my messages — update ✓✓ read receipts live.
    connection.on('ChatRead', (readerUserId: string, readAt: string) => {
      useChatStore.getState().applyRead(readerUserId, readAt)
    })

    // Another of my own tabs marked a conversation read — clear badges here too.
    connection.on('ChatReadSelf', (partnerUserId: string) => {
      useChatStore.getState().applyReadSelf(partnerUserId)
    })

    // A new in-app notification arrived — refresh the bell list/badge.
    connection.on('NotificationReceived', (notification?: AppNotification) => {
      if (notification) {
        if (import.meta.env.DEV) {
          console.info('[Presence] NotificationReceived', notification.type, notification.title)
        }
        useNotificationStore.getState().receive(notification)
        fireOsNotification(notification)
      }
      void useNotificationStore.getState().fetch()
    })

    // This refresh-cookie session logged out from another app subdomain.
    connection.on('AuthSessionEnded', () => {
      ;(window as { __authToken?: string }).__authToken = undefined
      useAuthStore.setState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: false,
      })
      window.location.reload()
    })

    // ── Lifecycle ──────────────────────────────────────────────────────────

    connection
      .start()
      .then(() => chatService.markDelivered())
      .catch((err) => console.warn('[Presence] connection failed:', err))

    connectionRef.current = connection

    return () => {
      connection.stop()
      connectionRef.current = null
    }
  }, [isAuthenticated, accessToken])
}
