import type { Friend, FriendRequest, FriendActivity, UserSearchResult, PublicUserProfile, FriendSuggestion, MutualFriend, FollowUser } from '@/types/friend'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
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

  async getBlend(userId: string, limit = 30): Promise<Track[]> {
    const res = await api.get<Track[]>(`/friends/${userId}/blend`, { params: { limit } })
    return res.data
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

  // ── Asymmetric follows ────────────────────────────────────────────────────

  async follow(userId: string): Promise<void> {
    await api.post(`/users/${userId}/follow`)
  },

  async unfollow(userId: string): Promise<void> {
    await api.delete(`/users/${userId}/follow`)
  },

  async getFollowers(userId: string): Promise<FollowUser[]> {
    const res = await api.get<FollowUser[]>(`/users/${userId}/followers`)
    return res.data
  },

  async getFollowing(userId: string): Promise<FollowUser[]> {
    const res = await api.get<FollowUser[]>(`/users/${userId}/following`)
    return res.data
  },

  async getUserTopTracks(userId: string, days = 30): Promise<Track[]> {
    const res = await api.get<Track[]>(`/users/${userId}/top-tracks`, { params: { days } })
    return res.data
  },
}
