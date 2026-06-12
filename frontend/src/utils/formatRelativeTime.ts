/**
 * Compact "time ago" for activity feeds: "now", "4 min", "2 hr", "3 d", "2 w".
 * Mirrors Spotify's friend-activity timestamps — short, no "ago" suffix.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d`

  const weeks = Math.floor(days / 7)
  return `${weeks} w`
}
