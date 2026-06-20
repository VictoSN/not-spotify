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
