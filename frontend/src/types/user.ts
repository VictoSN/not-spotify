export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  plan: 'free' | 'premium'
  country: string
  createdAt: string
  roles: string[]
  subscriptionStatus: string | null
  subscriptionInterval: 'monthly' | 'yearly' | null
  subscriptionCurrentPeriodEnd: string | null
  subscriptionCancelAtPeriodEnd: boolean
  capabilities: {
    unlimitedPlayback: boolean
    customPlaylistPictures: boolean
  }
}

export interface UserRef {
  id: string
  name: string
  avatarUrl: string | null
}
