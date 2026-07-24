import type { ArtistRef } from './artist'
import type { AlbumRef } from './album'

export interface Track {
  id: string
  title: string
  durationMs: number
  audioUrl: string
  previewUrl: string | null
  trackNumber: number
  discNumber: number
  explicit: boolean
  playCount: number
  ratingCount: number
  averageRating: number
  myRating?: number | null
  savedCount?: number
  artist: ArtistRef
  album: AlbumRef
  genres: string[]
  createdAt: string
  isSaved?: boolean
  /** Set when this Track is actually a podcast episode (via {@link episodeToTrack}).
   *  Lets the player/menus route the "creator" link to the show page instead of a
   *  non-existent /artist/{id} (podcast authors aren't artist entities). */
  podcastId?: string
  /** A personal locker item, not a public catalogue track. Player surfaces must not
   * link its synthetic artist and album ids to public routes. */
  isPrivateUpload?: boolean
  status?: 'approved' | 'pending' | 'rejected'
  reviewNote?: string | null
  lyrics?: string | null
  waveform?: number[] | null
}

export interface UserRef {
  id: string
  name: string
  avatarUrl: string | null
}

export interface TrackComment {
  id: string
  trackId: string
  user: UserRef
  body: string
  parentId: string | null
  timestampMs: number | null
  createdAt: string
}
