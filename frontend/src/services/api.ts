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

// The backend rotates the refresh cookie on every /auth/refresh (single-use tokens),
// and that cookie is shared by every tab of the origin. Two overlapping refreshes race:
// the loser presents an already-rotated token and gets a 401. The Web Locks API gives a
// browser-wide (cross-tab) mutex, so each refresh sees the cookie its predecessor set.
const AUTH_REFRESH_LOCK = 'ns-auth-refresh'

async function postRefresh(): Promise<string> {
  const res = await axios.post<{ accessToken: string }>(
    `${import.meta.env.VITE_API_URL}/auth/refresh`,
    {},
    { withCredentials: true, timeout: 10_000 },
  )
  return res.data.accessToken
}

export async function refreshAccessToken(): Promise<string> {
  const token =
    typeof navigator !== 'undefined' && navigator.locks
      ? await navigator.locks.request(AUTH_REFRESH_LOCK, postRefresh)
      : await postRefresh()
  ;(window as { __authToken?: string }).__authToken = token
  return token
}

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
      const newToken = await refreshAccessToken()
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
