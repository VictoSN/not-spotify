import { create } from 'zustand'
import type { User } from '@/types/user'
import { authService } from '@/services/authService'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitializing: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  clearError: () => void
  hydrateFromCookie: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  isInitializing: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { accessToken, user } = await authService.login({ email, password })
      ;(window as { __authToken?: string }).__authToken = accessToken
      set({ user, accessToken, isAuthenticated: true, isLoading: false })
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response?.data
      const msg = data?.errors?.join(' ') ?? data?.message ?? (err instanceof Error ? err.message : 'Login failed')
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { accessToken, user } = await authService.signup({ name, email, password })
      ;(window as { __authToken?: string }).__authToken = accessToken
      set({ user, accessToken, isAuthenticated: true, isLoading: false })
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response?.data
      const msg = data?.errors?.join(' ') ?? data?.message ?? (err instanceof Error ? err.message : 'Signup failed')
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  logout: async () => {
    try { await authService.logout() } catch { /* ignore */ }
    ;(window as { __authToken?: string }).__authToken = undefined
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
    window.location.reload()
  },

  refreshToken: async () => {
    try {
      const { accessToken, user } = await authService.refresh()
      ;(window as { __authToken?: string }).__authToken = accessToken
      set({ user, accessToken, isAuthenticated: true })
    } catch {
      set({ user: null, accessToken: null, isAuthenticated: false })
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user, isAuthenticated: true }),

  hydrateFromCookie: async () => {
    set({ isLoading: true })
    try {
      const { accessToken, user } = await authService.refresh()
      ;(window as { __authToken?: string }).__authToken = accessToken
      set({ user, accessToken, isAuthenticated: true, isLoading: false, isInitializing: false })
    } catch {
      set({ isLoading: false, isInitializing: false })
    }
  },
}))
