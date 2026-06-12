import { create } from 'zustand'
import type { Friend, FriendRequest, FriendActivity, FriendWithActivity, FriendSuggestion } from '@/types/friend'
import { friendService } from '@/services/friendService'
import { useAuthStore } from './authStore'

interface FriendState {
  friends: Friend[]
  requests: FriendRequest[]
  activity: FriendActivity[]
  suggestions: FriendSuggestion[]
  isLoading: boolean
  lastActivityFetch: number

  fetchFriends: () => Promise<void>
  fetchRequests: () => Promise<void>
  fetchActivity: () => Promise<void>
  fetchSuggestions: () => Promise<void>
  sendRequest: (userId: string) => Promise<void>
  acceptRequest: (requestId: string) => Promise<void>
  declineRequest: (requestId: string) => Promise<void>
  unfriend: (userId: string) => Promise<void>

  // Merges friends list with latest activity data.
  getFriendsWithActivity: () => FriendWithActivity[]
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  requests: [],
  activity: [],
  suggestions: [],
  isLoading: false,
  lastActivityFetch: 0,

  fetchFriends: async () => {
    set({ isLoading: true })
    try {
      const friends = await friendService.getFriends()
      set({ friends })
    } catch {
      // silently ignore — network blip or backend not yet live
    } finally {
      set({ isLoading: false })
    }
  },

  fetchRequests: async () => {
    try {
      const requests = await friendService.getRequests()
      set({ requests })
    } catch {
      /* ignore */
    }
  },

  fetchActivity: async () => {
    try {
      const activity = await friendService.getActivity()
      set({ activity, lastActivityFetch: Date.now() })
    } catch {
      /* ignore */
    }
  },

  fetchSuggestions: async () => {
    try {
      const suggestions = await friendService.getSuggestions()
      set({ suggestions })
    } catch {
      /* ignore */
    }
  },

  sendRequest: async (userId) => {
    await friendService.sendRequest(userId)
  },

  acceptRequest: async (requestId) => {
    await friendService.respondToRequest(requestId, 'accept')
    // Remove from pending requests; refresh friends list to include the new friend.
    set((s) => ({ requests: s.requests.filter((r) => r.id !== requestId) }))
    await get().fetchFriends()
  },

  declineRequest: async (requestId) => {
    await friendService.respondToRequest(requestId, 'decline')
    set((s) => ({ requests: s.requests.filter((r) => r.id !== requestId) }))
  },

  unfriend: async (userId) => {
    await friendService.unfriend(userId)
    set((s) => ({ friends: s.friends.filter((f) => f.userId !== userId) }))
  },

  getFriendsWithActivity: () => {
    const { friends, activity } = get()
    const activityMap = new Map(activity.map((a) => [a.userId, a]))
    return friends.map((f) => {
      const a = activityMap.get(f.userId)
      return {
        ...f,
        isOnline: a?.isOnline ?? false,
        nowPlaying: a?.nowPlaying ?? null,
        playedAt: a?.playedAt ?? null,
        isListeningNow: a?.isListeningNow ?? false,
      }
    })
  },
}))

// Clear all friend state the moment the user logs out — same pattern as libraryStore.
useAuthStore.subscribe((state, prev) => {
  if (!prev.isAuthenticated || state.isAuthenticated) return
  useFriendStore.setState({
    friends: [],
    requests: [],
    activity: [],
    suggestions: [],
    isLoading: false,
    lastActivityFetch: 0,
  })
})
