/**
 * Persistence for the user's manual ("Custom" sort) ordering of sidebar library
 * items, mirroring the pinned-library pattern: a localStorage array of item keys
 * plus a window event so every mounted sidebar / tab stays in sync.
 *
 * Drag-reorder uses a dedicated MIME so it never collides with the content
 * save-drops (track/album/artist/…) handled by useLibraryDrop / useTrackDrop.
 */
const STORAGE_KEY = 'ns-library-order'
export const LIBRARY_ORDER_EVENT = 'ns-library-order-change'
export const LIBRARY_REORDER_MIME = 'application/x-ns-library-reorder'

export function getCustomOrder(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

export function setCustomOrder(keys: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    /* storage unavailable — ignore, order simply won't persist */
  }
  window.dispatchEvent(new CustomEvent(LIBRARY_ORDER_EVENT))
}

/**
 * Returns a new key ordering with `fromKey` moved to just before/after `toKey`,
 * computed over the currently displayed `keys`. Returns the input unchanged when
 * either key is missing or the move is a no-op.
 */
export function reorderKeys(keys: string[], fromKey: string, toKey: string, before: boolean): string[] {
  if (fromKey === toKey) return keys
  const from = keys.indexOf(fromKey)
  const target = keys.indexOf(toKey)
  if (from < 0 || target < 0) return keys
  const next = [...keys]
  next.splice(from, 1)
  // Recompute the target index after removal, then place before/after it.
  let insertAt = next.indexOf(toKey)
  if (!before) insertAt += 1
  next.splice(insertAt, 0, fromKey)
  return next
}
