import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useFriendStore } from '@/stores/friendStore'
import { useNotificationStore } from '@/stores/notificationStore'

/**
 * Refreshes social data (friends list, pending requests, suggestions, activity)
 * in the background on a low-frequency loop.
 *
 * Online/offline presence is handled instantly by usePresenceSocket (SignalR).
 * This hook is only responsible for keeping the friends list, request counts,
 * and now-playing info reasonably fresh.
 */
export function useFriendPolling() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const fetchActivity = useFriendStore((s) => s.fetchActivity)
  const fetchRequests = useFriendStore((s) => s.fetchRequests)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)
  const fetchSuggestions = useFriendStore((s) => s.fetchSuggestions)
  const fetchNotifications = useNotificationStore((s) => s.fetch)

  useEffect(() => {
    if (!isAuthenticated) return

    // Eager load on auth so data is ready before the panel is opened.
    void fetchFriends()
    void fetchActivity()
    void fetchRequests()
    void fetchSuggestions()
    void fetchNotifications()

    // Refresh every 20 s for now-playing + request/notification badge counts.
    // (Notifications also arrive instantly via the presence socket; this poll
    // is the fallback when the socket is down.)
    const id = setInterval(() => {
      void fetchFriends()
      void fetchActivity()
      void fetchRequests()
      void fetchSuggestions()
      void fetchNotifications()
    }, 20_000)

    return () => clearInterval(id)
  }, [isAuthenticated])
}
