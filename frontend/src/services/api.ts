import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token from auth store on every request
api.interceptors.request.use((config) => {
  // Dynamic import avoids circular dependency; store is resolved at call time
  const token = (window as { __authToken?: string }).__authToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 attempt a token refresh, then retry once
let isRefreshing = false
let queue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const isAuthEndpoint = original.url?.includes('/auth/refresh') ||
                           original.url?.includes('/auth/login') ||
                           original.url?.includes('/auth/signup')

    if (error.response?.status !== 401 || original._retry || isAuthEndpoint) throw error

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
        { withCredentials: true },
      )
      const newToken = res.data.accessToken
      ;(window as { __authToken?: string }).__authToken = newToken
      queue.forEach((cb) => cb(newToken))
      queue = []
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch {
      queue = []
      window.location.href = '/login'
      throw error
    } finally {
      isRefreshing = false
    }
  },
)

