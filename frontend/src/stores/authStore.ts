import { create } from 'zustand'
import type { User } from '@/types/user'
import { authService } from '@/services/authService'
import type { SignupStartResult } from '@/services/authService'
import { isDesktop } from '@/utils/platform'
import {
  clearCachedUser,
  getCachedUser,
  isOfflineError,
  setCachedUser,
} from '@/utils/offlineSession'

const DESKTOP_OFFLINE_BOOT_MS = 350
const DESKTOP_CONNECTIVITY_POLL_MS = 4_000
const DESKTOP_CONNECTIVITY_TIMEOUT_MS = 2_500

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitializing: boolean
  /**
   * True when the session was restored from the offline cache because the
   * server was unreachable — i.e. we trust a stale `user` but hold no fresh
   * access token. The UI uses this to switch into a scoped, network-free mode.
   */
  offlineMode: boolean
  error: string | null

  login: (email: string, password: string, captchaToken?: string | null) => Promise<void>
  signup: (name: string, email: string, password: string, captchaToken?: string | null) => Promise<SignupStartResult>
  verifySignup: (email: string, code: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: (options?: { preserveOffline?: boolean }) => Promise<void>
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
  offlineMode: false,
  error: null,

  login: async (email, password, captchaToken) => {
    set({ isLoading: true, error: null })
    try {
      const { accessToken, user } = await authService.login({ email, password, captchaToken })
      ;(window as { __authToken?: string }).__authToken = accessToken
      setCachedUser(user)
      set({ user, accessToken, isAuthenticated: true, isLoading: false, offlineMode: false })
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response?.data
      const msg = data?.errors?.join(' ') ?? data?.message ?? (err instanceof Error ? err.message : 'Login failed')
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  signup: async (name, email, password, captchaToken) => {
    set({ isLoading: true, error: null })
    try {
      const result = await authService.signup({ name, email, password, captchaToken })
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
      setCachedUser(user)
      set({ user, accessToken, isAuthenticated: true, isLoading: false, offlineMode: false })
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
    setCachedUser(user)
    set({ user, accessToken, isAuthenticated: true, offlineMode: false })
  },

  logout: async () => {
    // Clear auth state immediately so UI re-renders (sidebar empties) before the API call.
    ;(window as { __authToken?: string }).__authToken = undefined
    clearCachedUser()
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false, offlineMode: false })
    try { await authService.logout() } catch { /* ignore */ }
    window.location.reload()
  },

  refreshToken: async (options) => {
    try {
      const { accessToken, user } = await authService.refresh()
      ;(window as { __authToken?: string }).__authToken = accessToken
      setCachedUser(user)
      set({ user, accessToken, isAuthenticated: true, offlineMode: false })
    } catch (err) {
      // Offline on the desktop app: keep the cached session rather than logging
      // out. A genuine 401 (server reachable, credential rejected) still clears.
      const cached = getCachedUser()
      if (isDesktop() && cached && (isOfflineError(err) || options?.preserveOffline)) {
        set({ user: cached, accessToken: null, isAuthenticated: true, offlineMode: true })
        return
      }
      clearCachedUser()
      set({ user: null, accessToken: null, isAuthenticated: false, offlineMode: false })
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user, isAuthenticated: true }),

  hydrateFromCookie: async () => {
    set({ isLoading: true })
    const cached = getCachedUser()
    const canBootFromCache = isDesktop() && !!cached
    let cacheBooted = false
    let cacheBootTimer: number | undefined

    const bootCachedOffline = () => {
      if (!cached || cacheBooted) return
      cacheBooted = true
      set({
        user: cached,
        accessToken: null,
        isAuthenticated: true,
        isLoading: false,
        isInitializing: false,
        offlineMode: true,
      })
    }

    if (canBootFromCache && typeof navigator !== 'undefined' && navigator.onLine === false) {
      bootCachedOffline()
      return
    }

    if (canBootFromCache && typeof window !== 'undefined') {
      cacheBootTimer = window.setTimeout(bootCachedOffline, DESKTOP_OFFLINE_BOOT_MS)
    }

    const clearCacheBootTimer = () => {
      if (cacheBootTimer == null || typeof window === 'undefined') return
      window.clearTimeout(cacheBootTimer)
      cacheBootTimer = undefined
    }

    try {
      const { accessToken, user } = await authService.refresh()
      clearCacheBootTimer()
      ;(window as { __authToken?: string }).__authToken = accessToken
      setCachedUser(user)
      set({ user, accessToken, isAuthenticated: true, isLoading: false, isInitializing: false, offlineMode: false })
    } catch (err) {
      clearCacheBootTimer()
      // Desktop app started with no network: restore the last known-good user
      // from cache and enter offline mode so saved music stays reachable.
      if (isDesktop() && isOfflineError(err) && cached) {
        bootCachedOffline()
        set({ isLoading: false, isInitializing: false })
        return
      }
      // Real logout / 401: drop any stale cache so a signed-out session can't linger.
      if (!isOfflineError(err)) clearCachedUser()
      set({ isLoading: false, isInitializing: false, offlineMode: false })
    }
  },
}))

function enterOfflineModeFromCache(): boolean {
  const cached = getCachedUser()
  if (!isDesktop() || !cached) return false
  ;(window as { __authToken?: string }).__authToken = undefined
  useAuthStore.setState({
    user: cached,
    accessToken: null,
    isAuthenticated: true,
    isLoading: false,
    isInitializing: false,
    offlineMode: true,
  })
  return true
}

async function isApiReachable(): Promise<boolean> {
  const baseUrl = import.meta.env.VITE_API_URL
  if (!baseUrl) return typeof navigator === 'undefined' || navigator.onLine !== false

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), DESKTOP_CONNECTIVITY_TIMEOUT_MS)
  try {
    const root = String(baseUrl).replace(/\/+$/, '')
    await fetch(`${root}/auth/me`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
    return true
  } catch {
    return false
  } finally {
    window.clearTimeout(timeout)
  }
}

// Tauri's webview does not always emit browser online/offline events, so pair
// the events with a tiny reachability probe. Any HTTP response means "online";
// failed DNS/connection/timeout means "offline".
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    enterOfflineModeFromCache()
  })

  window.addEventListener('online', () => {
    const state = useAuthStore.getState()
    if (state.offlineMode) void state.refreshToken({ preserveOffline: true })
  })

  let probeInFlight = false
  window.setInterval(() => {
    if (!isDesktop() || probeInFlight) return
    const state = useAuthStore.getState()
    const hasCachedSession = !!getCachedUser()
    if (!state.isAuthenticated && !hasCachedSession) return

    probeInFlight = true
    isApiReachable()
      .then((reachable) => {
        const latest = useAuthStore.getState()
        if (!reachable) {
          if (!latest.offlineMode || !latest.isAuthenticated) enterOfflineModeFromCache()
          return
        }
        if (latest.offlineMode || (!latest.isAuthenticated && getCachedUser())) {
          void latest.refreshToken({ preserveOffline: latest.offlineMode })
        }
      })
      .finally(() => {
        probeInFlight = false
      })
  }, DESKTOP_CONNECTIVITY_POLL_MS)
}

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
