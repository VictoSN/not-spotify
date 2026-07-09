import type { User } from '@/types/user'

/*
 * Offline-session cache.
 *
 * Auth is normally memory-only and re-validated against the server on every
 * load (authStore.hydrateFromCookie → /auth/refresh). That means a reload with
 * no network logs the user out — fatal for the desktop app's offline mode,
 * where saved music should stay reachable without a connection.
 *
 * To survive that, we mirror the last known-good `user` into localStorage on
 * every successful auth. When a refresh fails *because of the network* (not a
 * 401), the desktop app restores this cached user and enters `offlineMode`
 * instead of logging out. It is cleared on real logout / 401 so a signed-out
 * session never lingers.
 *
 * This holds no secret: the access token is never persisted, and every
 * privileged API call still requires a fresh server-issued token once online.
 */

const KEY = 'ns-offline-session'

export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function setCachedUser(user: User): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user))
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
}

export function clearCachedUser(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/**
 * True when an auth failure looks like a connectivity problem rather than a
 * rejected credential. Axios only populates `response` when the server actually
 * answered; a network error, DNS failure or timeout leaves it undefined. We
 * deliberately treat "no response" as offline so a flaky connection keeps the
 * user signed in rather than bouncing them to the login screen.
 */
export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const e = err as { response?: unknown } | null | undefined
  return !e || e.response == null
}
