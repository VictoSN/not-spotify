import { create } from 'zustand'
import type { User } from '@/types/user'
import { authService } from '@/services/authService'
import type { SignupStartResult } from '@/services/authService'
import { publishAuthSessionEvent } from '@/components/common/AuthSessionSync'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitializing: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<SignupStartResult>
  verifySignup: (email: string, code: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
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
      await publishAuthSessionEvent('login')
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
      const result = await authService.signup({ name, email, password })
      set({ isLoading: false })
      return result
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response?.data
      const msg = data?.errors?.join(' ') ?? data?.message ?? (err instanceof Error ? err.message : 'Signup failed')
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  verifySignup: async (email, code) => {
    set({ isLoading: true, error: null })
    try {
      const { accessToken, user } = await authService.verifySignup(email, code)
      ;(window as { __authToken?: string }).__authToken = accessToken
      set({ user, accessToken, isAuthenticated: true, isLoading: false })
      await publishAuthSessionEvent('login')
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response?.data
      const msg = data?.errors?.join(' ') ?? data?.message ?? (err instanceof Error ? err.message : 'Verification failed')
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    // Backend revokes other sessions and returns a fresh session for this device;
    // swap in the new access token so the current tab stays authenticated.
    const { accessToken, user } = await authService.changePassword(currentPassword, newPassword)
    ;(window as { __authToken?: string }).__authToken = accessToken
    set({ user, accessToken, isAuthenticated: true })
    await publishAuthSessionEvent('login')
  },

  logout: async () => {
    // Clear auth state immediately so UI re-renders (sidebar empties) before the API call.
    ;(window as { __authToken?: string }).__authToken = undefined
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
    try {
      await authService.logout()
      await publishAuthSessionEvent('logout')
    } catch { /* ignore */ }
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

// Mirror the current plan into localStorage so the (non-React) audio engine can
// enforce the free-tier streaming-quality cap without importing React state.
// Dispatching ns-pref-change makes the engine re-read the (now plan-clamped) quality
// the moment a user logs in, upgrades, or downgrades.
useAuthStore.subscribe((state) => {
  try {
    const plan = state.user?.plan ?? 'free'
    if (window.localStorage.getItem('ns-plan') !== plan) {
      window.localStorage.setItem('ns-plan', plan)
      window.dispatchEvent(new CustomEvent('ns-pref-change', { detail: { key: 'ns-plan', value: plan } }))
    }
  } catch {
    /* ignore */
  }
})
