import type { User } from '@/types/user'
import { api } from './api'

interface LoginPayload { email: string; password: string }
interface SignupPayload { name: string; email: string; password: string }
interface AuthTokens { accessToken: string; user: User }

export const authService = {
  async login(payload: LoginPayload): Promise<AuthTokens> {
    const res = await api.post<AuthTokens>('/auth/login', payload)
    return res.data
  },

  async signup(payload: SignupPayload): Promise<AuthTokens> {
    const res = await api.post<AuthTokens>('/auth/signup', payload)
    return res.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async refresh(): Promise<AuthTokens> {
    // Backend /auth/refresh returns only { accessToken }; fetch user via /auth/me.
    const refreshRes = await api.post<{ accessToken: string }>('/auth/refresh')
    const accessToken = refreshRes.data.accessToken
    ;(window as { __authToken?: string }).__authToken = accessToken
    const meRes = await api.get<User>('/auth/me')
    return { accessToken, user: meRes.data }
  },
}
