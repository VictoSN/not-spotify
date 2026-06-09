import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '@/stores/authStore'
import { useFriendStore } from '@/stores/friendStore'

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
            : [...s.activity, { userId, isOnline: true, nowPlaying: null }],
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

    // ── Lifecycle ──────────────────────────────────────────────────────────

    connection
      .start()
      .catch((err) => console.warn('[Presence] connection failed:', err))

    connectionRef.current = connection

    return () => {
      connection.stop()
      connectionRef.current = null
    }
  }, [isAuthenticated, accessToken])
}
