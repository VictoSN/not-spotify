export interface ArtistRef {
  id: string
  name: string
  imageUrl: string | null
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

export interface TourDate {
  id: string
  eventDate: string
  city: string
  venue: string
  country: string
  ticketUrl: string | null
}
