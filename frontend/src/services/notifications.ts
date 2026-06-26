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
import type { AppNotification } from '@/types/notification'

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

type ShowNotificationOptions = NotificationOptions & {
  renotify?: boolean
}

// Inside the Tauri desktop shell the browser Notification/Service-Worker/Push
// APIs don't work (WebView2 never grants Notification.requestPermission and has
// no service worker), so we route through the native notification plugin
// instead — same isTauri pattern as useAutostart.
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// The plugin's permission check is async; cache it so the synchronous
// notificationPermission() callers (Settings init, masterEnabled) keep working.
let tauriPermCache: NotificationPermission = 'default'

export function isNotificationSupported(): boolean {
  return isTauri || (typeof window !== 'undefined' && 'Notification' in window)
}

export function notificationPermission(): NotificationPermission {
  if (isTauri) return tauriPermCache
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  return Notification.permission
}

/**
 * Refresh the cached desktop permission from the native plugin. No-op (returns
 * the live browser value) outside Tauri. Call on mount so the UI reflects the
 * real state. `isPermissionGranted()` is boolean, so a non-granted result maps
 * to 'default' — the user can then request it.
 */
export async function refreshNotificationPermission(): Promise<NotificationPermission> {
  if (!isTauri) return notificationPermission()
  try {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification')
    tauriPermCache = (await isPermissionGranted()) ? 'granted' : 'default'
  } catch {
    /* plugin unavailable — leave cache as-is */
  }
  return tauriPermCache
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (isTauri) {
    try {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification')
      let granted = await isPermissionGranted()
      if (!granted) granted = (await requestPermission()) === 'granted'
      tauriPermCache = granted ? 'granted' : 'denied'
    } catch {
      tauriPermCache = 'denied'
    }
    return tauriPermCache
  }
  if (!isNotificationSupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

// Windows toasts can't load a remote avatar URL (the OS renders them, not the
// webview) — like WhatsApp, we cache the image to a local file and point the
// toast at that path. Keyed by URL so each avatar is fetched/written only once.
const tauriIconCache = new Map<string, string>()

function hashUrl(url: string): string {
  let h = 0
  for (let i = 0; i < url.length; i++) h = (Math.imul(31, h) + url.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * Download an avatar URL, normalise it to a small PNG via canvas (dodges webp /
 * unknown-format issues), write it under AppCache, and return the absolute path
 * the toast can read. Returns undefined on any failure so the toast still fires
 * text-only.
 */
async function cacheIconForTauri(url: string | null | undefined): Promise<string | undefined> {
  if (!url || !/^https?:\/\//i.test(url)) return undefined
  const cached = tauriIconCache.get(url)
  if (cached) return cached
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const bitmap = await createImageBitmap(await res.blob())
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(bitmap, 0, 0, size, size)
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!pngBlob) return undefined
    const bytes = new Uint8Array(await pngBlob.arrayBuffer())

    const { writeFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    const { appCacheDir, join } = await import('@tauri-apps/api/path')
    // The app cache dir may not exist yet on a fresh install, and writeFile
    // won't create it — make the subdir first (recursive, ignore "already exists").
    const dir = 'notif-icons'
    await mkdir(dir, { baseDir: BaseDirectory.AppCache, recursive: true }).catch(() => {})
    const fileName = `notif-avatar-${hashUrl(url)}.png`
    await writeFile(`${dir}/${fileName}`, bytes, { baseDir: BaseDirectory.AppCache })
    const abs = await join(await appCacheDir(), dir, fileName)
    tauriIconCache.set(url, abs)
    return abs
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[notifications] avatar cache failed', e)
    return undefined
  }
}

/** Fire a native OS notification through the Tauri plugin (desktop build only). */
async function fireTauriNotification(title: string, body: string, iconUrl?: string | null) {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification')
    let granted = await isPermissionGranted()
    if (!granted) granted = (await requestPermission()) === 'granted'
    tauriPermCache = granted ? 'granted' : 'denied'
    if (!granted) return
    const icon = await cacheIconForTauri(iconUrl)
    // Windows: use our native command so the sender's avatar actually renders —
    // the notification plugin can't show images on Windows. Fall back to the
    // plugin (text-only) on other platforms or if the command errors.
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('notify_native', { title, body: body || '', icon: icon ?? null })
    } catch {
      sendNotification({ title, body: body || undefined })
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[notifications] tauri sendNotification failed', e)
  }
}

function readBool(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

async function showServiceWorkerNotification(title: string, body: string, icon?: string | null, link?: string | null) {
  if (!('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const options: ShowNotificationOptions = {
      body,
      icon: icon ?? '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `ns-local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      renotify: true,
      data: { url: link ?? '/' },
    }
    await reg.showNotification(title, options)
    return true
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[notifications] service-worker showNotification failed', e)
    return false
  }
}

export async function fireNotification(title: string, body: string, icon?: string | null, link?: string | null) {
  // Desktop shell: go straight to the native plugin (no SW / web Notification).
  if (isTauri) {
    void fireTauriNotification(title, body, icon)
    return
  }
  if (!isNotificationSupported() || Notification.permission !== 'granted') return
  if (await showServiceWorkerNotification(title, body, icon, link)) return
  try {
    const n = new Notification(title, {
      body,
      icon: icon ?? undefined,
      tag: `ns-local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    })
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

export function fireOsNotification(item: AppNotification) {
  const enabled = (() => {
    try {
      const masterOn = window.localStorage.getItem(NOTIF_MASTER_KEY) !== 'false'
      // 'ns-push-enabled' is the browser-only Web Push toggle. In the Tauri
      // desktop app there's no push, and a failed push-subscribe can leave that
      // flag 'false' — which must NOT suppress native notifications. So only let
      // it gate the realtime OS banner in the browser build.
      const pushOn = isTauri || window.localStorage.getItem('ns-push-enabled') !== 'false'
      return masterOn && pushOn
    } catch {
      return true
    }
  })()
  if (!enabled) return
  if (import.meta.env.DEV) {
    console.info('[notifications] realtime OS notification', item.type, item.title)
  }
  void fireNotification(item.title, item.body ?? '', item.imageUrl, item.linkUrl)
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
    void fireNotification(item.title, item.body ?? '', item.imageUrl, item.linkUrl)
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
    void fireNotification(item.title, item.body ?? '', item.imageUrl, item.linkUrl)
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
  void refreshNotificationPermission()
  setTimeout(() => { void pollNewReleases(); void pollFriendActivity() }, 3000)
  timer = setInterval(() => { void pollNewReleases(); void pollFriendActivity() }, POLL_INTERVAL_MS)
}

/** Force a check now — used when the user toggles an alert on. */
export function checkNotificationsNow(): Promise<void> {
  return Promise.all([pollNewReleases(), pollFriendActivity()]).then(() => undefined)
}
