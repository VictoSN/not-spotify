import type { ArtistRef } from './artist'

export type AlbumType = 'album' | 'single' | 'ep' | 'compilation'

export interface AlbumRef {
  id: string
  title: string
  coverUrl: string
  releaseDate: string
  type: AlbumType
}

export interface Album {
  id: string
  title: string
  type: AlbumType
  coverUrl: string
  releaseDate: string
  totalTracks: number
  durationMs: number
  artist: ArtistRef
  genres: string[]
  label: string | null
  copyright: string | null
  popularity: number
  status?: 'approved' | 'pending' | 'rejected'
  reviewNote?: string | null
  totalPlays?: number
  averageRating?: number
  ratingCount?: number
  totalSaves?: number
}
