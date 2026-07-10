import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { getCachedUser } from '@/utils/offlineSession'
import { isDesktop } from '@/utils/platform'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token from auth store on every request
api.interceptors.request.use((config) => {
  // Dynamic import avoids circular dependency; store is resolved at call time
  const token = (window as { __authToken?: string }).__authToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Marks desktop-shell requests so the backend can skip web-only gates
  // (reCAPTCHA doesn't work inside Tauri's embedded webview).
  if (isDesktop()) config.headers['X-Client-Kind'] = 'desktop'
  return config
})

// On 401 attempt a token refresh, then retry once
let isRefreshing = false
let queue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (!error.response && isDesktop()) {
      const state = useAuthStore.getState()
      const cached = getCachedUser() ?? state.user
      if (cached) {
        ;(window as { __authToken?: string }).__authToken = undefined
        useAuthStore.setState({
          user: cached,
          accessToken: null,
          isAuthenticated: true,
          isLoading: false,
          isInitializing: false,
          offlineMode: true,
        })
      }
    }

    const isAuthEndpoint =
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/signup')

    if (error.response?.status !== 401 || !original || original._retry || isAuthEndpoint) throw error

    if (isRefreshing) {
      return new Promise((resolve) => {
        queue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`
          resolve(api(original))
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const res = await axios.post<{ accessToken: string }>(
        `${import.meta.env.VITE_API_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 10_000 },
      )
      const newToken = res.data.accessToken
      ;(window as { __authToken?: string }).__authToken = newToken
      useAuthStore.setState({ accessToken: newToken })
      queue.forEach((cb) => cb(newToken))
      queue = []
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch {
      queue = []
      throw error
    } finally {
      isRefreshing = false
    }
  },
)
