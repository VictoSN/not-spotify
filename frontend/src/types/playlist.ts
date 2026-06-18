import type { Track } from './track'
import type { UserRef } from './user'
import type { PlaylistVisibility } from './friend'

export type { PlaylistVisibility }

export interface SmartPlaylistRules {
  genre?: string | null
  minimumRating?: number | null
  minimumPlayCount?: number | null
  addedWithinDays?: number | null
  limit: number
}

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
  /** Legacy boolean kept for API back-compat. Prefer `visibility`. */
  isPublic: boolean
  /** Three-state visibility. Falls back to isPublic when absent. */
  visibility?: PlaylistVisibility
  /** Admin-curated featured flag for homepage / browse priority. */
  isFeatured?: boolean
  /** Manual ordering weight — lower numbers appear first when featured. */
  sortOrder?: number
  smartRules?: SmartPlaylistRules | null
  owner: UserRef
  collaborators?: UserRef[]
  /** Whether the current user is a collaborator (not the owner). */
  isCollaborator?: boolean
  tracks: PlaylistTrack[]
  followerCount: number
  totalDurationMs: number
  createdAt: string
  updatedAt: string
  isOwner?: boolean
  isSaved?: boolean
}
