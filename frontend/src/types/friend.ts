import type { Track } from './track'
import type { UserRef } from './user'
import type { Playlist } from './playlist'

export type PlaylistVisibility = 'public' | 'friends' | 'private'

export type FriendshipStatus = 'pending' | 'accepted' | 'declined'

export interface FriendRequest {
  id: string
  fromUser: UserRef
  toUser: UserRef
  status: FriendshipStatus
  createdAt: string
}

export interface Friend {
  userId: string
  name: string
  avatarUrl: string | null
  mutualFriendsCount: number
}

export interface FriendSuggestion {
  id: string
  name: string
  avatarUrl: string | null
  mutualFriendsCount: number
}

export interface MutualFriend {
  userId: string
  name: string
  avatarUrl: string | null
}

export interface FriendActivity {
  userId: string
  isOnline: boolean
  nowPlaying: Track | null
}

export interface FriendWithActivity extends Friend {
  isOnline: boolean
  nowPlaying: Track | null
}

export interface UserSearchResult {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  mutualFriendsCount: number
}

export interface PublicUserProfile {
  id: string
  name: string
  avatarUrl: string | null
  createdAt: string
  mutualFriendsCount: number
}

// Re-export for convenience so callers can import from one place
export type { UserRef, Playlist }
