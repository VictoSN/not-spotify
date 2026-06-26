import type { ArtistRef } from './artist'

export interface MusicVideo {
  id: string
  title: string
  description: string | null
  artist: ArtistRef
  trackId: string | null
  videoUrl: string
  thumbnailUrl: string | null
  durationMs: number
  viewCount: number
  createdAt: string
}
