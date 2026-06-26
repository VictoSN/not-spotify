/**
 * Browser-notification helpers + a polling loop that mirrors the backend's
 * "new_release" notifications (created by NotifyArtistFollowersOfReleaseAsync
 * when an artist you follow publishes a track or album) into desktop alerts.
 *
 * Settings live in localStorage so SettingsPage can render without round-trips:
 *   - ns-notif-enabled         master switch (also requires Notification.permission === 'granted')
 *   - ns-notif-release-alerts  enable the "new release" desktop alert
 *   - ns-notif-release-seen    last notification id we've already shown, so polls don't re-fire
 */

import { notificationService } from './notificationService'
import { useAuthStore } from '@/stores/authStore'

export const NOTIF_MASTER_KEY = 'ns-notif-enabled'
export const NOTIF_RELEASE_KEY = 'ns-notif-release-alerts'
export const NOTIF_RELEASE_SEEN = 'ns-notif-release-seen'

// Friend activity master + per-type sub-toggles. Defaults are all OFF — the user
// opts in per type so the bell isn't noisy out of the box.
export const NOTIF_FRIEND_KEY = 'ns-notif-friend-activity'
export const NOTIF_FRIEND_SEEN = 'ns-notif-friend-seen'
/** Map sub-toggle key → backend notification type emitted in NotificationService.NotifyAsync. */
export const FRIEND_ACTIVITY_TYPES = {
  'ns-notif-friend-follow': 'new_follower',
  'ns-notif-friend-chat': 'chat_message',
  'ns-notif-friend-playlist-save': 'playlist_saved',
  'ns-notif-friend-jam': 'jam_invite',
} as const
type FriendActivityKey = keyof typeof FRIEND_ACTIVITY_TYPES

const POLL_INTERVAL_MS = 60 * 1000 // 60s — backend creates notifications in real time; this is the catch-up gap.

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

function readBool(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function fireNotification(title: string, body: string, icon?: string | null, link?: string | null) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, icon: icon ?? undefined })
    if (link) {
      n.onclick = () => {
        window.focus()
        window.location.assign(link)
      }
    }
  } catch {
    /* gesture / quota — ignore */
  }
}

async function pollNewReleases() {
  if (!useAuthStore.getState().isAuthenticated) return
  if (!readBool(NOTIF_MASTER_KEY) || !readBool(NOTIF_RELEASE_KEY)) return
  if (notificationPermission() !== 'granted') return

  let lastSeen: string | null = null
  try {
    lastSeen = window.localStorage.getItem(NOTIF_RELEASE_SEEN)
  } catch { /* ignore */ }

  let list
  try {
    list = await notificationService.list()
  } catch {
    return
  }

  // Backend returns newest-first; iterate oldest → newest so notifications fire in order.
  const releases = list.items
    .filter((n) => n.type === 'new_release')
    .slice()
    .reverse()

  let newestId: string | null = lastSeen
  let seenLast = lastSeen == null
  for (const item of releases) {
    if (!seenLast) {
      if (item.id === lastSeen) seenLast = true
      continue
    }
    fireNotification(item.title, item.body ?? '', item.imageUrl, item.linkUrl)
    newestId = item.id
  }

  // First run: anchor to the newest existing release notification so we don't
  // replay the whole backlog on next poll.
  if (lastSeen == null && releases.length > 0) {
    newestId = releases[releases.length - 1].id
  }

  if (newestId && newestId !== lastSeen) {
    try {
      window.localStorage.setItem(NOTIF_RELEASE_SEEN, newestId)
    } catch { /* ignore */ }
  }
}

function enabledFriendTypes(): Set<string> {
  const out = new Set<string>()
  for (const [key, type] of Object.entries(FRIEND_ACTIVITY_TYPES) as Array<[FriendActivityKey, string]>) {
    if (readBool(key)) out.add(type)
  }
  return out
}

async function pollFriendActivity() {
  if (!useAuthStore.getState().isAuthenticated) return
  if (!readBool(NOTIF_MASTER_KEY) || !readBool(NOTIF_FRIEND_KEY)) return
  if (notificationPermission() !== 'granted') return

  const enabled = enabledFriendTypes()
  if (enabled.size === 0) return

  let lastSeen: string | null = null
  try { lastSeen = window.localStorage.getItem(NOTIF_FRIEND_SEEN) } catch { /* ignore */ }

  let list
  try { list = await notificationService.list() } catch { return }

  const activity = list.items
    .filter((n) => enabled.has(n.type))
    .slice()
    .reverse()

  let newestId: string | null = lastSeen
  let seenLast = lastSeen == null
  for (const item of activity) {
    if (!seenLast) {
      if (item.id === lastSeen) seenLast = true
      continue
    }
    fireNotification(item.title, item.body ?? '', item.imageUrl, item.linkUrl)
    newestId = item.id
  }

  if (lastSeen == null && activity.length > 0) {
    newestId = activity[activity.length - 1].id
  }
  if (newestId && newestId !== lastSeen) {
    try { window.localStorage.setItem(NOTIF_FRIEND_SEEN, newestId) } catch { /* ignore */ }
  }
}

let timer: ReturnType<typeof setInterval> | null = null

/** Kick off the polling loop. Idempotent — safe to call from App init. */
export function startNotificationLoop() {
  if (typeof window === 'undefined' || timer != null) return
  setTimeout(() => { void pollNewReleases(); void pollFriendActivity() }, 3000)
  timer = setInterval(() => { void pollNewReleases(); void pollFriendActivity() }, POLL_INTERVAL_MS)
}

/** Force a check now — used when the user toggles an alert on. */
export function checkNotificationsNow(): Promise<void> {
  return Promise.all([pollNewReleases(), pollFriendActivity()]).then(() => undefined)
}
