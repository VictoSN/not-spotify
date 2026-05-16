import type { User } from '@/types/user'
import type { ApiResponse } from '@/types/api'
import { api, delay, USE_MOCK } from './api'
import { mockUser } from '@/mock/users'

interface LoginPayload { email: string; password: string }
interface SignupPayload { name: string; email: string; password: string }
interface AuthTokens { accessToken: string; user: User }

export const authService = {
  async login(payload: LoginPayload): Promise<AuthTokens> {
    if (USE_MOCK) {
      await delay(600)
      if (payload.password.length < 6) throw new Error('Invalid credentials')
      return { accessToken: 'mock-token-xyz', user: mockUser }
    }
    const res = await api.post<ApiResponse<AuthTokens>>('/auth/login', payload)
    return res.data.data
  },

  async signup(payload: SignupPayload): Promise<AuthTokens> {
    if (USE_MOCK) {
      await delay(800)
      return { accessToken: 'mock-token-xyz', user: { ...mockUser, name: payload.name, email: payload.email } }
    }
    const res = await api.post<ApiResponse<AuthTokens>>('/auth/signup', payload)
    return res.data.data
  },

  async logout(): Promise<void> {
    if (USE_MOCK) { await delay(200); return }
    await api.post('/auth/logout')
  },

  async refresh(): Promise<AuthTokens> {
    if (USE_MOCK) {
      await delay(200)
      return { accessToken: 'mock-token-xyz', user: mockUser }
    }
    const res = await api.post<ApiResponse<AuthTokens>>('/auth/refresh')
    return res.data.data
  },
}
