// Per-account recent searches, persisted in localStorage. No backend endpoint
// exists for this, so it is scoped to the browser and keyed by the user id.

const MAX = 8
const key = (userId: string) => `ns-recent-searches:${userId}`

export function getRecentSearches(userId: string | undefined): string[] {
  if (!userId || typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key(userId))
    if (!raw) return []
    const arr: unknown = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function addRecentSearch(userId: string | undefined, term: string): string[] {
  if (!userId || typeof window === 'undefined') return getRecentSearches(userId)
  const t = term.trim()
  if (!t) return getRecentSearches(userId)
  const existing = getRecentSearches(userId).filter((x) => x.toLowerCase() !== t.toLowerCase())
  const next = [t, ...existing].slice(0, MAX)
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(next))
  } catch {
    /* ignore storage failures */
  }
  return next
}

export function removeRecentSearch(userId: string | undefined, term: string): string[] {
  if (!userId || typeof window === 'undefined') return getRecentSearches(userId)
  const next = getRecentSearches(userId).filter((x) => x.toLowerCase() !== term.toLowerCase())
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(next))
  } catch {
    /* ignore storage failures */
  }
  return next
}

export function clearRecentSearches(userId: string | undefined): void {
  if (!userId || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key(userId))
  } catch {
    /* ignore storage failures */
  }
}
