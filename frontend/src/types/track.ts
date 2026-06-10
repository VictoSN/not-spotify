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
  status?: 'approved' | 'pending' | 'rejected'
  reviewNote?: string | null
}
