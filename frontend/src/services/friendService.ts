import type { Friend, FriendRequest, FriendActivity, UserSearchResult, PublicUserProfile, FriendSuggestion, MutualFriend } from '@/types/friend'
import type { Playlist } from '@/types/playlist'
import { api } from './api'

export const friendService = {
  async getFriends(): Promise<Friend[]> {
    const res = await api.get<Friend[]>('/friends')
    return res.data
  },

  async getRequests(): Promise<FriendRequest[]> {
    const res = await api.get<FriendRequest[]>('/friends/requests')
    return res.data
  },

  async sendRequest(userId: string): Promise<void> {
    await api.post('/friends/requests', { userId })
  },

  async respondToRequest(requestId: string, action: 'accept' | 'decline'): Promise<void> {
    await api.patch(`/friends/requests/${requestId}`, { action })
  },

  async unfriend(userId: string): Promise<void> {
    await api.delete(`/friends/${userId}`)
  },

  async getActivity(): Promise<FriendActivity[]> {
    const res = await api.get<FriendActivity[]>('/friends/activity')
    return res.data
  },

  async searchUsers(q: string): Promise<UserSearchResult[]> {
    const res = await api.get<UserSearchResult[]>('/users/search', { params: { q } })
    return res.data
  },

  async getUserProfile(userId: string): Promise<PublicUserProfile> {
    const res = await api.get<PublicUserProfile>(`/users/${userId}`)
    return res.data
  },

  async getUserPlaylists(userId: string): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>(`/users/${userId}/playlists`)
    return res.data
  },

  async getMutualFriends(userId: string): Promise<MutualFriend[]> {
    const res = await api.get<MutualFriend[]>(`/friends/mutual/${userId}`)
    return res.data
  },

  async getSuggestions(): Promise<FriendSuggestion[]> {
    const res = await api.get<FriendSuggestion[]>('/friends/suggestions')
    return res.data
  },
}
