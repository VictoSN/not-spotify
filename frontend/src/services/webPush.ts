/**
 * Web Push subscription helpers. Talks to the backend's /push endpoints and
 * the browser's PushManager. The service worker (public/sw.js) handles the
 * `push` event and shows the OS notification — this module just manages the
 * subscription lifecycle from the page.
 */

import { api } from './api'
import { ensureServiceWorkerRegistration } from '@/utils/registerSW'

const VAPID_CACHE_KEY = 'ns-push-vapid-public'
const SUB_CACHE_KEY = 'ns-push-subscribed'
export const PUSH_ENABLED_KEY = 'ns-push-enabled'

export type PushSendFailure = {
  subscriptionId: string
  endpoint: string
  reason: string
}

export type PushSendReport = {
  configured: boolean
  subscriptions: number
  delivered: number
  staleRemoved: number
  failures: PushSendFailure[]
  failed: number
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  // VAPID public keys arrive as URL-safe base64 without padding.
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const cached = localStorage.getItem(VAPID_CACHE_KEY)
    if (cached) return cached
  } catch { /* ignore */ }
  try {
    const res = await api.get<{ publicKey: string }>('/push/vapid-public-key')
    const key = res.data.publicKey
    try { localStorage.setItem(VAPID_CACHE_KEY, key) } catch { /* ignore */ }
    return key
  } catch {
    return null
  }
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return ''
  const bytes = new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str)
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    await ensureServiceWorkerRegistration()
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  const reg = await getRegistration()
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return sub !== null
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) throw new Error('Web Push not supported by this browser.')
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return false
  }
  if (Notification.permission !== 'granted') return false

  const reg = await getRegistration()
  if (!reg) throw new Error('No service-worker registration. Reload the page and check that /sw.js?mode=dev loads in DevTools.')
  if (!('pushManager' in reg)) throw new Error('Service worker has no PushManager. Check sw.js scope.')

  const vapid = await getVapidPublicKey()
  if (!vapid) throw new Error('Server did not return a VAPID public key — check that Push:VapidPublic is configured.')

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    // Browsers accept either a Uint8Array or an ArrayBuffer here; the
    // Uint8Array path is the safest (the `.buffer` route can return a
    // SharedArrayBuffer on some runtimes, which subscribe() rejects).
    // Cast is just to silence strict-TS narrowing of ArrayBufferLike.
    const keyBytes = urlBase64ToUint8Array(vapid) as unknown as BufferSource
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes,
      })
    } catch (e: unknown) {
      // Browser-specific subscribe failures need targeted guidance because the
      // raw DOMException message ("Registration failed - push service error")
      // tells you nothing actionable. Detect the engine and translate.
      const ua = navigator.userAgent
      const braveApi = (navigator as { brave?: { isBrave?: () => Promise<boolean> } }).brave
      const isBrave = braveApi?.isBrave ? await braveApi.isBrave().catch(() => false) : false
      const isOpera = / OPR\//.test(ua) || / OPRGX\//.test(ua)
      const isFirefox = / Firefox\//.test(ua)
      if (isBrave) {
        throw new Error(
          'Brave blocks push by default. Enable "Use Google services for push messaging" in brave://settings/privacy, then try again.',
          { cause: e },
        )
      }
      if (isOpera) {
        throw new Error(
          'Opera blocks push when its built-in VPN or tracker/ad blocker is on. Turn the VPN OFF in the address bar and shut tracker blocking off for localhost, then try again.',
          { cause: e },
        )
      }
      if (isFirefox) {
        throw new Error(
          'Firefox: check that "Block pop-up windows" and Enhanced Tracking Protection aren\'t blocking push.services.mozilla.com, then try again.',
          { cause: e },
        )
      }
      throw e
    }
  }

  const payload = {
    endpoint: sub.endpoint,
    p256dh: arrayBufferToBase64(sub.getKey('p256dh')),
    authSecret: arrayBufferToBase64(sub.getKey('auth')),
  }
  await api.post('/push/subscribe', payload)
  try { localStorage.setItem(SUB_CACHE_KEY, 'true') } catch { /* ignore */ }
  return true
}

export async function syncPushSubscriptionWithSettings(): Promise<boolean> {
  if (!isPushSupported()) return false
  const enabled = (() => {
    try {
      return localStorage.getItem(PUSH_ENABLED_KEY) !== 'false'
    } catch {
      return true
    }
  })()
  if (!enabled) {
    if (import.meta.env.DEV) console.info('[push] disabled by Settings; unsubscribing')
    await unsubscribeFromPush()
    return false
  }
  if (Notification.permission !== 'granted') {
    if (import.meta.env.DEV) console.info('[push] waiting for browser notification permission', Notification.permission)
    return false
  }
  const subscribed = await subscribeToPush()
  if (import.meta.env.DEV) console.info('[push] subscription sync', subscribed ? 'ok' : 'not subscribed')
  return subscribed
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  const reg = await getRegistration()
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  try {
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint })
  } catch { /* server may be down — still drop locally */ }
  try { await sub.unsubscribe() } catch { /* ignore */ }
  try { localStorage.removeItem(SUB_CACHE_KEY) } catch { /* ignore */ }
}

/** POST /push/test — fires a real Web Push from the server to confirm the loop. */
export async function sendPushTest(): Promise<PushSendReport> {
  let res
  try {
    res = await api.post<PushSendReport>('/push/test')
  } catch (e: unknown) {
    // The server answers non-2xx with a structured reason (503 not configured,
    // 409 no subscriptions, 502 push service rejected). Surface it verbatim so
    // the toast tells us *why* instead of a generic "failed".
    const ax = e as { response?: { data?: { message?: string; report?: PushSendReport } } }
    const data = ax.response?.data
    const reason = data?.report?.failures?.[0]?.reason
    const msg = data?.message ?? (e instanceof Error ? e.message : 'Server push test failed.')
    throw new Error(reason ? `${msg} — ${reason}` : msg)
  }
  if (res.data.delivered === 0) {
    const reason = res.data.failures[0]?.reason
    throw new Error(reason ? `Push service rejected the test: ${reason}` : 'Server push test did not deliver to any subscription.')
  }
  return res.data
}
