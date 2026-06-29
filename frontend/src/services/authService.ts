import type { User } from '@/types/user'
import { api } from './api'

interface LoginPayload { email: string; password: string }
interface SignupPayload { name: string; email: string; password: string }
interface AuthTokens { accessToken: string; user: User }
export interface ExternalAuthProviderState {
  enabled: boolean
  configured: boolean
  available: boolean
}

export interface ExternalAuthProviders {
  google: ExternalAuthProviderState
  facebook: ExternalAuthProviderState
  apple: ExternalAuthProviderState
}

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

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthTokens> {
    // Backend rotates the session on success and returns a fresh { accessToken, user }.
    const res = await api.post<AuthTokens>('/auth/change-password', { currentPassword, newPassword })
    return res.data
  },

  async forgotPassword(email: string): Promise<{ message: string; code?: string | null; resetUrl?: string | null }> {
    const res = await api.post<{ message: string; code?: string | null; resetUrl?: string | null }>('/auth/forgot-password', { email })
    return res.data
  },

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { email, code, newPassword })
  },

  async externalProviders(): Promise<ExternalAuthProviders> {
    const res = await api.get<ExternalAuthProviders>('/auth/external/providers')
    return res.data
  },
}
