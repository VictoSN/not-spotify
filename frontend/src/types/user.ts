export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  plan: 'free' | 'premium'
  country: string
  createdAt: string
}

export interface UserRef {
  id: string
  name: string
  avatarUrl: string | null
}
