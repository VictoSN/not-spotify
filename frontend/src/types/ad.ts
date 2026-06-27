export interface Ad {
  id: string
  title: string
  advertiser: string
  audioUrl: string
  imageUrl: string | null
  clickUrl: string | null
  durationMs: number
}

export interface AdSettings {
  adsPerNTracks: number
  isEnabled: boolean
}

/** Full ad row as returned to admins — adds targeting, flight window, and stats. */
export interface AdAdmin {
  id: string
  title: string
  advertiser: string
  audioUrl: string
  imageUrl: string | null
  clickUrl: string | null
  durationMs: number
  country: string | null
  weight: number
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  impressionCount: number
  createdAt: string
}

/** Payload for creating/updating an ad (matches the backend `UpsertAdRequest`). */
export interface UpsertAdPayload {
  title: string
  advertiser: string
  audioUrl: string
  audioKey?: string | null
  imageUrl?: string | null
  clickUrl?: string | null
  durationMs?: number
  country?: string | null
  weight?: number
  isActive?: boolean
  startsAt?: string | null
  endsAt?: string | null
}
