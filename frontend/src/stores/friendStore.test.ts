import { describe, it, expect, beforeEach } from 'vitest'
import { useFriendStore } from './friendStore'
import { useAuthStore } from './authStore'
import type { Friend, FriendActivity } from '@/types/friend'

const friend = (over: Partial<Friend>): Friend => ({
  userId: 'a',
  name: 'Alice',
  avatarUrl: null,
  mutualFriendsCount: 0,
  ...over,
})

const activity = (over: Partial<FriendActivity>): FriendActivity => ({
  userId: 'a',
  isOnline: false,
  nowPlaying: null,
  playedAt: null,
  isListeningNow: false,
  ...over,
})

beforeEach(() => {
  useFriendStore.setState({
    friends: [],
    requests: [],
    activity: [],
    suggestions: [],
    isLoading: false,
    lastActivityFetch: 0,
  })
})

describe('friendStore.getFriendsWithActivity', () => {
  it('merges activity into friends and defaults missing entries to offline', () => {
    useFriendStore.setState({
      friends: [friend({ userId: 'a' }), friend({ userId: 'b', name: 'Bob' })],
      activity: [activity({ userId: 'a', isOnline: true, isListeningNow: true })],
    })

    const merged = useFriendStore.getState().getFriendsWithActivity()
    const a = merged.find((f) => f.userId === 'a')!
    const b = merged.find((f) => f.userId === 'b')!

    expect(a.isOnline).toBe(true)
    expect(a.isListeningNow).toBe(true)
    expect(b.isOnline).toBe(false)
    expect(b.isListeningNow).toBe(false)
    expect(b.nowPlaying).toBeNull()
  })

  it('preserves the friends ordering', () => {
    useFriendStore.setState({
      friends: [friend({ userId: 'a' }), friend({ userId: 'b' }), friend({ userId: 'c' })],
      activity: [],
    })
    expect(useFriendStore.getState().getFriendsWithActivity().map((f) => f.userId)).toEqual(['a', 'b', 'c'])
  })
})

describe('friendStore logout reset', () => {
  it('clears all friend state when the user logs out', () => {
    useFriendStore.setState({ friends: [friend({ userId: 'a' })], suggestions: [] })
    // Simulate an authenticated → unauthenticated transition.
    useAuthStore.setState({ isAuthenticated: true } as never)
    useAuthStore.setState({ isAuthenticated: false } as never)

    expect(useFriendStore.getState().friends).toEqual([])
    expect(useFriendStore.getState().requests).toEqual([])
    expect(useFriendStore.getState().activity).toEqual([])
  })
})
