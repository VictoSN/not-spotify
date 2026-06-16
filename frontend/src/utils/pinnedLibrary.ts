/**
 * Library pinning — a purely client-side ordering layer over the user's saved
 * library. Pinned items float to the top of the sidebar. Persisted in
 * localStorage (no backend / no migration), and changes broadcast on
 * PINNED_EVENT so every open view updates in step (same pattern the ns-pref-*
 * settings already use).
 *
 * Keys match the sidebar's LibItem.key: `pl-<id>` / `al-<id>` / `ar-<id>`.
 */
export const PINNED_STORAGE_KEY = 'ns-library-pinned'
export const PINNED_EVENT = 'ns-pinned-change'

export function getPinnedKeys(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

export function getPinnedSet(): Set<string> {
  return new Set(getPinnedKeys())
}

export function isPinned(key: string): boolean {
  return getPinnedSet().has(key)
}

/** Toggle a key's pinned state. Returns the new state (true = now pinned). */
export function togglePinned(key: string): boolean {
  const keys = getPinnedKeys()
  const nowPinned = !keys.includes(key)
  // Newly pinned items go to the front so the most-recently pinned sits on top.
  const next = nowPinned ? [key, ...keys] : keys.filter((k) => k !== key)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next))
      window.dispatchEvent(new CustomEvent(PINNED_EVENT))
    } catch {
      /* ignore persistence failures */
    }
  }
  return nowPinned
}
