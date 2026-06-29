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
  /** Live track when isListeningNow, otherwise the most recently played track. */
  nowPlaying: Track | null
  playedAt: string | null
  isListeningNow: boolean
}

export interface FriendWithActivity extends Friend {
  isOnline: boolean
  nowPlaying: Track | null
  playedAt: string | null
  isListeningNow: boolean
}

export interface UserSearchResult {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  mutualFriendsCount: number
  isArtist: boolean
}

export interface PublicUserProfile {
  id: string
  name: string
  avatarUrl: string | null
  createdAt: string
  mutualFriendsCount: number
  followerCount: number
  followingCount: number
  /** null when viewing your own profile or unauthenticated. */
  isFollowing: boolean | null
}

/** A user in a followers / following list. */
export interface FollowUser {
  id: string
  name: string
  avatarUrl: string | null
  isArtist: boolean
  /** Catalog artist represented by this account, used to avoid duplicate following cards. */
  artistId?: string | null
  isFollowedByMe: boolean
}

// Re-export for convenience so callers can import from one place
export type { UserRef, Playlist }
