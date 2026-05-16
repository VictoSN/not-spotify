import type { Track } from './track'
import type { UserRef } from './user'

export interface PlaylistTrack {
  track: Track
  addedAt: string
  addedBy: UserRef
}

export interface Playlist {
  id: string
  name: string
  description: string | null
  coverUrl: string | null
  isPublic: boolean
  owner: UserRef
  tracks: PlaylistTrack[]
  followerCount: number
  totalDurationMs: number
  createdAt: string
  updatedAt: string
}
