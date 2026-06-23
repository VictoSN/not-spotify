export interface ArtistRef {
  id: string
  name: string
  imageUrl: string | null
  verified?: boolean
}

export interface Artist {
  id: string
  name: string
  bio: string | null
  imageUrl: string | null
  headerImageUrl: string | null
  monthlyListeners: number
  genres: string[]
  followerCount: number
  verified: boolean
  socialLinks: {
    instagram?: string
    twitter?: string
    website?: string
  }
  createdAt: string
  isRevoked?: boolean
  revocationNote?: string | null
  revokedAt?: string | null
  country?: string | null
}

export interface TourSong {
  trackId: string
  title: string
  artistName: string
  durationMs: number
}

export interface TourDate {
  id: string
  eventDate: string
  city: string
  venue: string
  country: string
  ticketUrl: string | null
  songs: TourSong[]
}
