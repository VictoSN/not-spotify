import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the service the store talks to — these are unit tests, no network.
vi.mock('@/services/authService', () => ({
  authService: {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}))

import { useAuthStore } from './authStore'
import { authService } from '@/services/authService'

const mocked = authService as unknown as {
  login: ReturnType<typeof vi.fn>
  signup: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
  refresh: ReturnType<typeof vi.fn>
}

const reset = () =>
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    isInitializing: false,
    error: null,
  })

beforeEach(() => {
  vi.clearAllMocks()
  reset()
  ;(window as { __authToken?: string }).__authToken = undefined
})

describe('authStore', () => {
  it('login stores the user, token and authenticated flag', async () => {
    mocked.login.mockResolvedValue({ accessToken: 'tok-123', user: { id: 'u1', name: 'Me' } })

    await useAuthStore.getState().login('me@test', 'pw')

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(true)
    expect(s.accessToken).toBe('tok-123')
    expect(s.user?.id).toBe('u1')
    expect(s.isLoading).toBe(false)
    expect(s.error).toBeNull()
    expect((window as { __authToken?: string }).__authToken).toBe('tok-123')
  })

  it('login surfaces a server error message and rethrows', async () => {
    mocked.login.mockRejectedValue({ response: { data: { message: 'Bad credentials' } } })

    await expect(useAuthStore.getState().login('me@test', 'wrong')).rejects.toBeTruthy()

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(s.error).toBe('Bad credentials')
    expect(s.isLoading).toBe(false)
  })

  it('login joins validation errors into the error message', async () => {
    mocked.login.mockRejectedValue({ response: { data: { errors: ['Email required', 'Password too short'] } } })

    await expect(useAuthStore.getState().login('', '')).rejects.toBeTruthy()

    expect(useAuthStore.getState().error).toBe('Email required Password too short')
  })

  it('refreshToken hydrates the session on success', async () => {
    mocked.refresh.mockResolvedValue({ accessToken: 'tok-refresh', user: { id: 'u2', name: 'You' } })

    await useAuthStore.getState().refreshToken()

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(true)
    expect(s.accessToken).toBe('tok-refresh')
    expect(s.user?.id).toBe('u2')
  })

  it('refreshToken clears the session on failure', async () => {
    useAuthStore.setState({ user: { id: 'stale' } as never, accessToken: 'old', isAuthenticated: true })
    mocked.refresh.mockRejectedValue(new Error('401'))

    await useAuthStore.getState().refreshToken()

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(s.user).toBeNull()
    expect(s.accessToken).toBeNull()
  })

  it('logout clears state and the in-memory token immediately', async () => {
    useAuthStore.setState({ user: { id: 'me' } as never, accessToken: 'tok', isAuthenticated: true })
    ;(window as { __authToken?: string }).__authToken = 'tok'
    mocked.logout.mockResolvedValue(undefined)
    // logout() calls window.location.reload() — stub it in jsdom.
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })

    await useAuthStore.getState().logout()

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(s.user).toBeNull()
    expect(s.accessToken).toBeNull()
    expect((window as { __authToken?: string }).__authToken).toBeUndefined()
    expect(reload).toHaveBeenCalled()
  })
})
